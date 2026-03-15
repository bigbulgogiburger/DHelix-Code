/**
 * 도구 호출 재시도 및 자동 교정 모듈 — 실패한 도구 호출을 분석하고 자동으로 수정하여 재시도하는 모듈
 *
 * LLM이 도구를 호출할 때 다양한 이유로 실패할 수 있습니다:
 * - 파일 경로 오타 (ENOENT — 파일을 찾을 수 없음)
 * - 잘못된 JSON 형식의 인수
 * - 권한 부족 (EACCES)
 *
 * 이 모듈은 에러 유형을 분석하여 자동 교정을 시도합니다:
 * 1. ENOENT: Levenshtein 거리 알고리즘으로 가장 비슷한 파일명을 찾아 교정
 * 2. JSON 파싱 에러: 흔한 JSON 오류(후행 쉼표, 작은따옴표 등)를 수정
 * 3. 권한 에러: 자동 교정 불가능 → null 반환
 *
 * Levenshtein 거리: 두 문자열을 같게 만들기 위해 필요한 최소 편집 횟수
 * (삽입, 삭제, 교체)를 측정하는 알고리즘
 */
import { readdir, stat } from "node:fs/promises";
import { join, dirname, basename, isAbsolute, resolve } from "node:path";

/**
 * 교정된 도구 호출 — 수정된 인수와 교정 이유를 포함하는 결과 객체
 */
export interface CorrectedToolCall {
  /** 교정된 인수 객체 */
  readonly args: Record<string, unknown>;
  /** 교정 이유 설명 (사용자/LLM에게 보여줄 메시지) */
  readonly reason: string;
}

/**
 * 두 문자열 간의 Levenshtein 거리(편집 거리)를 계산
 *
 * 동적 프로그래밍(DP) 방식으로 구현됩니다.
 * dp[i][j]는 문자열 a의 처음 i글자와 문자열 b의 처음 j글자를
 * 같게 만드는 데 필요한 최소 편집 횟수를 저장합니다.
 *
 * 허용되는 편집 연산:
 * - 삽입 (dp[i][j-1] + 1): b에서 한 글자 삽입
 * - 삭제 (dp[i-1][j] + 1): a에서 한 글자 삭제
 * - 교체 (dp[i-1][j-1] + cost): 같으면 0, 다르면 1
 *
 * 파일명 오타를 감지하여 가장 비슷한 파일명으로 자동 교정하는 데 사용합니다.
 *
 * @param a - 첫 번째 문자열
 * @param b - 두 번째 문자열
 * @returns 두 문자열 간의 Levenshtein 거리 (편집 횟수)
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // 2차원 DP 테이블 생성: (m+1) x (n+1) 크기
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  // 기저 사례(base case) 초기화
  // 빈 문자열에서 길이 i/j인 문자열로 만들려면 i/j번의 삽입이 필요
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // DP 테이블 채우기 — 각 셀에서 삽입, 삭제, 교체 중 최소값 선택
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      // 현재 글자가 같으면 교체 비용 0, 다르면 1
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[m][n];
}

/**
 * 디렉토리에서 가장 비슷한 파일을 찾아 교정된 경로를 반환
 *
 * 파일이 존재하지 않을 때(ENOENT), 같은 디렉토리에서
 * Levenshtein 거리가 가장 작은 파일을 찾습니다.
 *
 * 교정 허용 기준:
 * - 거리가 0이면 교정 불필요 (완전 일치)
 * - 거리가 max(2, 파일명길이 * 0.3) 이하이면 오타로 판단하여 교정
 * - 그 이상이면 너무 다른 파일이므로 교정하지 않음
 *
 * 대소문자를 무시하여 비교합니다 (Case-insensitive).
 *
 * @param filePath - 원래 지정된 파일 경로 (존재하지 않는 경로)
 * @param workingDirectory - 상대 경로 해석 기준 디렉토리
 * @returns 교정된 절대 경로, 또는 null (교정 불가능한 경우)
 */
