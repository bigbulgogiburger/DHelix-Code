/**
 * 토큰 저장소 — API 토큰을 다양한 소스에서 로드하고 저장하는 모듈
 *
 * API 토큰은 LLM 서비스(OpenAI, Anthropic 등)에 인증하기 위한
 * 비밀 키입니다. 이 모듈은 두 가지 소스에서 토큰을 찾습니다:
 *
 * 1. 환경 변수 (최우선): DHELIX_API_KEY 또는 OPENAI_API_KEY
 *    - CI/CD 파이프라인이나 Docker 환경에서 주로 사용
 *    - 파일에 토큰을 저장하지 않아 보안적으로 우수
 *
 * 2. 자격 증명 파일: ~/.dhelix/credentials.json
 *    - 로컬 개발 환경에서 편리하게 사용
 *    - 파일 권한 0o600으로 소유자만 읽기/쓰기 가능하게 저장
 *
 * 우선순위: 환경 변수 > 자격 증명 파일
 * (환경 변수가 설정되어 있으면 파일은 확인하지 않음)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { type TokenConfig, type ResolvedToken } from "./types.js";
import { joinPath } from "../utils/path.js";
import { CONFIG_DIR } from "../constants.js";
import { AuthError } from "../utils/error.js";

// 자격 증명 파일 경로: ~/.dhelix/credentials.json
const TOKEN_FILE = joinPath(CONFIG_DIR, "credentials.json");

/**
 * 환경 변수에서 API 토큰을 로드합니다.
 *
 * 확인하는 환경 변수 (우선순위 순):
 * 1. DHELIX_API_KEY — dhelix 전용 API 키
 * 2. OPENAI_API_KEY — OpenAI 호환 API 키 (많은 LLM 서비스가 이 이름을 사용)
 *
 * 환경 변수에서 로드된 토큰은 기본적으로 Bearer 인증 방식을 사용합니다.
 *
 * @returns 토큰 설정 객체, 환경 변수가 없으면 undefined
 */
function loadFromEnv(): TokenConfig | undefined {
  // || 연산자: 첫 번째 truthy 값을 반환 (빈 문자열도 falsy로 처리)
  const apiKey = process.env.DHELIX_API_KEY || process.env.OPENAI_API_KEY;
  if (apiKey) {
    return { method: "bearer", token: apiKey };
  }
  return undefined;
}

/**
 * 자격 증명 파일(~/.dhelix/credentials.json)에서 토큰을 로드합니다.
 *
 * 파일 형식:
 * ```json
 * {
 *   "method": "bearer",
 *   "token": "sk-...",
 *   "headerName": "Authorization"  // custom-header일 때만 사용
 * }
 * ```
 *
 * 파일이 존재하지 않거나 파싱 실패 시 undefined를 반환합니다.
 * (첫 실행 시에는 자격 증명 파일이 없는 것이 정상)
 *
 * @returns 토큰 설정 객체, 파일이 없거나 유효하지 않으면 undefined
 */
async function loadFromFile(): Promise<TokenConfig | undefined> {
  try {
    const content = await readFile(TOKEN_FILE, "utf-8");
    const data = JSON.parse(content) as Record<string, unknown>;

    // 토큰 값이 비어있지 않은 문자열인지 검증
    if (typeof data.token === "string" && data.token.length > 0) {
      return {
        // method가 없으면 기본값 "bearer" 사용
        method: (data.method as TokenConfig["method"]) ?? "bearer",
        token: data.token,
        headerName: typeof data.headerName === "string" ? data.headerName : undefined,
      };
    }
    return undefined;
  } catch {
    // 파일이 없거나 JSON 파싱 실패 — 정상적인 상황 (첫 실행)
    return undefined;
  }
}

/**
 * 사용 가능한 모든 소스에서 API 토큰을 찾아 반환합니다.
 *
 * 우선순위:
 * 1. 환경 변수 (DHELIX_API_KEY, OPENAI_API_KEY) — 최우선
 * 2. 자격 증명 파일 (~/.dhelix/credentials.json) — 차선
 *
 * 모든 소스에서 토큰을 찾지 못하면 undefined를 반환합니다.
 *
 * @returns 해석된 토큰 (설정 + 출처), 토큰이 없으면 undefined
 */
export async function resolveToken(): Promise<ResolvedToken | undefined> {
  // 우선순위 1: 환경 변수
  const envToken = loadFromEnv();
  if (envToken) {
    return { config: envToken, source: "environment" };
  }

  // 우선순위 2: 자격 증명 파일
  const fileToken = await loadFromFile();
  if (fileToken) {
    return { config: fileToken, source: "file" };
  }

  // 모든 소스에서 토큰을 찾지 못함
  return undefined;
}

/**
 * API 토큰을 자격 증명 파일에 저장합니다.
 *
 * 보안 조치:
 * - 파일 권한을 0o600(소유자만 읽기/쓰기)으로 설정하여
 *   다른 사용자가 토큰을 읽을 수 없도록 합니다.
 * - 부모 디렉토리가 없으면 자동으로 생성합니다.
 *
 * @param config - 저장할 토큰 설정
 * @throws AuthError - 파일 저장 실패 시
 */
export async function saveToken(config: TokenConfig): Promise<void> {
  try {
    // 디렉토리가 없으면 생성 (~/.dhelix/)
    await mkdir(CONFIG_DIR, { recursive: true });

    // JSON으로 직렬화 (보기 좋게 2칸 들여쓰기)
    const data = JSON.stringify(
      {
        method: config.method,
        token: config.token,
        headerName: config.headerName,
      },
      null,
      2,
    );

    // mode: 0o600 — Unix 파일 권한: 소유자만 읽기(4)+쓰기(2) = 6, 그룹과 기타는 0
    // 이는 토큰 파일을 다른 사용자가 읽을 수 없도록 보호합니다
    await writeFile(TOKEN_FILE, data, { mode: 0o600 });
  } catch (error) {
    throw new AuthError("Failed to save token", {
      path: TOKEN_FILE,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
