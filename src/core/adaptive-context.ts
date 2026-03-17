/**
 * 적응형 컨텍스트(Adaptive Context) 모듈
 *
 * 사용자 입력의 복잡도를 분석하여 LLM에게 전달할 컨텍스트의 양을 자동으로 조절합니다.
 * 간단한 질문에는 최소한의 컨텍스트만 로드하고,
 * 복잡한 리팩토링 작업에는 전체 프로젝트 정보를 포함시킵니다.
 *
 * 주니어 개발자를 위한 설명:
 * - LLM에게 보내는 컨텍스트(프롬프트)가 많을수록 비용과 응답 시간이 증가합니다
 * - "ls 실행해줘" 같은 간단한 요청에 프로젝트 전체 구조를 보낼 필요는 없습니다
 * - 이 모듈은 입력을 분석해서 "이건 간단/보통/복잡한 작업이다"를 판단합니다
 * - 판단 결과에 따라 시스템 프롬프트에 포함할 정보의 양을 결정합니다
 */

/**
 * 작업 복잡도 수준
 *
 * - "simple": 파일 읽기, 간단한 질문, 한 줄 수정 등
 * - "moderate": 일반적인 개발 작업 (함수 추가, 버그 수정 등)
 * - "complex": 대규모 리팩토링, 아키텍처 변경, 다중 파일 수정 등
 */
export type TaskComplexity = "simple" | "moderate" | "complex";

/**
 * 작업 복잡도에 따른 컨텍스트 로딩 전략
 *
 * @property includeRepoMap - 저장소 맵(프로젝트 파일 구조 개요)을 포함할지 여부
 * @property includeFullInstructions - 전체 프로젝트 지침을 포함할지 여부
 * @property maxSystemPromptSections - 시스템 프롬프트에 포함할 최대 섹션 수
 */
export interface ContextStrategy {
  readonly includeRepoMap: boolean;
  readonly includeFullInstructions: boolean;
  readonly maxSystemPromptSections: number;
}

/**
 * 복잡한 작업을 나타내는 키워드 패턴들
 * 이 패턴이 매칭되면 복잡도 점수가 올라갑니다.
 *
 * 예: "refactor the auth module", "implement a new pipeline",
 *     "migrate to a new framework", "debug the intermittent race condition"
 */
const COMPLEX_INDICATORS: readonly RegExp[] = [
  /refactor/i,
  /architect/i,
  /redesign/i,
  /migrate/i,
  /implement\s+(?:a\s+)?(?:new\s+)?(?:system|module|feature|service|pipeline|framework)/i,
  /multi[- ]?(?:step|phase|stage)/i,
  /across\s+(?:multiple|all|several)\s+files/i,
  /end[- ]?to[- ]?end/i,
  /integration/i,
  /performance\s+(?:optimi|audit|profil)/i,
  /security\s+(?:audit|review|harden)/i,
  /debug.*(?:complex|intermittent|race|deadlock)/i,
];

/**
 * 간단한 작업을 나타내는 키워드 패턴들
 * 이 패턴이 매칭되면 복잡도 점수가 내려갑니다.
 *
 * 예: "fix a typo", "what is this function?", "run npm test", "find the file"
 */
const SIMPLE_INDICATORS: readonly RegExp[] = [
  /^(?:fix|change|update|rename|remove|delete|add)\s+(?:a\s+)?(?:typo|comment|import|line|variable|constant)/i,
  /^(?:what|where|how|which|show|explain|describe|list)\b/i,
  /^read\s/i,
  /^run\s/i,
  /^check\s/i,
  /^cat\s/i,
  /^ls\b/i,
  /^find\s+(?:the\s+)?(?:file|function|class|variable|import)/i,
];

/** 단어 수 기반 복잡도 판단 임계값 */
const MODERATE_WORD_THRESHOLD = 30; // 30단어 이상이면 "보통" 수준으로 점수 증가
const COMPLEX_WORD_THRESHOLD = 80; // 80단어 이상이면 "복잡" 수준으로 점수 증가

