/**
 * 코드 리뷰 에이전트(Code Review Agent) 모듈
 *
 * diff(코드 변경사항)를 분석하여 잠재적 이슈를 발견하는 자동화된 코드 리뷰 시스템입니다.
 * Generator-Critic 패턴을 사용합니다:
 * 1단계 (Generator): LLM이 모든 잠재적 이슈를 찾아냅니다
 * 2단계 (Critic): LLM이 스스로 재평가하여 오탐(false positive)을 제거합니다
 *
 * 주니어 개발자를 위한 설명:
 * - 이 모듈은 git diff 같은 코드 변경사항을 LLM에게 보내서 리뷰를 받습니다
 * - LLM의 응답을 파싱하여 구조화된 리뷰 결과(이슈 목록, 점수, 요약)를 만듭니다
 * - 심각도(critical/high/medium/low)와 카테고리(보안/정확성/스타일/성능)로 분류합니다
 */

/**
 * 리뷰 이슈의 심각도 수준
 *
 * - "critical": 보안 취약점, 데이터 손실 위험, 프로덕션 크래시 가능성
 * - "high": 로직 에러, 에러 처리 누락, 경쟁 조건(race condition)
 * - "medium": 코드 스멜, 타입 누락, 좋지 않은 네이밍, 테스트 부족
 * - "low": 스타일 관련 사소한 문제, 포매팅, 문서화 부족
 */
export type ReviewSeverity = "critical" | "high" | "medium" | "low";

/**
 * 리뷰 이슈의 카테고리
 *
 * - "security": 인증, 인젝션, 비밀 정보, 권한, 입력 검증 관련
 * - "correctness": 로직 에러, 엣지 케이스, 타입 불일치, 잘못된 동작
 * - "style": 네이밍, 포매팅, 컨벤션, 데드 코드, 문서화
 * - "performance": N+1 쿼리, 불필요한 할당, 알고리즘 복잡도
 */
export type ReviewCategory = "security" | "correctness" | "style" | "performance";

/**
 * 코드 리뷰에서 발견된 단일 이슈
 *
 * @property severity - 이슈의 심각도 수준
 * @property category - 이슈의 카테고리
 * @property message - 이슈에 대한 설명 텍스트
 * @property line - 이슈가 발생한 줄 번호 (특정할 수 없으면 undefined)
 * @property file - 이슈가 발생한 파일 경로 (특정할 수 없으면 undefined)
 */
export interface ReviewIssue {
  readonly severity: ReviewSeverity;
  readonly category: ReviewCategory;
  readonly message: string;
  readonly line?: number;
  readonly file?: string;
}

/**
 * 코드 리뷰의 전체 결과
 *
 * @property issues - 발견된 이슈 목록
 * @property summary - 전체적인 평가 요약 (1~2문장)
 * @property score - 코드 품질 점수 (0~100, 100이 완벽)
 */
export interface ReviewResult {
  readonly issues: readonly ReviewIssue[];
  readonly summary: string;
  readonly score: number;
}

/** 유효한 심각도 값의 집합 (검증용) */
const VALID_SEVERITIES = new Set<string>(["critical", "high", "medium", "low"]);

/** 유효한 카테고리 값의 집합 (검증용) */
const VALID_CATEGORIES = new Set<string>(["security", "correctness", "style", "performance"]);

/**
 * diff 문자열로부터 구조화된 리뷰 프롬프트를 생성합니다.
 *
 * Generator-Critic 패턴을 LLM에게 지시합니다:
 * 1. Generator 단계: diff를 분석하여 모든 잠재적 이슈를 식별
 * 2. Critic 단계: 각 이슈를 재평가하여 실제 문제인 것만 유지
 *
 * LLM의 출력 형식도 구체적으로 지정하여 파싱 가능한 결과를 보장합니다.
 *
 * @param diff - 리뷰할 git diff 또는 코드 diff 문자열
 * @param focusAreas - 특별히 집중할 영역 목록 (예: ["security", "performance"])
 * @returns LLM에게 보낼 준비가 된 프롬프트 문자열
 */
export function buildReviewPrompt(diff: string, focusAreas?: readonly string[]): string {
  // 집중 영역이 있으면 프롬프트에 추가
  const focusSection =
    focusAreas && focusAreas.length > 0
      ? `\n\nFocus especially on these areas: ${focusAreas.join(", ")}.`
      : "";

  const prompt = [
    "You are a senior code reviewer performing a thorough review of the following diff.",
    "Use the Generator-Critic pattern:",
    "",
    "STEP 1 (Generator): Analyze the diff and identify ALL potential issues.",
    "STEP 2 (Critic): Re-evaluate each issue. Remove false positives and noise.",
    "         Keep only issues that are genuinely problematic.",
    "",
    "For each confirmed issue, output a JSON object on its own line with this exact format:",
    '  {"severity": "<critical|high|medium|low>", "category": "<security|correctness|style|performance>", "message": "<description>", "line": <number or null>, "file": "<path or null>"}',
    "",
    "After all issues, output a summary section:",
    "  SUMMARY: <1-2 sentence overall assessment>",
    "  SCORE: <0-100 integer, where 100 is perfect code>",
    "",
    "Severity guide:",
    "  critical — Security vulnerabilities, data loss risks, crashes in production",
    "  high     — Logic errors, missing error handling, race conditions",
    "  medium   — Code smells, missing types, poor naming, lack of tests",
    "  low      — Style nits, minor formatting, documentation gaps",
    "",
    "Category guide:",
    "  security    — Auth, injection, secrets, permissions, input validation",
    "  correctness — Logic errors, edge cases, type mismatches, wrong behavior",
    "  style       — Naming, formatting, conventions, dead code, documentation",
    "  performance — N+1 queries, unnecessary allocations, algorithmic complexity",
    focusSection,
    "",
    "--- BEGIN DIFF ---",
    diff,
    "--- END DIFF ---",
  ].join("\n");

  return prompt;
}

