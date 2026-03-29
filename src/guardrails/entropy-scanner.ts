/**
 * 엔트로피 스캐너 — 코드 내 변수 할당에서 높은 엔트로피 값을 탐지하는 보안 모듈
 *
 * Shannon 엔트로피(정보 엔트로피)를 사용하여 문자열의 무작위성을 측정합니다.
 * 일반 영어 텍스트는 약 3.5비트/문자의 엔트로피를 가지지만,
 * 무작위로 생성된 API 키나 비밀번호는 약 5.0비트/문자 이상입니다.
 *
 * 이 모듈은 시크릿 스캐너(secret-scanner.ts)를 보완합니다:
 * - 시크릿 스캐너: 알려진 형식의 비밀 정보를 패턴 매칭으로 탐지
 * - 엔트로피 스캐너: 형식을 모르는 비밀 정보를 통계적으로 탐지
 *
 * 동작 방식:
 * 1. 코드에서 비밀 정보가 할당될 가능성이 높은 변수 패턴을 찾음
 *    (KEY, TOKEN, SECRET, PASSWORD 등의 이름을 가진 변수)
 * 2. 할당된 값의 Shannon 엔트로피를 계산
 * 3. 임계값(4.5비트/문자)을 초과하면 잠재적 비밀 정보로 플래그
 *
 * ReDoS 보호:
 * 긴 입력에 대해 정규식 실행 전 입력 길이를 제한하여
 * 역추적 폭발(catastrophic backtracking)을 방지합니다.
 */

import { getLogger } from "../utils/logger.js";

/**
 * 시크릿 후보 인터페이스 — 높은 엔트로피가 탐지된 변수 할당 정보
 *
 * @property value - 탐지된 값의 처음 8자 + "..." (보안을 위해 전체 값은 숨김)
 * @property entropy - 계산된 Shannon 엔트로피 (비트/문자, 소수점 2자리)
 * @property line - 값이 발견된 줄 번호 (1부터 시작)
 * @property pattern - 매칭된 변수 이름 또는 패턴 이름
 */
export interface SecretCandidate {
  readonly value: string; // first 8 chars + "..."
  readonly entropy: number;
  readonly line: number;
  readonly pattern: string; // variable name pattern that matched
}

/** ReDoS 보호를 위한 최대 입력 길이 (문자 수) */
const SAFE_REGEX_INPUT_LIMIT = 50_000;

/**
 * ReDoS 방지를 위한 안전한 정규식 exec 래퍼
 *
 * 엔트로피 스캐너는 소스 코드 전체를 대상으로 정규식을 실행하므로
 * 입력이 매우 길 수 있습니다. 50,000자를 초과하는 입력은
 * 잘라서 실행하여 역추적 폭발을 방지합니다.
 *
 * @param pattern - 실행할 정규식 (/g 플래그 포함)
 * @param input - 검사할 입력 문자열
 * @returns exec 결과 또는 null
 */
function safeRegexExec(pattern: RegExp, input: string): RegExpExecArray | null {
  if (input.length > SAFE_REGEX_INPUT_LIMIT) {
    const logger = getLogger();
    logger.warn(
      { inputLength: input.length, limit: SAFE_REGEX_INPUT_LIMIT, pattern: pattern.source.slice(0, 60) },
      "ReDoS protection: input truncated for entropy scanner regex exec",
    );
    const truncated = input.slice(0, SAFE_REGEX_INPUT_LIMIT);
    return pattern.exec(truncated);
  }

  return pattern.exec(input);
}

/**
 * 비밀 정보가 할당될 가능성이 높은 변수 할당 패턴 목록
 *
 * 각 패턴의 정규식은 두 개의 캡처 그룹을 가집니다:
 * - 그룹 1: 변수 이름 (예: API_KEY, secretToken)
 * - 그룹 2: 할당된 값 (예: "sk-abc123...")
 *
 * 다양한 프로그래밍 언어와 설정 파일 형식을 지원합니다.
 */
