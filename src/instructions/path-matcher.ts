/**
 * 경로 기반 조건부 규칙 매칭 모듈 — 작업 디렉토리/파일 경로에 따라 적용할 규칙 결정
 *
 * .dhelix/rules/ 디렉토리의 규칙 파일에 프론트매터로 경로 패턴을 지정하면,
 * 해당 경로에서 작업할 때만 해당 규칙이 시스템 프롬프트에 포함됩니다.
 *
 * 예시: .dhelix/rules/frontend.md
 * ---
 * paths:
 *   - "src/components/**"
 *   - "src/pages/**"
 * ---
 * React 컴포넌트는 함수형으로 작성하세요...
 *
 * → src/components/Button.tsx 작업 시에만 이 규칙이 적용됩니다.
 *
 * glob 패턴 지원:
 * - * : 슬래시(/)를 제외한 모든 문자 (한 디렉토리 레벨)
 * - ** : 슬래시를 포함한 모든 문자 (여러 디렉토리 레벨)
 * - ? : 슬래시를 제외한 단일 문자
 */

/**
 * 경로 기반 규칙 조건 인터페이스 — 여러 glob 패턴을 지원
 *
 * patterns 배열의 패턴 중 하나라도 일치하면 이 규칙이 적용됩니다 (OR 조건).
 */
export interface PathRule {
  /** 경로 매칭에 사용할 glob 패턴 배열 (하나라도 매칭되면 적용) */
  readonly patterns: readonly string[];
  /** 패턴이 매칭될 때 시스템 프롬프트에 포함할 규칙 내용 */
  readonly content: string;
  /** 규칙에 대한 선택적 설명 (디버깅/로깅용) */
  readonly description?: string;
}

/**
 * @deprecated PathRule의 patterns 배열을 사용하세요.
 * 단일 pattern 필드를 사용하는 이전 버전과의 호환을 위해 유지됩니다.
 */
export interface LegacyPathRule {
  /** 단일 glob 패턴 */
  readonly pattern: string;
  /** 패턴 매칭 시 포함할 내용 */
  readonly content: string;
  /** 규칙 설명 */
  readonly description?: string;
}

/**
 * 이전 형식(단일 패턴)의 규칙을 새 형식(패턴 배열)으로 변환
 *
 * @param rule - 변환할 이전 형식 규칙
 * @returns 새 형식의 PathRule (patterns 배열에 단일 패턴 포함)
 */
export function normalizeLegacyRule(rule: LegacyPathRule): PathRule {
  return {
    patterns: [rule.pattern],
    content: rule.content,
    description: rule.description,
  };
}

/**
 * glob 패턴을 정규식(RegExp)으로 변환하는 내부 함수
 *
 * 변환 규칙:
 * - ** → .* (슬래시 포함 모든 문자, 여러 디렉토리 횡단)
 * - * → [^/]* (슬래시 제외 모든 문자, 한 디렉토리 내)
 * - ? → [^/] (슬래시 제외 단일 문자)
 * - . → \\. (리터럴 점)
 * - 백슬래시는 슬래시로 정규화 (Windows 호환)
 *
 * @param pattern - 변환할 glob 패턴 문자열
 * @returns 대소문자 무시하는 정규식 객체
 */
function globToRegex(pattern: string): RegExp {
  // 백슬래시를 슬래시로 정규화 (Windows 경로 호환)
  const normalized = pattern.replace(/\\/g, "/");
  let regex = "";
  let i = 0;

  while (i < normalized.length) {
    const char = normalized[i];

    if (char === "*") {
      if (normalized[i + 1] === "*") {
        // ** — 모든 문자 매칭 (슬래시 포함, 여러 디렉토리 횡단)
        regex += ".*";
        i += 2;
        // **/ 의 후행 슬래시 건너뜀
        if (normalized[i] === "/") i++;
        continue;
      }
      // * — 슬래시를 제외한 모든 문자 매칭 (한 디렉토리 레벨)
      regex += "[^/]*";
      i++;
      continue;
    }

    if (char === "?") {
      // ? — 슬래시를 제외한 단일 문자 매칭
      regex += "[^/]";
      i++;
      continue;
    }

    if (char === ".") {
      // . → \\. (정규식에서 .은 모든 문자를 의미하므로 이스케이프 필요)
      regex += "\\.";
      i++;
      continue;
    }

    // 그 외 문자는 그대로 사용
    regex += char;
    i++;
  }

  // ^와 $로 감싸서 전체 문자열 매칭, 대소문자 무시
  return new RegExp(`^${regex}$`, "i");
}

/**
 * 경로가 단일 glob 패턴과 일치하는지 확인
 *
 * @param path - 확인할 파일/디렉토리 경로
 * @param pattern - 매칭할 glob 패턴
 * @returns 패턴과 일치하면 true
 */
export function matchPath(path: string, pattern: string): boolean {
  // 백슬래시를 슬래시로 정규화 (Windows 경로 호환)
  const normalized = path.replace(/\\/g, "/");
  const regex = globToRegex(pattern);
  return regex.test(normalized);
}

/**
 * 경로가 주어진 패턴 배열 중 하나라도 일치하는지 확인 (OR 조건)
 *
 * @param path - 확인할 경로
 * @param patterns - 매칭할 glob 패턴 배열
 * @returns 패턴 중 하나라도 일치하면 true
 */
export function matchAnyPattern(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchPath(path, pattern));
}

/**
 * 주어진 경로에 매칭되는 규칙만 필터링
 *
 * 규칙의 patterns 배열 중 하나라도 currentPath와 일치하면 해당 규칙을 포함합니다.
 *
 * @param rules - 필터링할 규칙 배열
 * @param currentPath - 현재 작업 경로
 * @returns 매칭된 규칙만 포함한 배열
 */
export function filterMatchingRules(
  rules: readonly PathRule[],
  currentPath: string,
): readonly PathRule[] {
  return rules.filter((rule) => matchAnyPattern(currentPath, rule.patterns));
}

/**
 * 매칭된 규칙의 내용을 모두 수집하여 하나의 문자열로 합침
 *
 * 여러 규칙이 매칭되면 각 규칙의 content를 빈 줄로 구분하여 연결합니다.
 *
 * @param rules - 검색할 규칙 배열
 * @param currentPath - 현재 작업 경로
 * @returns 매칭된 규칙의 내용을 합친 문자열 (매칭 없으면 빈 문자열)
 */
export function collectMatchingContent(rules: readonly PathRule[], currentPath: string): string {
  const matching = filterMatchingRules(rules, currentPath);
  if (matching.length === 0) return "";
  return matching.map((r) => r.content).join("\n\n");
}
