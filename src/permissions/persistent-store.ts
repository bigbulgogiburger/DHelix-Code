/**
 * 영구 권한 저장소 — settings.json 파일에 권한 규칙을 저장하고 로드하는 모듈
 *
 * 사용자가 "항상 허용" 또는 "항상 거부"를 선택하면, 그 결정이
 * settings.json 파일에 저장되어 다음 세션에서도 유지됩니다.
 *
 * 두 가지 저장 범위(scope)가 있습니다:
 * - project: 프로젝트별 설정 → {프로젝트}/.dbcode/settings.json
 * - user: 사용자 전체 설정 → ~/.dbcode/settings.json
 *
 * 우선순위 규칙:
 * 1. deny 규칙은 항상 allow 규칙보다 우선합니다 (안전 제일 원칙)
 * 2. project 범위 규칙은 user 범위 규칙을 덮어씁니다 (프로젝트별 커스터마이징)
 *
 * settings.json 내 권한 형식:
 * ```json
 * {
 *   "permissions": {
 *     "allow": ["file_read", "Bash(npm *)"],
 *     "deny": ["Bash(rm -rf *)"]
 *   }
 * }
 * ```
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { joinPath, dirName } from "../utils/path.js";
import { PROJECT_CONFIG_DIR } from "../constants.js";
import { parseRuleString, formatRuleString, matchToolArgs } from "./wildcard.js";

/**
 * 영구 권한 규칙 — settings.json에서 로드된 개별 규칙
 *
 * @property tool - 도구 이름 (예: "Bash", "file_read")
 * @property pattern - 선택적 인수 패턴 (예: "npm *")
 * @property type - "allow"(허용) 또는 "deny"(거부)
 * @property scope - "project"(프로젝트) 또는 "user"(사용자 전체)
 */
export interface PersistentPermissionRule {
  readonly tool: string;
  readonly pattern?: string;
  readonly type: "allow" | "deny";
  readonly scope: "project" | "user";
}

/**
 * settings.json 내 permissions 섹션의 구조
 *
 * @property allow - 허용 규칙 문자열 배열 (예: ["file_read", "Bash(npm *)"])
 * @property deny - 거부 규칙 문자열 배열 (예: ["Bash(rm -rf *)"])
 */
interface PermissionsConfig {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/**
 * 범위(scope)에 따른 settings.json 파일 경로를 반환합니다.
 *
 * @param scope - "project" 또는 "user"
 * @param projectDir - 프로젝트 루트 디렉토리 경로
 * @returns settings.json의 절대 경로
 *
 * @example
 * ```
 * settingsPath("project", "/home/user/my-app")
 * // → "/home/user/my-app/.dbcode/settings.json"
 *
 * settingsPath("user", "/home/user/my-app")
 * // → "/home/user/.dbcode/settings.json"
 * ```
 */
function settingsPath(scope: "project" | "user", projectDir: string): string {
  if (scope === "user") {
    return joinPath(homedir(), `.dbcode`, "settings.json");
  }
  return joinPath(projectDir, PROJECT_CONFIG_DIR, "settings.json");
}

/**
 * JSON 설정 파일을 안전하게 읽고 파싱합니다.
 *
 * 파일이 존재하지 않거나 파싱에 실패하면 빈 객체를 반환합니다.
 * 이는 설정 파일이 없는 상태(첫 실행)를 자연스럽게 처리하기 위함입니다.
 *
 * @param filePath - 읽을 JSON 파일의 절대 경로
 * @returns 파싱된 설정 객체 (실패 시 빈 객체)
 */
async function readSettingsFile(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    // 객체인지 확인 (배열이나 null은 유효한 설정이 아님)
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    // 파일이 없거나 JSON 파싱 실패 — 빈 설정으로 시작
    return {};
  }
}

/**
 * 설정 객체를 디스크에 저장합니다.
 *
 * 기존 파일의 내용과 얕은 병합(shallow merge)을 수행하여
 * 다른 설정 속성(permissions 외의 속성)이 보존됩니다.
 * 부모 디렉토리가 없으면 자동으로 생성합니다.
 *
 * @param filePath - 저장할 JSON 파일의 절대 경로
 * @param update - 병합할 설정 객체
 */
