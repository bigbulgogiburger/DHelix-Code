/**
 * TOML Execution Policy Engine — 도구별 실행 정책을 TOML/객체로 정의하고 평가하는 모듈
 *
 * 정책은 각 도구에 대해 기본 동작(allow/ask/deny)과
 * 세부 glob 패턴 규칙을 정의합니다.
 *
 * Longest-match-wins 전략 (specificity-first):
 * 1. deny 패턴이 먼저 평가됩니다
 * 2. allow 패턴이 그 다음 평가됩니다
 * 3. ask 패턴이 그 다음 평가됩니다
 * 4. 매칭되는 패턴이 없으면 defaultAction을 사용합니다
 *
 * 특이도(specificity)는 패턴 길이와 와일드카드 수로 결정됩니다.
 *
 * @example TOML 설정 예시
 * ```toml
 * [tool.bash_exec]
 * defaultAction = "ask"
 * timeoutMs = 30000
 * maxOutputBytes = 1048576
 * allow = ["npm install", "npm run *", "git *"]
 * deny = ["rm -rf *", "sudo *", "curl * | *"]
 *
 * [tool.file_read]
 * defaultAction = "allow"
 * ```
 */

/**
 * 도구별 정책 규칙 목록
 */
export interface PolicyRules {
  /** 명시적으로 허용할 glob 패턴 목록 */
  readonly allow?: readonly string[];
  /** 사용자 확인이 필요한 glob 패턴 목록 */
  readonly ask?: readonly string[];
  /** 명시적으로 거부할 glob 패턴 목록 */
  readonly deny?: readonly string[];
}

/**
 * 도구에 대한 전체 정책 정의
 */
export interface ToolPolicy {
  /** 매칭되는 패턴이 없을 때의 기본 동작 */
  readonly defaultAction: "allow" | "ask" | "deny";
  /** 도구 실행 타임아웃 (밀리초) */
  readonly timeoutMs?: number;
  /** 최대 출력 크기 (바이트) */
  readonly maxOutputBytes?: number;
  /** 세부 패턴 규칙 */
  readonly rules: PolicyRules;
}

/**
 * glob 패턴의 특이도(specificity)를 계산합니다.
 * 와일드카드가 적을수록, 패턴이 길수록 특이도가 높습니다.
 *
 * @param pattern - 분석할 glob 패턴
 * @returns 특이도 점수 (높을수록 우선순위 높음)
 */
function patternSpecificity(pattern: string): number {
  const wildcardCount = (pattern.match(/[*?]/g) ?? []).length;
  return pattern.length - wildcardCount * 10;
}

/**
 * 값이 glob 패턴과 매칭되는지 검사합니다.
 *
 * @param value - 검사할 문자열
 * @param pattern - glob 패턴 (* = 임의의 문자열, ? = 임의의 한 문자)
 * @returns 매칭 여부
 */
function matchGlob(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(value);
}

/**
 * 패턴 목록 중 주어진 값과 매칭되는 가장 특이도 높은 패턴을 반환합니다.
 *
 * @param patterns - 검사할 glob 패턴 목록
 * @param value - 비교할 값
 * @returns 매칭된 패턴 (없으면 undefined)
 */
function findBestMatch(
  patterns: readonly string[] | undefined,
  value: string,
): string | undefined {
  if (!patterns || patterns.length === 0) return undefined;

  const matched = patterns.filter((p) => matchGlob(value, p));
  if (matched.length === 0) return undefined;

  // 가장 특이도 높은 패턴 반환
  return matched.reduce((best, p) =>
    patternSpecificity(p) > patternSpecificity(best) ? p : best,
  );
}

// ─── 미니 TOML 파서 ──────────────────────────────────────────────────────────

/**
 * TOML 파싱 에러
 */
export class TomlParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(`TOML parse error at line ${line}: ${message}`);
    this.name = "TomlParseError";
  }
}

/**
 * TOML 값 타입
 */