/**
 * LLM의 리뷰 출력을 파싱하여 구조화된 ReviewResult로 변환합니다.
 *
 * LLM 출력에서 다음을 추출합니다:
 * - JSON 형태의 이슈 객체 (한 줄에 하나씩)
 * - "SUMMARY:" 줄에서 요약 텍스트
 * - "SCORE:" 줄에서 점수 (0~100 정수)
 *
 * 파싱할 수 없는 줄은 건너뛰어, 부분적으로 잘못된 출력에도 안전하게 동작합니다.
 *
 * @param llmOutput - LLM에서 받은 원시 텍스트 출력
 * @returns 구조화된 리뷰 결과
 */
export function parseReviewResult(llmOutput: string): ReviewResult {
  const lines = llmOutput.split("\n");
  const issues: ReviewIssue[] = [];
  let summary = "";
  let score = 50; // 점수를 찾지 못했을 때의 기본값

  for (const line of lines) {
    const trimmed = line.trim();

    // JSON 이슈 객체 파싱 시도 ({로 시작하고 }로 끝나는 줄)
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const issue = tryParseIssue(trimmed);
      if (issue) {
        issues.push(issue);
        continue;
      }
    }

    // "SUMMARY: ..." 줄에서 요약 추출
    const summaryMatch = trimmed.match(/^SUMMARY:\s*(.+)$/i);
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
      continue;
    }

    // "SCORE: 숫자" 줄에서 점수 추출
    const scoreMatch = trimmed.match(/^SCORE:\s*(\d+)/i);
    if (scoreMatch) {
      const parsed = parseInt(scoreMatch[1], 10);
      if (parsed >= 0 && parsed <= 100) {
        score = parsed;
      }
      continue;
    }
  }

  // LLM이 요약을 제공하지 않았으면 이슈 통계로 대체 요약 생성
  if (!summary) {
    summary = generateFallbackSummary(issues);
  }

  return { issues, summary, score };
}

/**
 * JSON 문자열을 ReviewIssue로 파싱합니다.
 * 필수 필드(severity, category, message)가 유효하지 않으면 null을 반환합니다.
 *
 * @param jsonStr - 파싱할 JSON 문자열
 * @returns 유효한 ReviewIssue 객체, 또는 유효하지 않으면 null
 */
function tryParseIssue(jsonStr: string): ReviewIssue | null {
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (typeof parsed !== "object" || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;

    // 필수 필드 검증: severity, category, message가 유효한 값인지 확인
    if (typeof obj.severity !== "string" || !VALID_SEVERITIES.has(obj.severity)) return null;
    if (typeof obj.category !== "string" || !VALID_CATEGORIES.has(obj.category)) return null;
    if (typeof obj.message !== "string" || obj.message.length === 0) return null;

    const issue: ReviewIssue = {
      severity: obj.severity as ReviewSeverity,
      category: obj.category as ReviewCategory,
      message: obj.message,
      // 선택 필드: 타입이 맞을 때만 포함
      ...(typeof obj.line === "number" ? { line: obj.line } : {}),
      ...(typeof obj.file === "string" && obj.file.length > 0 ? { file: obj.file } : {}),
    };

    return issue;
  } catch {
    // JSON 파싱 실패 -> null 반환 (해당 줄 무시)
    return null;
  }
}

/**
 * LLM이 요약을 제공하지 않았을 때 이슈 통계로 대체 요약을 생성합니다.
 *
 * @param issues - 발견된 이슈 목록
 * @returns 심각도별 이슈 수를 포함한 요약 문자열
 */
function generateFallbackSummary(issues: readonly ReviewIssue[]): string {
  if (issues.length === 0) {
    return "No issues found in the reviewed code.";
  }

  // 심각도별 이슈 수 집계
  const criticalCount = issues.filter((i) => i.severity === "critical").length;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const mediumCount = issues.filter((i) => i.severity === "medium").length;
  const lowCount = issues.filter((i) => i.severity === "low").length;

  const parts: string[] = [`Found ${issues.length} issue(s):`];
  if (criticalCount > 0) parts.push(`${criticalCount} critical`);
  if (highCount > 0) parts.push(`${highCount} high`);
  if (mediumCount > 0) parts.push(`${mediumCount} medium`);
  if (lowCount > 0) parts.push(`${lowCount} low`);

  return parts.join(" ");
}