const ASSIGNMENT_PATTERNS: readonly { readonly name: string; readonly regex: RegExp }[] = [
  // KEY = "value" 또는 KEY = 'value' 형태
  // 변수 이름에 KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, AUTH, API_KEY가 포함된 경우
  // [A-Z_][A-Z0-9_]* : 대문자로 시작하는 상수 스타일 변수명
  // ["']([^"']{8,})["'] : 따옴표로 감싼 8자 이상의 값
  {
    name: "quoted_assignment",
    regex:
      /\b([A-Z_][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|API_KEY))\s*[:=]\s*["']([^"']{8,})["']/gi,
  },

  // export KEY="value" 형태 (쉘 스크립트의 환경변수 내보내기)
  // \bexport\s+ : "export " 키워드로 시작
  {
    name: "export_assignment",
    regex: /\bexport\s+([A-Z_][A-Z0-9_]*)\s*=\s*["']([^"']{8,})["']/gi,
  },

  // const/let/var name = "value" 형태 (JavaScript/TypeScript)
  // 변수 이름에 key, token, secret, password, credential, auth가 포함된 경우
  // \w* : 접두사/접미사에 임의의 단어 문자 허용
  {
    name: "js_const_assignment",
    regex:
      /\b(?:const|let|var)\s+(\w*(?:key|token|secret|password|credential|auth)\w*)\s*=\s*["']([^"']{8,})["']/gi,
  },

  // YAML 형식: key: value (따옴표 없는 값)
  // ^[ \t]* : 줄 시작에 공백/탭 허용
  // [^\s#"']{12,} : 12자 이상의 공백/주석/따옴표가 아닌 문자열
  // /m : 여러 줄 모드 (^가 각 줄의 시작을 의미)
  {
    name: "yaml_assignment",
    regex:
      /^[ \t]*(\w*(?:key|token|secret|password|credential|auth)\w*)\s*:\s*([^\s#"']{12,})\s*$/gim,
  },

  // 일반적인 비밀 변수 이름 패턴: api_key, access_key, secret_key, private_key, auth_token
  // [-]? : 하이픈도 허용 (api-key 형태)
  // ["']? : 따옴표 유무 모두 매칭
  {
    name: "generic_assignment",
    regex:
      /\b(\w*(?:api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|auth[_-]?token)\w*)\s*[:=]\s*["']?([^\s"']{12,})["']?/gi,
  },
];

/**
 * 문자열의 Shannon 엔트로피를 계산합니다.
 *
 * Shannon 엔트로피(정보 엔트로피)란 문자열의 무작위성(정보 밀도)을
 * 측정하는 수학적 지표입니다. Claude Shannon이 1948년 정보이론에서 제안했습니다.
 *
 * 계산 공식: H = -Σ p(x) * log2(p(x))
 * 여기서 p(x)는 각 문자의 출현 확률입니다.
 *
 * 엔트로피 기준값:
 * - 0 비트: 모든 문자가 동일 ("aaaaaa")
 * - ~3.5 비트: 일반 영어 텍스트 ("hello world")
 * - ~4.0 비트: 구조화된 코드/데이터
 * - ~4.5 비트 이상: 무작위/암호화된 문자열 (API 키, 비밀번호)
 * - ~6.0 비트: 완전히 무작위인 문자열
 *
 * @param str - 엔트로피를 계산할 문자열
 * @returns 비트/문자 단위의 엔트로피 값 (0 ~ log2(고유 문자 수))
 *
 * @example
 * ```ts
 * shannonEntropy("aaaaaa");                    // 0 (엔트로피 없음)
 * shannonEntropy("hello");                     // ~2.0
 * shannonEntropy("sk-abc123XYZ!@#$%^");        // ~4.5+ (높은 엔트로피)
 * ```
 */
export function shannonEntropy(str: string): number {
  if (str.length === 0) {
    return 0;
  }

  // 1단계: 각 문자의 출현 빈도를 계산
  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  // 2단계: Shannon 엔트로피 공식 적용
  // H = -Σ p(x) * log2(p(x))
  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len; // 각 문자의 출현 확률
    if (p > 0) {
      entropy -= p * Math.log2(p); // 정보량의 기대값을 누적
    }
  }

  return entropy;
}

/**
 * 비밀 정보로 의심되는 문자열의 엔트로피 임계값 (비트/문자)
 *
 * 4.5비트는 보수적인 기준입니다:
 * - 일반 영어 텍스트는 약 3.5~4.0비트 → 오탐(false positive)이 적음
 * - 무작위 16진수/Base64 문자열은 약 4.5~6.0비트 → 대부분 탐지됨
 * - 너무 낮으면 일반 코드가 오탐, 너무 높으면 약한 비밀번호를 놓침
 */
const ENTROPY_THRESHOLD = 4.5;

/**
 * 엔트로피 분석 대상의 최소 문자열 길이
 *
 * 8자 미만의 짧은 문자열은 자연스럽게 낮은 엔트로피 다양성을 가지므로
 * 의미 있는 분석이 어렵습니다. (예: "abc" → 엔트로피 ~1.58)
 */
const MIN_VALUE_LENGTH = 8;

/**
 * 코드/설정 파일에서 높은 엔트로피의 비밀 정보 후보를 탐지합니다.
 *
 * 동작 과정:
 * 1. 코드에서 비밀 정보 할당 패턴(KEY=, TOKEN=, SECRET= 등)을 검색
 * 2. 각 할당값의 Shannon 엔트로피를 계산
 * 3. 임계값(4.5비트/문자)을 초과하는 값을 후보로 기록
 * 4. 같은 줄에서 중복 탐지된 후보를 제거
 *
 * @param content - 검사할 소스 코드 또는 설정 파일 내용
 * @returns 탐지된 높은 엔트로피 비밀 정보 후보 배열
 *
 * @example
 * ```ts
 * const candidates = detectHighEntropySecrets('const API_KEY = "xK9mP2nQ5rT8vW1y"');
 * // candidates[0].entropy > 4.5
 * // candidates[0].pattern === "API_KEY"
 * ```
 */
export function detectHighEntropySecrets(content: string): readonly SecretCandidate[] {
  const candidates: SecretCandidate[] = [];

  // 줄 번호를 빠르게 조회하기 위한 줄 시작 위치 맵 생성
  const lineStarts: readonly number[] = buildLineStarts(content);

  for (const { name, regex } of ASSIGNMENT_PATTERNS) {
    // 각 패턴마다 새로운 RegExp 객체를 생성하여 lastIndex 상태 초기화
    // (전역 플래그 /g가 있는 정규식은 lastIndex를 공유하므로 재사용 시 오작동 가능)
    const pattern = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;

    // exec()을 반복 호출하여 모든 매칭을 순회
    while ((match = safeRegexExec(pattern, content)) !== null) {
      const variableName = match[1]; // 캡처 그룹 1: 변수 이름
      const value = match[2]; // 캡처 그룹 2: 할당된 값

      // 최소 길이 미만의 값은 건너뜀
      if (!value || value.length < MIN_VALUE_LENGTH) {
        continue;
      }

      // 할당된 값의 Shannon 엔트로피 계산
      const entropy = shannonEntropy(value);

      // 임계값 이상이면 잠재적 비밀 정보로 기록
      if (entropy >= ENTROPY_THRESHOLD) {
        // match.index: 매칭이 시작된 문자 위치 → 줄 번호로 변환
        const lineNumber = getLineNumber(lineStarts, match.index);
        // 보안을 위해 값의 처음 8자만 표시하고 나머지는 "..."으로 대체
        const truncatedValue = value.length > 8 ? value.slice(0, 8) + "..." : value;

        candidates.push({
          value: truncatedValue,
          entropy: Math.round(entropy * 100) / 100, // 소수점 2자리로 반올림
          line: lineNumber,
          pattern: variableName ?? name,
        });
      }
    }
  }

  // 같은 줄에서 같은 값이 중복 탐지된 경우 제거
  return deduplicateCandidates(candidates);
}

/**
 * 텍스트 내용에서 각 줄의 시작 문자 오프셋 배열을 생성합니다.
 *
 * 이 배열은 문자 오프셋을 줄 번호로 빠르게 변환하기 위해 사용됩니다.
 * 이진 탐색(binary search)으로 O(log n) 시간에 줄 번호를 조회할 수 있습니다.
 *
 * @param content - 원본 텍스트
 * @returns 각 줄의 시작 문자 오프셋 배열 (인덱스 0 = 1번째 줄의 시작 = 0)
 *
 * @example
 * ```ts
 * buildLineStarts("abc\ndef\n");
 * // [0, 4, 8] — 1번째 줄은 0에서, 2번째 줄은 4에서, 3번째 줄은 8에서 시작
 * ```
 */
function buildLineStarts(content: string): readonly number[] {
  const starts: number[] = [0]; // 첫 번째 줄은 항상 오프셋 0에서 시작
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") {
      starts.push(i + 1); // 줄바꿈 다음 문자가 새로운 줄의 시작
    }
  }
  return starts;
}