type TomlValue = string | number | boolean | string[] | TomlObject;
type TomlObject = { [key: string]: TomlValue };

/**
 * 간단한 TOML 파서 — [tool.xxx] 섹션, key=value, 배열을 지원합니다.
 * 외부 의존성 없이 직접 구현한 최소 TOML 파서입니다.
 *
 * 지원 기능:
 * - 섹션: [tool.bash_exec]
 * - 문자열: key = "value"
 * - 숫자: key = 1234
 * - 불리언: key = true / false
 * - 문자열 배열: key = ["a", "b", "c"]
 * - # 주석
 *
 * @param content - TOML 문자열
 * @returns 파싱된 객체 트리
 * @throws TomlParseError - 파싱 실패 시
 */
function parseToml(content: string): TomlObject {
  const result: TomlObject = {};
  const lines = content.split(/\r?\n/);
  let currentObj: TomlObject = result;
  let lineNum = 0;

  for (const rawLine of lines) {
    lineNum++;
    const line = rawLine.trim();

    // 빈 줄 / 주석
    if (line === "" || line.startsWith("#")) continue;

    // 섹션 헤더: [tool.bash_exec]
    if (line.startsWith("[") && !line.startsWith("[[")) {
      if (!line.endsWith("]")) {
        throw new TomlParseError("Unclosed section header", lineNum);
      }
      const sectionPath = line.slice(1, -1).trim();
      if (sectionPath === "") {
        throw new TomlParseError("Empty section name", lineNum);
      }

      // 중첩 섹션 경로 생성 (예: "tool.bash_exec" → result.tool.bash_exec)
      const parts = sectionPath.split(".");
      currentObj = result;
      for (const part of parts) {
        const p = part.trim();
        if (!p) throw new TomlParseError(`Invalid section path: ${sectionPath}`, lineNum);
        if (!(p in currentObj)) {
          currentObj[p] = {};
        }
        const next = currentObj[p];
        if (typeof next !== "object" || Array.isArray(next)) {
          throw new TomlParseError(`Section path conflict at "${p}"`, lineNum);
        }
        currentObj = next as TomlObject;
      }
      continue;
    }

    // key = value 쌍
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      throw new TomlParseError(`Expected key = value, got: ${line}`, lineNum);
    }

    const key = line.slice(0, eqIdx).trim();
    const rawVal = line.slice(eqIdx + 1).trim();

    if (!key) throw new TomlParseError("Empty key", lineNum);

    currentObj[key] = parseTomlValue(rawVal, lineNum);
  }

  return result;
}

/**
 * TOML 값 문자열을 적절한 타입으로 파싱합니다.
 */
function parseTomlValue(raw: string, lineNum: number): TomlValue {
  const s = raw.trim();

  // 불리언
  if (s === "true") return true;
  if (s === "false") return false;

  // 숫자 (인라인 주석 제거 후 검사)
  const noCommentBare = stripInlineComment(s);
  if (/^-?\d+(\.\d+)?$/.test(noCommentBare)) return Number(noCommentBare);

  // 문자열 (큰따옴표) — 닫는 따옴표를 직접 탐색하여 인라인 주석 처리
  if (s.startsWith('"')) {
    let i = 1;
    let str = "";
    while (i < s.length && s[i] !== '"') {
      if (s[i] === "\\" && i + 1 < s.length) {
        const esc = s[i + 1];
        if (esc === "n") str += "\n";
        else if (esc === "t") str += "\t";
        else if (esc === '"') str += '"';
        else if (esc === "\\") str += "\\";
        else str += esc ?? "";
        i += 2;
      } else {
        str += s[i];
        i++;
      }
    }
    // i가 닫는 따옴표를 가리키거나 문자열 끝에 도달 (관대하게 처리)
    return str;
  }

  // 배열
  if (s.startsWith("[")) {
    return parseTomlArray(s, lineNum);
  }

  // 따옴표 없는 문자열 (fallback — 주석 제거)
  return noCommentBare;
}

