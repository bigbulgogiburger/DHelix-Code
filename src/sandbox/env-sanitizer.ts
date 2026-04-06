/**
 * 환경변수 정제기 — spawn() 전에 민감한 환경변수를 제거하는 모듈
 *
 * 프로세스 실행 시 부모 프로세스의 환경변수가 그대로 상속되면
 * API 키, 토큰, 비밀키 등이 자식 프로세스에 노출될 수 있습니다.
 * 이 모듈은 허용 목록(whitelist) 또는 차단 목록(blacklist) 방식으로
 * 환경변수를 정제하여 보안을 강화합니다.
 *
 * 동작 모드:
 * - strict: allowedEnvVars에 명시된 변수만 허용 (whitelist)
 * - permissive: deniedEnvVars 및 secret 패턴에 해당하는 변수만 제거 (blacklist)
 * - off: 환경변수를 그대로 전달 (정제 없음)
 *
 * @example
 * import { sanitizeEnv } from "./env-sanitizer.js";
 *
 * const cleaned = sanitizeEnv(process.env as Record<string, string>);
 * // API 키, 토큰 등이 제거된 환경변수
 *
 * @example
 * const strict = sanitizeEnv(process.env as Record<string, string>, {
 *   allowedEnvVars: new Set(["HOME", "PATH", "USER"]),
 * });
 * // HOME, PATH, USER만 포함
 */

/**
 * 환경변수 정제 설정
 *
 * allowedEnvVars와 deniedEnvVars를 동시에 설정하면
 * allowedEnvVars가 우선 적용됩니다 (whitelist 우선).
 */
export interface EnvSanitizeConfig {
  /** 허용할 환경변수 이름 집합 (설정 시 이 변수들만 허용) */
  readonly allowedEnvVars?: ReadonlySet<string>;
  /** 차단할 환경변수 이름 집합 (이 변수들 제거) */
  readonly deniedEnvVars?: ReadonlySet<string>;
  /** PATH 환경변수 상속 여부 (기본: true) */
  readonly inheritPath?: boolean;
  /** 커스텀 PATH 값 (설정 시 기존 PATH를 대체) */
  readonly customPath?: string;
  /** *_KEY, *_SECRET, *_TOKEN 등 비밀 패턴 자동 제거 여부 (기본: true) */
  readonly stripSecrets?: boolean;
}

/**
 * 샌드박스 환경변수 모드
 *
 * DHELIX_SANDBOX_ENV 환경변수로 설정합니다.
 * - strict: allowedEnvVars 기반 whitelist만 허용
 * - permissive: 비밀 패턴 및 차단 목록만 제거 (기본값)
 * - off: 환경변수를 정제하지 않고 그대로 전달
 */
export type SandboxEnvMode = "strict" | "permissive" | "off";

/**
 * 기본 차단 환경변수 — 보안상 자식 프로세스에 전달하면 위험한 변수들
 *
 * SSH 에이전트, 클라우드 자격증명, API 키 등이 포함됩니다.
 */
export const DEFAULT_DENIED_VARS: ReadonlySet<string> = new Set([
  // SSH
  "SSH_AUTH_SOCK",
  "SSH_AGENT_PID",
  "SSH_PRIVATE_KEY",
  // AWS
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_SECURITY_TOKEN",
  "AWS_DEFAULT_REGION",
  // LLM API 키
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "AZURE_OPENAI_API_KEY",
  "COHERE_API_KEY",
  "MISTRAL_API_KEY",
  "HUGGING_FACE_HUB_TOKEN",
  // 클라우드 / CI
  "GCP_SERVICE_ACCOUNT_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GITHUB_TOKEN",
  "GITLAB_TOKEN",
  "NPM_TOKEN",
  "DOCKER_AUTH_CONFIG",
  "CI_JOB_TOKEN",
  // 데이터베이스
  "DATABASE_URL",
  "REDIS_URL",
  "MONGO_URI",
  // Dhelix 내부
  "DHELIX_API_KEY",
]);

/**
 * 기본 허용 환경변수 — strict 모드에서도 허용되는 안전한 변수들
 *
 * 셸 실행에 필요한 최소한의 환경변수만 포함합니다.
 */
