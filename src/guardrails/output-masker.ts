/**
 * 출력 시크릿 마스킹 — 도구 실행 결과에서 민감 정보를 마스킹하는 모듈
 *
 * `secret-scanner.ts`의 28가지 패턴을 재사용하여 LLM에게 전달되는
 * 도구 출력 결과(예: `env` 명령 출력, 파일 내용)에 포함된 비밀 정보를
 * maskChar(기본값: '*')로 대체합니다.
 *
 * scanForSecrets와의 차이점:
 * - scanForSecrets: "[REDACTED]" 고정 문자열로 완전 치환, LLM 입력 사전 검사
 * - maskSecrets: 설정 가능한 마스크 문자 + 접두사 보존 옵션, 도구 출력 후처리
 *
 * Gap C 해결 (06-security-extensibility-and-ops-plan.md):
 * `env` 출력에 노출된 API 키 등이 LLM context에 그대로 전달되는 취약점 해소.
 *
 * @example
 * ```ts
 * const result = maskSecrets("OPENAI_KEY=sk-abcdefghij1234567890");
 * // result.masked === "OPENAI_KEY=sk-********************"
 * // result.maskCount === 1
 * // result.patternsMatched === ["OpenAI API Key"]
 * ```
 */

import { getLogger } from "../utils/logger.js";

/** ReDoS 보호를 위한 최대 입력 길이 */
const SAFE_REGEX_INPUT_LIMIT = 50_000;

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/**
 * 출력 마스킹 설정 옵션
 *
 * @property enabled - 마스킹 활성화 여부 (false이면 입력을 그대로 반환)
 * @property maskChar - 마스킹에 사용할 문자 (기본값: '*')
 * @property preservePrefix - 매칭 문자열의 앞 N글자를 보존 (타입 식별용)
 *   예: preservePrefix=8이면 "sk-proj-****..." 형태로 접두사가 보존됨
 * @property logMaskedCount - 마스킹 횟수를 logger에 기록할지 여부
 */
export interface OutputMaskingConfig {
  readonly enabled: boolean;
  readonly maskChar?: string;
  readonly preservePrefix?: number;
  readonly logMaskedCount?: boolean;
}

/**
 * 마스킹 처리 결과
 *
 * @property masked - 비밀 정보가 마스킹된 출력 문자열
 * @property maskCount - 마스킹된 항목 수 (패턴 매칭 횟수)
 * @property patternsMatched - 매칭된 패턴 이름 목록 (예: ["OpenAI API Key"])
 */
export interface MaskingResult {
  readonly masked: string;
  readonly maskCount: number;
  readonly patternsMatched: readonly string[];
}

// ---------------------------------------------------------------------------
// 내부 패턴 정의 (secret-scanner.ts와 동일한 패턴 재사용)
// ---------------------------------------------------------------------------

/**
 * 시크릿 패턴 목록 — secret-scanner.ts의 SECRET_PATTERNS를 import 없이 재선언
 *
 * 두 모듈의 역할이 다르므로(스캔 vs 마스킹) 각자 패턴을 보유합니다.
 * 향후 공통 패턴 파일로 추출 가능합니다.
 */