/**
 * 따옴표 없는 TOML 값에서 인라인 주석을 제거합니다.
 * 따옴표 문자열 내부의 # 는 무시합니다.
 */
function stripInlineComment(s: string): string {
  const commentIdx = s.indexOf("#");
  return commentIdx >= 0 ? s.slice(0, commentIdx).trim() : s.trim();
}

/**
 * TOML 인라인 배열을 파싱합니다.
 * ["a", "b", "c"] 형식만 지원합니다 (문자열 배열).
 */
function parseTomlArray(raw: string, lineNum: number): string[] {
  // 닫는 ] 찾기 (멀티라인 미지원)
  const endIdx = raw.lastIndexOf("]");
  if (endIdx === -1) throw new TomlParseError("Unclosed array", lineNum);

  const inner = raw.slice(1, endIdx).trim();
  if (inner === "") return [];

  const items: string[] = [];
  let i = 0;

  while (i < inner.length) {
    // 공백 스킵
    while (i < inner.length && /\s/.test(inner[i]!)) i++;
    if (i >= inner.length) break;

    if (inner[i] === '"') {
      // 따옴표 문자열
      i++; // opening "
      let str = "";
      while (i < inner.length && inner[i] !== '"') {
        if (inner[i] === "\\" && i + 1 < inner.length) {
          const esc = inner[i + 1];
          if (esc === "n") str += "\n";
          else if (esc === "t") str += "\t";
          else if (esc === '"') str += '"';
          else if (esc === "\\") str += "\\";
          else str += esc ?? "";
          i += 2;
        } else {
          str += inner[i];
          i++;
        }
      }
      if (i >= inner.length) throw new TomlParseError("Unterminated string in array", lineNum);
      i++; // closing "
      items.push(str);
    } else if (inner[i] === ",") {
      i++;
    } else if (inner[i] === "#") {
      break; // 인라인 주석
    } else {
      // 따옴표 없는 값 (숫자, 불리언, bare string)
      let bare = "";
      while (i < inner.length && inner[i] !== "," && inner[i] !== "]" && inner[i] !== "#") {
        bare += inner[i];
        i++;
      }
      items.push(bare.trim());
    }
  }

  return items;
}

// ─── PolicyEngine ─────────────────────────────────────────────────────────────

/**
 * TOML Execution Policy Engine
 *
 * 도구별 실행 정책을 로드하고, 실제 도구 호출에 대한 허용/확인/거부 결정을 내립니다.
 *
 * @example
 * ```ts
 * const engine = new PolicyEngine();
 * engine.loadFromToml(`
 *   [tool.bash_exec]
 *   defaultAction = "ask"
 *   allow = ["npm *", "git *"]
 *   deny = ["rm -rf *"]
 * `);
 *
 * engine.evaluate("bash_exec", "npm install"); // "allow"
 * engine.evaluate("bash_exec", "rm -rf /");    // "deny"
 * engine.evaluate("bash_exec", "curl example.com"); // "ask"
 * ```
 */
export class PolicyEngine {
  private readonly policies: Map<string, ToolPolicy> = new Map();

  /**
   * TOML 문자열에서 정책을 로드합니다.
   *
   * 기존 정책에 병합(merge)됩니다. 동일 도구 이름은 덮어씁니다.
   *
   * @param content - TOML 형식의 정책 문자열
   * @throws TomlParseError - TOML 파싱 실패 시
   */
  loadFromToml(content: string): void {
    const parsed = parseToml(content);
    const toolSection = parsed["tool"];

    if (!toolSection || typeof toolSection !== "object" || Array.isArray(toolSection)) {
      return; // [tool.*] 섹션 없음 — 경고 없이 넘김
    }

    for (const [toolName, rawPolicy] of Object.entries(toolSection as TomlObject)) {
      if (typeof rawPolicy !== "object" || Array.isArray(rawPolicy)) continue;
      const policy = this.objectToToolPolicy(rawPolicy as TomlObject);
      this.policies.set(toolName, policy);
    }
  }