async function findClosestFile(
  filePath: string,
  workingDirectory: string,
): Promise<string | null> {
  // 상대 경로를 절대 경로로 변환
  const absolutePath = isAbsolute(filePath) ? filePath : resolve(workingDirectory, filePath);
  const dir = dirname(absolutePath);     // 부모 디렉토리 경로
  const target = basename(absolutePath); // 파일명 부분

  try {
    // 같은 디렉토리의 모든 항목(파일+폴더) 목록을 가져옴
    const entries = await readdir(dir);
    let bestMatch = "";
    let bestDistance = Infinity;

    // 모든 항목과 Levenshtein 거리를 계산하여 가장 가까운 항목을 찾음
    for (const entry of entries) {
      // 대소문자를 무시하고 비교
      const distance = levenshtein(target.toLowerCase(), entry.toLowerCase());
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = entry;
      }
    }

    // 교정 허용 최대 거리: max(2, 파일명길이의 30%)
    // 너무 짧은 파일명(예: "a.ts")은 최소 2글자 차이까지 허용
    const maxDistance = Math.max(2, Math.floor(target.length * 0.3));
    // 거리가 0이면 완전 일치(교정 불필요), maxDistance 초과면 너무 다름
    if (bestDistance <= maxDistance && bestDistance > 0 && bestMatch) {
      const correctedPath = join(dir, bestMatch);
      // 교정된 파일이 실제로 존재하는지 확인 (디렉토리가 아닌 파일인지도 검증)
      try {
        await stat(correctedPath);
        return correctedPath;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    // 디렉토리가 존재하지 않거나 읽을 수 없는 경우
    return null;
  }
}

/**
 * 잘못된 JSON 형식의 인수를 수리(repair)
 *
 * LLM이 인수를 JSON 문자열로 전달할 때 발생하는 흔한 오류를 수정합니다:
 * 1. 후행 쉼표 제거: {"a": 1, } → {"a": 1}
 * 2. 작은따옴표를 큰따옴표로 변환: {'a': 1} → {"a": 1}
 * 3. 따옴표 없는 키에 따옴표 추가: {a: 1} → {"a": 1}
 *
 * 문자열 값이 JSON 객체/배열처럼 보이면({}나 []로 시작) 파싱을 시도합니다.
 *
 * @param args - 원본 인수 객체
 * @returns 수리된 인수 객체, 또는 null (수리할 내용이 없는 경우)
 */
function repairJsonArgs(args: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const repaired = { ...args };
    let modified = false;

    for (const [key, value] of Object.entries(repaired)) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        // 문자열이 JSON 객체({...}) 또는 배열([...])처럼 보이는지 확인
        if (
          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]"))
        ) {
          try {
            // 먼저 그대로 파싱 시도
            repaired[key] = JSON.parse(trimmed);
            modified = true;
          } catch {
            // 파싱 실패 시 흔한 오류를 수정한 후 재시도
            const fixed = trimmed
              .replace(/,\s*([}\]])/g, "$1") // 후행 쉼표 제거: {a:1,} → {a:1}
              .replace(/'/g, '"') // 작은따옴표 → 큰따옴표
              .replace(/(\w+)\s*:/g, '"$1":'); // 따옴표 없는 키에 따옴표 추가
            try {
              repaired[key] = JSON.parse(fixed);
              modified = true;
            } catch {
              // 수리 후에도 파싱 실패 — 이 값은 교정 불가
            }
          }
        }
      }
    }

    // 하나라도 수리했으면 수리된 객체 반환, 아니면 null
    return modified ? repaired : null;
  } catch {
    return null;
  }
}

/**
 * 도구 인수에서 파일 경로를 추출
 *
 * 도구마다 경로 매개변수 이름이 다를 수 있으므로
 * 여러 일반적인 이름을 순서대로 확인합니다.
 *
 * @param args - 도구 인수 객체
 * @returns 파일 경로 문자열 또는 undefined
 */
function extractFilePath(args: Record<string, unknown>): string | undefined {
  if (typeof args["file_path"] === "string") return args["file_path"];
  if (typeof args["path"] === "string") return args["path"];
  if (typeof args["filePath"] === "string") return args["filePath"];
  if (typeof args["directory"] === "string") return args["directory"];
  return undefined;
}

/**
 * 도구 인수에서 사용된 경로 키 이름을 확인
 *
 * 교정된 경로를 원래 키 이름에 다시 넣기 위해 키 이름을 알아야 합니다.
 *
 * @param args - 도구 인수 객체
 * @returns 사용된 경로 키 이름 또는 undefined
 */
function getPathKey(args: Record<string, unknown>): string | undefined {
  const keys = ["file_path", "path", "filePath", "directory"];
  return keys.find((k) => typeof args[k] === "string");
}

/**
 * 실패한 도구 호출을 분석하고 자동 교정을 시도하는 핵심 함수
 *
 * 에러 유형별 교정 전략:
 *
 * 1. ENOENT (파일 없음):
 *    - 같은 디렉토리에서 Levenshtein 거리가 가장 가까운 파일을 찾아 경로 교정
 *    - 예: "indx.ts" → "index.ts"
 *
 * 2. JSON 파싱/인수 검증 에러:
 *    - 잘못된 JSON을 수리하여 재시도
 *    - 예: 후행 쉼표 제거, 작은따옴표→큰따옴표 변환
 *
 * 3. 권한 에러 (EACCES):
 *    - 자동 교정 불가능 → null 반환
 *
 * 4. 기타 에러:
 *    - 자동 교정 불가능 → null 반환
 *
 * @param toolName - 실패한 도구의 이름
 * @param originalArgs - 실패를 일으킨 원본 인수
 * @param error - 발생한 에러 객체
 * @param workingDirectory - 현재 작업 디렉토리
 * @returns 교정된 도구 호출(인수 + 이유), 또는 null (교정 불가능한 경우)
 */
export async function retryWithCorrection(
  toolName: string,
  originalArgs: Record<string, unknown>,
  error: Error,
  workingDirectory: string,
): Promise<CorrectedToolCall | null> {
  const message = error.message;

  // 권한 에러 — 자동 교정 불가능 (사용자가 직접 권한을 변경해야 함)
  if (/EACCES|permission denied/i.test(message)) {
    return null;
  }

  // ENOENT — 파일을 찾을 수 없음 → 가장 비슷한 파일명으로 교정 시도
  if (/ENOENT|no such file|not found/i.test(message)) {
    const filePath = extractFilePath(originalArgs);
    if (!filePath) return null;

    // Levenshtein 거리 기반으로 가장 비슷한 파일 검색
    const corrected = await findClosestFile(filePath, workingDirectory);
    if (!corrected) return null;

    const pathKey = getPathKey(originalArgs);
    if (!pathKey) return null;

    return {
      args: { ...originalArgs, [pathKey]: corrected },
      reason: `File not found: "${basename(filePath)}" — corrected to closest match: "${basename(corrected)}"`,
    };
  }

  // JSON 파싱 에러 또는 잘못된 인수 — JSON 수리 시도
  if (/parse.*error|invalid.*json|unexpected token|invalid.*arg/i.test(message)) {
    const repaired = repairJsonArgs(originalArgs);
    if (!repaired) return null;

    return {
      args: repaired,
      reason: `Repaired malformed JSON arguments for tool "${toolName}"`,
    };
  }

  // 알 수 없는 에러 유형 — 자동 교정 불가능
  return null;
}