/** 파일 참조 패턴 — 입력에서 파일명(.ts, .py 등)을 감지 */
const FILE_REFERENCE_PATTERN =
  /(?:[\w.-]+\.(?:ts|js|tsx|jsx|py|go|rs|java|rb|css|html|json|yaml|yml|toml|md))/g;

/** 파일 참조가 이 개수 이상이면 복잡도 점수 증가 */
const MULTI_FILE_THRESHOLD = 3;

/**
 * 사용자 입력 텍스트로부터 작업 복잡도를 추정합니다.
 *
 * 점수 기반 휴리스틱을 사용하며, 다음 요소들을 종합적으로 평가합니다:
 * 1. 키워드 패턴 매칭 (복잡한 키워드 = +2, 간단한 키워드 = -2)
 * 2. 입력 길이 (단어 수가 많을수록 복잡한 작업일 가능성 높음)
 * 3. 파일 참조 수 (여러 파일을 언급하면 복잡한 작업일 가능성 높음)
 *
 * 최종 점수:
 * - 3점 이상: "complex" (복잡)
 * - 1~2점: "moderate" (보통)
 * - 0점 이하: "simple" (간단)
 *
 * @param input - 사용자의 원본 입력 텍스트
 * @returns 추정된 작업 복잡도
 */
export function estimateTaskComplexity(input: string): TaskComplexity {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "simple";
  }

  let score = 0;

  // 복잡한 키워드가 있으면 점수 +2
  for (const pattern of COMPLEX_INDICATORS) {
    if (pattern.test(trimmed)) {
      score += 2;
    }
  }

  // 간단한 키워드가 있으면 점수 -2
  for (const pattern of SIMPLE_INDICATORS) {
    if (pattern.test(trimmed)) {
      score -= 2;
    }
  }

  // 단어 수에 따른 점수 보정
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= COMPLEX_WORD_THRESHOLD) {
    score += 2; // 80단어 이상 -> 매우 긴 설명 = 복잡한 작업
  } else if (wordCount >= MODERATE_WORD_THRESHOLD) {
    score += 1; // 30단어 이상 -> 어느 정도 긴 설명
  }

  // 파일 참조 수에 따른 점수 보정
  const fileMatches = trimmed.match(FILE_REFERENCE_PATTERN);
  const fileRefCount = fileMatches ? fileMatches.length : 0;
  if (fileRefCount >= MULTI_FILE_THRESHOLD) {
    score += 1; // 3개 이상 파일 참조 -> 다중 파일 작업
  }

  // 최종 점수를 복잡도 수준으로 매핑
  if (score >= 3) {
    return "complex";
  }
  if (score >= 1) {
    return "moderate";
  }
  return "simple";
}

/**
 * 주어진 작업 복잡도에 맞는 컨텍스트 로딩 전략을 반환합니다.
 *
 * - simple: 최소 컨텍스트 (레포 맵 없음, 축약 지침, 적은 섹션 수)
 *   -> 빠른 응답이 중요한 간단한 질문/명령에 적합
 *
 * - moderate: 균형 잡힌 컨텍스트 (레포 맵 포함, 전체 지침, 적당한 섹션 수)
 *   -> 일반적인 개발 작업에 적합
 *
 * - complex: 전체 컨텍스트 (모든 정보 로드, 최대 섹션 수)
 *   -> 대규모 리팩토링, 아키텍처 설계 등에 적합
 *
 * @param complexity - 추정된 작업 복잡도
 * @returns 해당 복잡도에 맞는 컨텍스트 전략
 */
export function getContextStrategy(complexity: TaskComplexity): ContextStrategy {
  switch (complexity) {
    case "simple":
      return {
        includeRepoMap: false,
        includeFullInstructions: false,
        maxSystemPromptSections: 4,
      };
    case "moderate":
      return {
        includeRepoMap: true,
        includeFullInstructions: true,
        maxSystemPromptSections: 8,
      };
    case "complex":
      return {
        includeRepoMap: true,
        includeFullInstructions: true,
        maxSystemPromptSections: 16,
      };
  }
}