  /**
   * 객체(Record)에서 정책을 로드합니다.
   *
   * 타입스크립트 코드에서 직접 정책을 설정할 때 유용합니다.
   *
   * @param policies - 도구 이름 → ToolPolicy 매핑
   */
  loadFromObject(policies: Record<string, ToolPolicy>): void {
    for (const [toolName, policy] of Object.entries(policies)) {
      this.policies.set(toolName, policy);
    }
  }

  /**
   * 도구 호출에 대한 정책 결정을 내립니다.
   *
   * 평가 순서 (specificity-first):
   * 1. deny 패턴 (가장 높은 우선순위)
   * 2. allow 패턴
   * 3. ask 패턴
   * 4. defaultAction (fallback)
   *
   * 각 카테고리 내에서는 패턴 특이도(길이 - 와일드카드 수)가
   * 높은 패턴이 우선합니다.
   *
   * @param toolName - 실행하려는 도구 이름
   * @param command - 도구에 전달되는 명령/인수 문자열
   * @returns "allow" | "ask" | "deny"
   */
  evaluate(toolName: string, command: string): "allow" | "ask" | "deny" {
    const policy = this.policies.get(toolName);
    if (!policy) return "ask"; // 정책 없음 → 기본 확인

    const { rules, defaultAction } = policy;

    // deny 패턴이 가장 높은 우선순위
    if (findBestMatch(rules.deny, command) !== undefined) return "deny";

    // allow 패턴
    if (findBestMatch(rules.allow, command) !== undefined) return "allow";

    // ask 패턴
    if (findBestMatch(rules.ask, command) !== undefined) return "ask";

    // 기본 동작
    return defaultAction;
  }

  /**
   * 특정 도구의 정책을 반환합니다.
   *
   * @param toolName - 도구 이름
   * @returns 등록된 정책, 없으면 undefined
   */
  getToolPolicy(toolName: string): ToolPolicy | undefined {
    return this.policies.get(toolName);
  }

  /**
   * 현재 등록된 모든 정책을 반환합니다.
   *
   * @returns 도구 이름 → ToolPolicy 매핑 객체
   */
  listPolicies(): Record<string, ToolPolicy> {
    return Object.fromEntries(this.policies.entries());
  }

  /**
   * 원시 객체(TomlObject)를 ToolPolicy 인터페이스로 변환합니다.
   */
  private objectToToolPolicy(raw: TomlObject): ToolPolicy {
    const defaultAction = this.parseAction(raw["defaultAction"]) ?? "ask";
    const timeoutMs = typeof raw["timeoutMs"] === "number" ? raw["timeoutMs"] : undefined;
    const maxOutputBytes =
      typeof raw["maxOutputBytes"] === "number" ? raw["maxOutputBytes"] : undefined;

    const allow = this.parseStringArray(raw["allow"]);
    const ask = this.parseStringArray(raw["ask"]);
    const deny = this.parseStringArray(raw["deny"]);

    return {
      defaultAction,
      ...(timeoutMs !== undefined && { timeoutMs }),
      ...(maxOutputBytes !== undefined && { maxOutputBytes }),
      rules: {
        ...(allow !== undefined && { allow }),
        ...(ask !== undefined && { ask }),
        ...(deny !== undefined && { deny }),
      },
    };
  }

  /** 문자열 값을 allow/ask/deny 중 하나로 파싱합니다. */
  private parseAction(value: TomlValue | undefined): "allow" | "ask" | "deny" | undefined {
    if (value === "allow" || value === "ask" || value === "deny") return value;
    return undefined;
  }

  /** TOML 값에서 문자열 배열을 추출합니다. */
  private parseStringArray(value: TomlValue | undefined): readonly string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.filter((v): v is string => typeof v === "string");
  }
}
