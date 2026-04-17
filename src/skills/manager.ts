/**
 * 스킬 매니저 — 여러 디렉토리에서 스킬을 로드하고 관리하는 중앙 허브
 *
 * 스킬 로딩 디렉토리 (우선순위 순서, 뒤의 것이 앞의 것을 덮어씀):
 * 1. <dhelix>/.claude/skills/ — dhelix 번들 스킬 (가장 낮은 우선순위, 기본 제공)
 * 2. ~/.dhelix/skills/ — 사용자 전역 스킬
 * 3. ~/.dhelix/commands/ — 사용자 전역 커맨드
 * 4. .dhelix/skills/ — 프로젝트 로컬 스킬
 * 5. .dhelix/commands/ — 프로젝트 로컬 커맨드 (가장 높은 우선순위)
 *
 * 같은 이름의 스킬이 여러 디렉토리에 있으면, 프로젝트 레벨이 전역 레벨을 덮어씁니다.
 * 번들 스킬은 가장 낮은 우선순위여서 사용자/프로젝트 오버라이드가 가능합니다.
 * 이를 통해 프로젝트별로 전역 스킬을 커스터마이징할 수 있습니다.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";
import { loadSkillsFromDirectory } from "./loader.js";
import { executeSkill } from "./executor.js";
import { type SkillDefinition, type SkillContext, type SkillExecutionResult } from "./types.js";

/**
 * 스킬 로딩 디렉토리 경로 생성기
 *
 * 각 함수는 스킬 파일을 검색할 디렉토리 경로를 반환합니다.
 * commands/와 skills/ 두 종류가 있지만, 기능적 차이는 없고
 * 조직화 목적으로 분리되어 있습니다.
 *
 * `bundledSkills`는 dhelix 패키지와 함께 배포되는 기본 스킬 세트의 위치입니다.
 * 개발 환경(src 빌드 전)에서는 `<repo>/.claude/skills`,
 * 배포된 패키지에서는 `<pkg>/.claude/skills`(또는 `<pkg>/dist/..`에서 상대 경로)로 해석됩니다.
 */
const SKILL_DIRS = {
  /** 프로젝트 레벨 커맨드: {프로젝트}/.dhelix/commands/ */
  projectCommands: (cwd: string) => join(cwd, `.${APP_NAME}`, "commands"),
  /** 프로젝트 레벨 스킬: {프로젝트}/.dhelix/skills/ */
  projectSkills: (cwd: string) => join(cwd, `.${APP_NAME}`, "skills"),
  /** 사용자 전역 커맨드: ~/.dhelix/commands/ */
  globalCommands: () => join(homedir(), `.${APP_NAME}`, "commands"),
  /** 사용자 전역 스킬: ~/.dhelix/skills/ */
  globalSkills: () => join(homedir(), `.${APP_NAME}`, "skills"),
  /**
   * 번들 스킬: dhelix와 함께 배포되는 기본 스킬 디렉토리
   *
   * 위치: `<repo|pkg>/.claude/skills/`
   *
   * import.meta.url 기준 해석 전략:
   *   - 이 파일 경로: `<root>/src/skills/manager.ts` (dev) 또는 `<root>/dist/skills/manager.js` (build)
   *   - 상위 3개 디렉토리로 올라가면 `<root>/`에 도달 (skills → src/dist → root)
   *   - 거기에 `.claude/skills`를 붙이면 번들 스킬 루트가 나옵니다.
   *
   * 경로가 존재하지 않더라도 `loadSkillsFromDirectory`가 ENOENT를
   * 우아하게 처리하므로(loader.ts:237) startup crash는 발생하지 않습니다.
   */
  bundledSkills: () => {
    const thisFilePath = fileURLToPath(new URL(import.meta.url));
    // manager.(ts|js) → <root>/<src|dist>/skills/manager.* → <root>
    const root = dirname(dirname(dirname(thisFilePath)));
    return join(root, ".claude", "skills");
  },
} as const;

/**
 * SkillManager 클래스 — 스킬의 로드, 조회, 실행을 관리
 *
 * 스킬은 Map<이름, 정의>로 저장되며, 같은 이름의 스킬이 여러 번 로드되면
 * 마지막에 로드된 것(높은 우선순위)이 이전 것을 덮어씁니다.
 *
 * 주요 메서드:
 * - loadAll(): 4개 디렉토리에서 모든 스킬 로드
 * - execute(): 이름으로 스킬 실행
 * - buildPromptSection(): LLM 시스템 프롬프트에 스킬 목록 삽입
 */
export class SkillManager {
  /** 로드된 스킬을 이름으로 검색하는 Map (key: 스킬 이름, value: 스킬 정의) */
  private readonly skills = new Map<string, SkillDefinition>();

  /**
   * 모든 로드된 스킬을 배열로 반환
   * @returns 읽기 전용 스킬 정의 배열
   */
  getAll(): readonly SkillDefinition[] {
    return [...this.skills.values()];
  }