/**
 * 문자 오프셋을 1 기반 줄 번호로 변환합니다. (이진 탐색 사용)
 *
 * 이진 탐색(Binary Search)이란 정렬된 배열에서 값을 찾는 효율적인 알고리즘입니다.
 * 배열의 중간값과 비교하여 탐색 범위를 절반으로 줄여나갑니다. (O(log n))
 *
 * @param lineStarts - buildLineStarts()에서 생성한 줄 시작 오프셋 배열
 * @param offset - 변환할 문자 오프셋 (정규식 매칭의 index 값)
 * @returns 1 기반 줄 번호
 */
function getLineNumber(lineStarts: readonly number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;

  while (low <= high) {
    // >>> 1 : 부호 없는 오른쪽 시프트로 2로 나누기 (오버플로우 방지)
    const mid = (low + high) >>> 1;
    if (lineStarts[mid] <= offset) {
      low = mid + 1; // 줄 시작이 오프셋 이하이면 더 뒤쪽 줄을 탐색
    } else {
      high = mid - 1; // 줄 시작이 오프셋보다 크면 더 앞쪽 줄을 탐색
    }
  }

  return low; // 1 기반 줄 번호 (low가 해당 오프셋을 포함하는 줄)
}

/**
 * 같은 줄과 같은 값을 가진 중복 후보를 제거합니다.
 *
 * 여러 할당 패턴이 동일한 변수 할당을 매칭할 수 있으므로,
 * "줄 번호:잘린 값"을 키로 사용하여 중복을 제거합니다.
 *
 * @param candidates - 중복이 포함될 수 있는 후보 배열
 * @returns 중복이 제거된 후보 배열
 */
function deduplicateCandidates(candidates: readonly SecretCandidate[]): readonly SecretCandidate[] {
  const seen = new Set<string>();
  const unique: SecretCandidate[] = [];

  for (const candidate of candidates) {
    // "줄번호:값" 형태의 고유 키 생성
    const key = `${candidate.line}:${candidate.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }

  return unique;
}