async function writeSettingsFile(filePath: string, update: Record<string, unknown>): Promise<void> {
  // 기존 설정을 읽어와서 업데이트 내용과 병합
  const existing = await readSettingsFile(filePath);
  const merged = { ...existing, ...update };

  // 부모 디렉토리가 없으면 생성 (recursive: true)
  await mkdir(dirName(filePath), { recursive: true });
  // JSON을 보기 좋게 포맷팅하여 저장 (2칸 들여쓰기 + 마지막 줄바꿈)
  await writeFile(filePath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

/**
 * 원시 설정 객체에서 permissions 섹션을 추출합니다.
 *
 * permissions 속성이 없거나 잘못된 형식이면 빈 allow/deny 배열을 반환합니다.
 * 문자열이 아닌 항목은 필터링하여 타입 안전성을 보장합니다.
 *
 * @param settings - 원시 설정 객체
 * @returns 정규화된 permissions 설정
 */
function extractPermissions(settings: Record<string, unknown>): PermissionsConfig {
  const perms = settings["permissions"];
  // permissions 속성이 없거나 객체가 아니면 빈 설정 반환
  if (perms === null || typeof perms !== "object" || Array.isArray(perms)) {
    return { allow: [], deny: [] };
  }

  const obj = perms as Record<string, unknown>;

  // 문자열만 필터링 (숫자나 객체가 실수로 포함된 경우 제외)
  const allow = Array.isArray(obj["allow"])
    ? (obj["allow"] as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  const deny = Array.isArray(obj["deny"])
    ? (obj["deny"] as unknown[]).filter((v): v is string => typeof v === "string")
    : [];

  return { allow, deny };
}

/**
 * 규칙 문자열 배열을 구조화된 PersistentPermissionRule 배열로 변환합니다.
 *
 * "Bash(npm *)" 형태의 문자열을 { tool: "Bash", pattern: "npm *", type, scope }
 * 형태의 구조화된 객체로 변환합니다.
 *
 * @param ruleStrings - 규칙 문자열 배열 (예: ["file_read", "Bash(npm *)"])
 * @param type - "allow" 또는 "deny"
 * @param scope - "project" 또는 "user"
 * @returns 구조화된 규칙 배열
 */
function parseRules(
  ruleStrings: readonly string[],
  type: "allow" | "deny",
  scope: "project" | "user",
): readonly PersistentPermissionRule[] {
  return ruleStrings.map((raw) => {
    // parseRuleString: "Bash(npm *)" → { tool: "Bash", pattern: "npm *" }
    const { tool, pattern } = parseRuleString(raw);
    return Object.freeze({ tool, pattern, type, scope });
  });
}

/**
 * 영구 권한 저장소 인터페이스
 *
 * settings.json 파일을 통해 권한 규칙을 읽고, 추가, 삭제, 검사하는
 * CRUD(생성/읽기/업데이트/삭제) 인터페이스를 제공합니다.
 *
 * 핵심 원칙: deny 규칙은 항상 allow 규칙보다 우선합니다.
 */
export interface PersistentPermissionStore {
  /** 양쪽 범위(project + user)에서 모든 규칙을 로드합니다 */
  loadRules(): Promise<readonly PersistentPermissionRule[]>;

  /** 새로운 규칙을 추가합니다 */
  addRule(rule: Omit<PersistentPermissionRule, "scope">, scope: "project" | "user"): Promise<void>;

  /** 규칙을 삭제합니다 */
  removeRule(tool: string, pattern?: string, scope?: "project" | "user"): Promise<void>;

  /** 특정 도구에 대한 모든 규칙을 가져옵니다 */
  getRulesForTool(tool: string): Promise<readonly PersistentPermissionRule[]>;

  /**
   * 도구 실행이 영구 규칙에 의해 허용/거부되는지 검사합니다.
   * @returns 'allow'(허용), 'deny'(거부), 또는 'none'(매칭 규칙 없음)
   */
  checkPermission(tool: string, args?: Record<string, unknown>): Promise<"allow" | "deny" | "none">;

  /** 특정 범위의 모든 규칙을 삭제합니다 */
  clearRules(scope: "project" | "user"): Promise<void>;
}

/**
 * 주어진 프로젝트 디렉토리에 대한 영구 권한 저장소를 생성합니다.
 *
 * 클로저(closure) 패턴을 사용하여 projectDir을 캡처하고,
 * 불변(freeze)된 저장소 객체를 반환합니다.
 *
 * @param projectDir - 프로젝트 루트 디렉토리 경로
 * @returns 영구 권한 저장소 인터페이스 구현체
 */
export function createPersistentPermissionStore(projectDir: string): PersistentPermissionStore {
  /**
   * 특정 범위의 settings.json에서 규칙을 로드합니다.
   *
   * @param scope - "project" 또는 "user"
   * @returns 해당 범위의 모든 규칙 배열
   */
  async function loadFromScope(
    scope: "project" | "user",
  ): Promise<readonly PersistentPermissionRule[]> {
    const filePath = settingsPath(scope, projectDir);
    const settings = await readSettingsFile(filePath);
    const perms = extractPermissions(settings);

    // allow 규칙과 deny 규칙을 모두 파싱하여 합침
    return [...parseRules(perms.allow, "allow", scope), ...parseRules(perms.deny, "deny", scope)];
  }

  /**
   * 규칙의 고유 키를 생성합니다.
   * project와 user 범위 간 중복 제거(deduplication)에 사용됩니다.
   *
   * @param rule - 키를 생성할 규칙
   * @returns "도구이름(패턴):타입" 형식의 고유 키
   */
  function ruleKey(rule: PersistentPermissionRule): string {
    return formatRuleString(rule.tool, rule.pattern) + ":" + rule.type;
  }

  /**
   * 양쪽 범위의 규칙을 로드하고 병합합니다.
   *
   * 병합 규칙: project 범위의 규칙이 user 범위의 동일한 규칙을 덮어씁니다.
   * 이를 통해 프로젝트별로 사용자 전역 설정을 재정의할 수 있습니다.
   *
   * @returns 병합된 모든 규칙 배열 (불변)
   */
  async function loadRules(): Promise<readonly PersistentPermissionRule[]> {
    // 두 범위의 규칙을 병렬로 로드하여 성능 최적화
    const [userRules, projectRules] = await Promise.all([
      loadFromScope("user"),
      loadFromScope("project"),
    ]);

    // project 규칙의 키 집합을 생성
    const projectKeys = new Set(projectRules.map(ruleKey));

    // project 규칙과 충돌하지 않는 user 규칙만 유지
    const filteredUserRules = userRules.filter((r) => !projectKeys.has(ruleKey(r)));

    // project 규칙 + 필터링된 user 규칙을 합쳐서 불변 배열로 반환
    return Object.freeze([...projectRules, ...filteredUserRules]);
  }

  /**
   * 새로운 규칙을 settings.json에 추가합니다.
   *
   * 중복 검사를 수행하여 동일한 규칙이 이미 존재하면 추가하지 않습니다.
   *
   * @param rule - 추가할 규칙 (scope 제외)
   * @param scope - 저장할 범위 ("project" 또는 "user")
   */
  async function addRule(
    rule: Omit<PersistentPermissionRule, "scope">,
    scope: "project" | "user",
  ): Promise<void> {
    const filePath = settingsPath(scope, projectDir);
    const settings = await readSettingsFile(filePath);
    const perms = extractPermissions(settings);

    // 규칙을 문자열로 변환 (예: "Bash(npm *)")
    const ruleStr = formatRuleString(rule.tool, rule.pattern);

    // allow 또는 deny 목록에 추가
    const listKey = rule.type === "allow" ? "allow" : "deny";
    const currentList = [...perms[listKey]];

    // 중복 방지 — 이미 존재하는 규칙은 추가하지 않음
    if (!currentList.includes(ruleStr)) {
      currentList.push(ruleStr);
    }

    const updatedPermissions: PermissionsConfig = {
      ...perms,
      [listKey]: currentList,
    };

    // 기존 설정을 보존하면서 permissions만 업데이트
    await writeSettingsFile(filePath, {
      ...settings,
      permissions: updatedPermissions,
    });
  }

  /**
   * 규칙을 settings.json에서 삭제합니다.
   *
   * scope가 지정되지 않으면 양쪽 범위(project + user) 모두에서 삭제합니다.
   *
   * @param tool - 삭제할 도구 이름
   * @param pattern - 삭제할 인수 패턴 (선택적)
   * @param scope - 삭제할 범위 (미지정 시 양쪽 모두)
   */
  async function removeRule(
    tool: string,
    pattern?: string,
    scope?: "project" | "user",
  ): Promise<void> {
    // scope가 미지정이면 양쪽 범위 모두에서 삭제
    const scopes: ReadonlyArray<"project" | "user"> =
      scope !== undefined ? [scope] : ["project", "user"];

    // 삭제할 규칙 문자열 생성
    const ruleStr = formatRuleString(tool, pattern);

    // 대상 범위들에서 병렬로 삭제 수행
    await Promise.all(
      scopes.map(async (s) => {
        const filePath = settingsPath(s, projectDir);
        const settings = await readSettingsFile(filePath);
        const perms = extractPermissions(settings);

        // allow와 deny 목록 모두에서 해당 규칙 문자열을 제거
        const updatedPermissions: PermissionsConfig = {
          allow: perms.allow.filter((r) => r !== ruleStr),
          deny: perms.deny.filter((r) => r !== ruleStr),
        };

        await writeSettingsFile(filePath, {
          ...settings,
          permissions: updatedPermissions,
        });
      }),
    );
  }

  /**
   * 특정 도구에 적용되는 모든 규칙을 가져옵니다.
   *
   * @param tool - 조회할 도구 이름
   * @returns 해당 도구에 대한 규칙 배열
   */
  async function getRulesForTool(tool: string): Promise<readonly PersistentPermissionRule[]> {
    const allRules = await loadRules();
    return allRules.filter((r) => r.tool === tool);
  }

  /**
   * 도구 실행이 영구 규칙에 의해 허용/거부되는지 검사합니다.
   *
   * 검사 순서:
   * 1. deny 규칙을 먼저 확인 (deny가 항상 우선 — 안전 제일 원칙)
   * 2. deny에 매칭되지 않으면 allow 규칙 확인
   * 3. 어떤 규칙에도 매칭되지 않으면 "none" 반환
   *
   * @param tool - 검사할 도구 이름
   * @param args - 도구 인수 (선택적)
   * @returns "allow", "deny", 또는 "none"
   */
  async function checkPermission(
    tool: string,
    args?: Record<string, unknown>,
  ): Promise<"allow" | "deny" | "none"> {
    const allRules = await loadRules();

    // 해당 도구에 대한 규칙만 필터링
    const toolRules = allRules.filter((r) => r.tool === tool);

    if (toolRules.length === 0) {
      return "none";
    }

    // deny 규칙을 먼저 확인 (deny가 항상 우선)
    const denyRules = toolRules.filter((r) => r.type === "deny");
    for (const rule of denyRules) {
      // 패턴이 없으면 도구의 모든 호출에 매칭
      if (rule.pattern === undefined) {
        return "deny";
      }
      // 패턴이 있으면 인수와 매칭 확인
      if (matchToolArgs(tool, rule.pattern, args)) {
        return "deny";
      }
    }

    // allow 규칙 확인
    const allowRules = toolRules.filter((r) => r.type === "allow");
    for (const rule of allowRules) {
      if (rule.pattern === undefined) {
        return "allow";
      }
      if (matchToolArgs(tool, rule.pattern, args)) {
        return "allow";
      }
    }

    // 매칭되는 규칙이 없음
    return "none";
  }

  /**
   * 특정 범위의 모든 권한 규칙을 삭제합니다.
   *
   * allow와 deny 목록을 모두 빈 배열로 초기화합니다.
   *
   * @param scope - 삭제할 범위
   */
  async function clearRules(scope: "project" | "user"): Promise<void> {
    const filePath = settingsPath(scope, projectDir);
    const settings = await readSettingsFile(filePath);

    await writeSettingsFile(filePath, {
      ...settings,
      permissions: { allow: [], deny: [] },
    });
  }

  // 불변 객체로 반환하여 외부에서 메서드를 변경하지 못하도록 보호
  return Object.freeze({
    loadRules,
    addRule,
    removeRule,
    getRulesForTool,
    checkPermission,
    clearRules,
  });
}