  /**
   * 이름으로 스킬을 검색
   * @param name - 스킬 이름 (프론트매터의 name 필드)
   * @returns 스킬 정의 또는 undefined (존재하지 않는 경우)
   */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /**
   * 스킬 존재 여부 확인
   * @param name - 확인할 스킬 이름
   * @returns 스킬이 존재하면 true
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 사용자가 /명령어로 호출 가능한 스킬만 필터링
   * userInvocable=true인 스킬만 반환합니다.
   * @returns /help에 표시할 스킬 목록
   */
  getUserInvocable(): readonly SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.frontmatter.userInvocable);
  }

  /**
   * LLM이 볼 수 있는 스킬만 필터링
   * disableModelInvocation=false인 스킬만 반환합니다.
   * @returns LLM 시스템 프롬프트에 포함할 스킬 목록
   */
  getModelVisible(): readonly SkillDefinition[] {
    return [...this.skills.values()].filter((s) => !s.frontmatter.disableModelInvocation);
  }

  /**
   * 5개 디렉토리에서 모든 스킬을 로드
   *
   * 역순 우선순위로 로드하여, 높은 우선순위 스킬이 낮은 우선순위를 덮어씁니다:
   * 1. bundledSkills (가장 낮은 우선순위 — dhelix 기본 제공 스킬)
   * 2. globalSkills
   * 3. globalCommands
   * 4. projectSkills
   * 5. projectCommands (가장 높은 우선순위)
   *
   * 번들 스킬 경로가 없거나 읽을 수 없으면 (ENOENT 등) 조용히 건너뜁니다 —
   * `loadSkillsFromDirectory`가 이미 ENOENT를 빈 배열로 반환하지만,
   * import.meta.url 해석이 실패할 가능성에 대비해 try/catch로 감쌉니다.
   *
   * @param workingDirectory - 프로젝트 루트 디렉토리 (프로젝트 레벨 스킬 검색 기준)
   */
  async loadAll(workingDirectory: string): Promise<void> {
    // 낮은 우선순위부터 로드 → 높은 우선순위가 Map에서 같은 키를 덮어씀
    const dirs: string[] = [];

    // 번들 스킬 경로 해석은 import.meta.url 문제로 실패할 수 있으므로 가드
    try {
      dirs.push(SKILL_DIRS.bundledSkills());
    } catch {
      // 번들 경로 해석 실패 → 번들 스킬 없이 진행 (startup crash 방지)
    }

    dirs.push(
      SKILL_DIRS.globalSkills(),
      SKILL_DIRS.globalCommands(),
      SKILL_DIRS.projectSkills(workingDirectory),
      SKILL_DIRS.projectCommands(workingDirectory),
    );

    for (const dir of dirs) {
      const skills = await loadSkillsFromDirectory(dir);
      for (const skill of skills) {
        // 같은 이름이면 나중에 로드된 것(높은 우선순위)이 덮어씀
        this.skills.set(skill.frontmatter.name, skill);
      }
    }
  }

  /**
   * 이름으로 스킬을 찾아 실행
   *
   * @param name - 실행할 스킬 이름
   * @param args - 스킬에 전달할 인자 문자열
   * @param options - 실행 옵션 (세션 ID, 작업 디렉토리 등)
   * @returns 실행 결과 또는 null (스킬이 존재하지 않는 경우)
   */
  async execute(
    name: string,
    args: string,
    options: {
      readonly sessionId?: string;
      readonly workingDirectory: string;
      readonly projectDir?: string;
    },
  ): Promise<SkillExecutionResult | null> {
    const skill = this.skills.get(name);
    if (!skill) return null;

    // 인자 문자열을 공백으로 분리하여 위치별 인자 배열 생성
    const positionalArgs = args.trim() ? args.trim().split(/\s+/) : [];

    // 실행 컨텍스트 구성 — 변수 치환에 사용됨
    const context: SkillContext = {
      arguments: args,
      positionalArgs,
      sessionId: options.sessionId,
      // 스킬 파일의 디렉토리 경로 추출 (마지막 / 이전까지)
      skillDir: skill.sourcePath
        ? (() => {
            const lastSlash = skill.sourcePath.lastIndexOf("/");
            return lastSlash === -1 ? "." : skill.sourcePath.substring(0, lastSlash);
          })()
        : undefined,
      projectDir: options.projectDir ?? options.workingDirectory,
      workingDirectory: options.workingDirectory,
    };

    return executeSkill(skill, context);
  }

  /**
   * LLM 시스템 프롬프트에 삽입할 스킬 목록 섹션 생성
   *
   * LLM이 사용 가능한 스킬을 알 수 있도록 마크다운 형식의 목록을 만듭니다.
   * 사용자가 /스킬이름으로 호출하면 LLM이 해당 스킬의 지시사항을 따라야 합니다.
   *
   * @returns 마크다운 형식의 스킬 목록 문자열 또는 null (스킬이 없는 경우)
   */
  buildPromptSection(): string | null {
    const visible = this.getModelVisible();
    if (visible.length === 0) return null;

    const lines = ["# Available Skills", ""];
    lines.push(
      "The user has configured the following skills. " +
        "When a user invokes a skill with /<name>, the skill's prompt will be expanded and you should follow its instructions.",
    );
    lines.push("");

    for (const skill of visible) {
      const { name, description, argumentHint, userInvocable } = skill.frontmatter;
      // 사용자 호출 가능: /name, 내부 전용: (internal) name
      const invocable = userInvocable ? `/${name}` : `(internal) ${name}`;
      const hint = argumentHint ? ` ${argumentHint}` : "";
      lines.push(`- **${invocable}${hint}**: ${description}`);
    }

    return lines.join("\n");
  }
}