export const DEFAULT_ALLOWED_VARS: ReadonlySet<string> = new Set([
  "HOME",
  "USER",
  "USERNAME",
  "LOGNAME",
  "PATH",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "TERM_PROGRAM",
  "COLORTERM",
  "NODE_ENV",
  "NODE_PATH",
  "TMPDIR",
  "TMP",
  "TEMP",
  "EDITOR",
  "VISUAL",
  "PAGER",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
  // Windows 호환
  "SYSTEMROOT",
  "COMSPEC",
  "WINDIR",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMFILES",
  "USERPROFILE",
  // Git
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
  // MSYS/Git Bash
  "MSYS",
  "CHERE_INVOKING",
]);

/**
 * 비밀 패턴 — 환경변수 이름이 이 패턴과 일치하면 비밀로 간주하여 제거
 *
 * 대소문자를 구분하지 않고 검사합니다.
 * 접미사(_KEY, _SECRET 등) 및 접두사(SECRET_, TOKEN_) 모두 탐지합니다.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /_KEY$/i,
  /_SECRET$/i,
  /_TOKEN$/i,
  /_PASSWORD$/i,
  /_CREDENTIAL$/i,
  /_CREDENTIALS$/i,
  /^SECRET_/i,
  /^TOKEN_/i,
  /_API_KEY$/i,
  /_AUTH$/i,
  /_PRIVATE/i,
  /PASSPHRASE/i,
];

/**
 * 환경변수 이름이 비밀 패턴과 일치하는지 확인합니다.
 *
 * @param name - 확인할 환경변수 이름
 * @returns 비밀 패턴과 일치하면 true
 */
function isSecretVar(name: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * 현재 DHELIX_SANDBOX_ENV 환경변수에서 샌드박스 모드를 읽습니다.
 *
 * @returns 현재 샌드박스 환경변수 모드 (기본: "permissive")
 */
export function getSandboxEnvMode(): SandboxEnvMode {
  const mode = process.env["DHELIX_SANDBOX_ENV"];
  if (mode === "strict" || mode === "permissive" || mode === "off") {
    return mode;
  }
  return "permissive";
}

/**
 * 환경변수를 정제하여 민감한 정보를 제거합니다.
 *
 * 동작 순서:
 * 1. allowedEnvVars가 설정되면 해당 변수만 선택 (whitelist 모드)
 * 2. allowedEnvVars가 없으면 deniedEnvVars에 해당하는 변수 제거
 * 3. stripSecrets가 true(기본값)이면 비밀 패턴에 해당하는 변수 추가 제거
 * 4. PATH 상속/커스텀 설정 적용
 *
 * @param env - 정제할 환경변수 (보통 process.env를 전달)
 * @param config - 정제 설정 (선택사항, 미설정 시 기본값 사용)
 * @returns 정제된 환경변수 객체
 */
export function sanitizeEnv(
  env: Record<string, string | undefined>,
  config?: EnvSanitizeConfig,
): Record<string, string> {
  const {
    allowedEnvVars,
    deniedEnvVars,
    inheritPath = true,
    customPath,
    stripSecrets = true,
  } = config ?? {};

  const result: Record<string, string> = {};

  // Whitelist 모드: allowedEnvVars가 설정되면 해당 변수만 포함
  if (allowedEnvVars && allowedEnvVars.size > 0) {
    for (const key of allowedEnvVars) {
      const value = env[key];
      if (value !== undefined) {
        result[key] = value;
      }
    }
  } else {
    // Blacklist 모드: 차단 목록과 비밀 패턴에 해당하지 않는 변수를 포함
    const denied = deniedEnvVars ?? DEFAULT_DENIED_VARS;

    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) continue;

      // 차단 목록에 있는 변수 제거
      if (denied.has(key)) continue;

      // 비밀 패턴에 해당하는 변수 제거
      if (stripSecrets && isSecretVar(key)) continue;

      result[key] = value;
    }
  }

  // PATH 처리
  if (customPath !== undefined) {
    result["PATH"] = customPath;
  } else if (!inheritPath) {
    delete result["PATH"];
  } else if (env["PATH"] !== undefined && !result["PATH"]) {
    // allowedEnvVars 모드에서 PATH가 목록에 없지만 inheritPath=true이면 PATH 추가
    result["PATH"] = env["PATH"];
  }

  return result;
}