const MASKING_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: "AWS Access Key", regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
  { name: "Google Cloud Service Account", regex: /"type"\s*:\s*"service_account"/g },
  {
    name: "Azure Connection String",
    regex: /(?:DefaultEndpointsProtocol|AccountKey|SharedAccessSignature)\s*=[^\s;]+/gi,
  },
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/g },
  { name: "Anthropic API Key", regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g },
  { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "GitHub OAuth", regex: /gho_[a-zA-Z0-9]{36}/g },
  { name: "GitHub App Token", regex: /(?:ghu|ghs|ghr)_[a-zA-Z0-9]{36}/g },
  { name: "Slack Token", regex: /xox[bpsa]-[a-zA-Z0-9-]{10,}/g },
  { name: "Stripe Secret Key", regex: /sk_(?:live|test)_[a-zA-Z0-9]{20,}/g },
  { name: "Stripe Publishable Key", regex: /pk_(?:live|test)_[a-zA-Z0-9]{20,}/g },
  { name: "RSA Private Key", regex: /-----BEGIN RSA PRIVATE KEY-----/g },
  { name: "EC Private Key", regex: /-----BEGIN EC PRIVATE KEY-----/g },
  { name: "OpenSSH Private Key", regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { name: "Generic Private Key", regex: /-----BEGIN PRIVATE KEY-----/g },
  {
    name: "JWT Token",
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  },
  { name: "npm Token", regex: /npm_[a-zA-Z0-9]{36}/g },
  { name: "Heroku API Key", regex: /(?:heroku[_-]?api[_-]?key|HEROKU_API_KEY)\s*[:=]\s*\S+/gi },
  { name: "SendGrid API Key", regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g },
  {
    name: "Twilio Auth Token",
    regex: /(?:twilio[_-]?auth[_-]?token|TWILIO_AUTH_TOKEN)\s*[:=]\s*[a-f0-9]{32}/gi,
  },
  { name: "PostgreSQL Connection", regex: /postgresql:\/\/[^\s'"]+/gi },
  { name: "MongoDB Connection", regex: /mongodb(?:\+srv)?:\/\/[^\s'"]+/gi },
  { name: "MySQL Connection", regex: /mysql:\/\/[^\s'"]+/gi },
  { name: "Password", regex: /password\s*[:=]\s*\S+/gi },
  { name: "Bearer Token", regex: /Bearer\s+[a-zA-Z0-9._-]+/g },
  { name: "API Key", regex: /API[_-]?KEY\s*[:=]\s*\S+/gi },
  {
    name: "Generic Secret Assignment",
    regex: /(?:secret|token|credential|auth_key)\s*[:=]\s*['"][^\s'"]{8,}['"]/gi,
  },
];

// ---------------------------------------------------------------------------
// 내부 헬퍼
// ---------------------------------------------------------------------------

/**
 * ReDoS 방지를 위한 안전한 정규식 replace 래퍼
 *
 * 50,000자를 초과하는 입력은 앞부분만 처리하여 역추적 폭발을 방지합니다.
 *
 * @param input - 원본 문자열
 * @param pattern - 사용할 정규식
 * @param replacer - 매칭된 부분을 대체하는 함수
 * @returns 대체된 문자열
 */
function safeRegexReplaceWith(
  input: string,
  pattern: RegExp,
  replacer: (match: string) => string,
): string {
  if (input.length > SAFE_REGEX_INPUT_LIMIT) {
    const logger = getLogger();
    logger.warn(
      {
        inputLength: input.length,
        limit: SAFE_REGEX_INPUT_LIMIT,
        pattern: pattern.source.slice(0, 60),
      },
      "ReDoS protection: input truncated for output masker regex replace",
    );
    const truncatedPart = input.slice(0, SAFE_REGEX_INPUT_LIMIT);
    const remainder = input.slice(SAFE_REGEX_INPUT_LIMIT);
    return truncatedPart.replace(pattern, replacer) + remainder;
  }
  return input.replace(pattern, replacer);
}

/**
 * 매칭 문자열을 마스크 문자로 대체하는 replacer 함수를 생성합니다.
 *
 * preservePrefix가 설정된 경우 앞 N글자를 원본으로 보존하고
 * 나머지만 maskChar로 채웁니다. 이를 통해 타입 식별은 유지하면서
 * 실제 시크릿 값을 숨길 수 있습니다.
 *
 * @param maskChar - 마스킹 문자 (기본: '*')
 * @param preservePrefix - 보존할 접두사 길이 (0이면 전체 마스킹)
 * @returns String.prototype.replace에 전달할 replacer 함수
 */
function buildReplacer(maskChar: string, preservePrefix: number): (match: string) => string {
  return (match: string): string => {
    if (preservePrefix <= 0) {
      // 접두사 보존 없이 전체 마스킹
      return maskChar.repeat(match.length);
    }
    if (match.length <= preservePrefix) {
      // 매칭 전체가 접두사 범위 내 — 마스킹할 부분 없음
      return match;
    }
    const prefix = match.slice(0, preservePrefix);
    const maskLength = match.length - preservePrefix;
    return prefix + maskChar.repeat(maskLength);
  };
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 출력 문자열에서 비밀 정보를 마스킹합니다.
 *
 * 도구 실행 결과(`env`, 파일 읽기 등)가 LLM context에 전달되기 전에
 * 이 함수를 통해 민감 정보를 마스킹하여 보안을 강화합니다.
 *
 * 설정 옵션:
 * - `enabled: false`이면 즉시 원본을 반환하여 오버헤드 없음
 * - `preservePrefix`로 타입 힌트를 보존하면서 값을 숨길 수 있음
 * - 매칭 횟수와 패턴 목록을 반환하여 감사 로그에 활용 가능
 *
 * @param output - 마스킹할 도구 출력 문자열
 * @param config - 마스킹 설정 (기본값: enabled=true, maskChar='*', preservePrefix=0)
 * @returns 마스킹 결과 (처리된 문자열, 마스킹 횟수, 매칭된 패턴 목록)
 *
 * @example
 * ```ts
 * // 기본 마스킹
 * const r1 = maskSecrets("key=sk-abc123defghijklmnopqr");
 * // r1.masked === "key=sk-**********************"
 *
 * // 접두사 보존
 * const r2 = maskSecrets("sk-proj-abc123...", { enabled: true, preservePrefix: 8 });
 * // r2.masked === "sk-proj-*****..."
 * ```
 */
export function maskSecrets(
  output: string,
  config: OutputMaskingConfig = { enabled: true },
): MaskingResult {
  // 비활성화 시 즉시 반환
  if (!config.enabled) {
    return { masked: output, maskCount: 0, patternsMatched: [] };
  }

  const maskChar = config.maskChar ?? "*";
  const preservePrefix = config.preservePrefix ?? 0;
  const matchedPatterns: string[] = [];
  let masked = output;
  let maskCount = 0;

  for (const { name, regex } of MASKING_PATTERNS) {
    // 새 RegExp 인스턴스 생성으로 lastIndex 초기화 (전역 플래그 /g의 부작용 방지)
    const testPattern = new RegExp(regex.source, regex.flags);

    if (testPattern.test(masked)) {
      matchedPatterns.push(name);

      // 실제 대체 수행 — 각 매칭마다 카운트 증가
      const replacePattern = new RegExp(regex.source, regex.flags);
      const replacer = buildReplacer(maskChar, preservePrefix);

      let localCount = 0;
      const countingReplacer = (match: string): string => {
        localCount++;
        return replacer(match);
      };

      masked = safeRegexReplaceWith(masked, replacePattern, countingReplacer);
      maskCount += localCount;
    }
  }

  if (config.logMaskedCount === true && maskCount > 0) {
    const logger = getLogger();
    logger.info(
      { maskCount, patterns: matchedPatterns },
      "output-masker: masked secrets in tool output",
    );
  }

  return { masked, maskCount, patternsMatched: matchedPatterns };
}
