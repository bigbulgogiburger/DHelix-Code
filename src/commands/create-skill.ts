/**
 * /create-skill 명령어 핸들러 — 새 dhelix 스킬을 끝단까지 생성
 *
 * 두 가지 실행 경로를 지원합니다:
 *
 * 1. 헤드리스(scaffold 직접 호출) 경로:
 *    - 인자에 유효한 kebab-case 이름과 `--intent "..."`가 모두 포함되면
 *      즉시 `scaffoldSkill()`을 호출하여 스킬 디렉토리를 생성합니다.
 *    - 누락된 필드는 sensible defaults로 채웁니다.
 *
 * 2. LLM 주도(인터뷰) 경로:
 *    - 이름/의도 중 하나라도 빠지면 사용자 메시지로 주입하여
 *      번들된 `create-skill` 스킬이 자동 라우팅되도록 유도합니다.
 *    - 이 경로는 인터뷰/드래프트/검증을 LLM이 주관합니다.
 *
 * @see src/skills/creator/index.ts — scaffoldSkill 구현체 (Teammate B)
 * @see .claude/skills/create-skill/SKILL.md — 번들된 skill 인터뷰 매뉴얼 (Teammate B)
 */

import { join } from "node:path";
import { type CommandContext, type CommandResult, type SlashCommand } from "./registry.js";
// NOTE: Teammate B's `src/skills/creator/index.ts` barrel is the public entry,
// but while the barrel is still being assembled we import `ScaffoldError` and
// the type contract from `types.js` (which is already present). `scaffoldSkill`
// itself lives in `index.js` once Teammate B publishes the barrel. The
// production code assumes `index.js` will re-export both.
import { scaffoldSkill } from "../skills/creator/index.js";
import { ScaffoldError, type ScaffoldOptions } from "../skills/creator/types.js";
import { APP_NAME } from "../constants.js";

/**
 * kebab-case 이름 유효성 검증 정규식 — scaffoldSkill 계약과 동일
 * - 소문자로 시작
 * - 소문자, 숫자, 하이픈만 포함
 */
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

/**
 * 인자 문자열에서 `--intent "..."` 또는 `--intent '...'` 값을 추출
 *
 * 따옴표가 없어도 첫 토큰만 추출하지만, 권장 사용법은 따옴표 포함입니다.
 *
 * @param args - 인자 문자열 (예: `my-skill --intent "do X"`)
 * @returns 추출된 intent (찾지 못하면 undefined)
 */
function extractIntent(args: string): string | undefined {
  // "..." 또는 '...' 로 감싸진 형태 우선 매칭
  const quoted = args.match(/--intent\s+(["'])([\s\S]*?)\1/);
  if (quoted) return quoted[2];

  // 따옴표 없는 단일 토큰 매칭
  const bare = args.match(/--intent\s+(\S+)/);
  if (bare) return bare[1];

  return undefined;
}

/**
 * 인자 문자열에서 첫 번째 위치 인자(이름 후보)를 추출
 *
 * `--intent` 플래그 이전의 첫 비공백 토큰을 반환합니다.
 *
 * @param args - 인자 문자열
 * @returns 이름 후보 문자열 (없으면 undefined)
 */
function extractNameCandidate(args: string): string | undefined {
  // `--intent` 앞까지만 자르기
  const beforeIntent = args.split(/--intent\b/)[0].trim();
  if (!beforeIntent) return undefined;

  const firstToken = beforeIntent.split(/\s+/)[0];
  return firstToken || undefined;
}

/**
 * intent 문장에서 기본 trigger를 1개 도출
 *
 * 예: "help users refactor TS code" → "refactor TS code"
 *
 * @param intent - 사용자 입력 intent 문자열
 * @returns 기본 trigger 문장 (intent 원본을 그대로 재사용)
 */
function deriveDefaultTrigger(intent: string): string {
  return intent.trim();
}

/**
 * intent에서 placeholder 워크플로우 3단계 생성
 *
 * 번들 스킬이 나중에 이 스텝들을 오버라이드할 수 있도록 최소 구조만 제공합니다.
 *
 * @param intent - 사용자 입력 intent 문자열
 * @returns 3단계 워크플로우 배열
 */
function derivePlaceholderWorkflow(intent: string): readonly string[] {
  return [
    `Gather context relevant to: ${intent}`,
    "Execute the primary action",
    "Summarize the result back to the user",
  ];
}

/**
 * ScaffoldOptions 기본값 생성 — 헤드리스 경로에서 누락 필드 보완
 *
 * @param name - kebab-case 스킬 이름
 * @param intent - intent 문장
 * @param ctx - 명령어 실행 컨텍스트 (outputDir 계산용)
 * @returns 완전한 ScaffoldOptions 객체
 */
function buildScaffoldOptions(
  name: string,
  intent: string,
  ctx: CommandContext,
): ScaffoldOptions {
  // ScaffoldOptions is inferred from a Zod schema with mutable array fields;
  // spread readonly helpers into fresh mutable arrays to satisfy the type.
  return {
    name,
    intent,
    triggers: [deriveDefaultTrigger(intent)],
    antiTriggers: [],
    fork: false,
    requiredTools: [],
    minModelTier: "medium",
    workflowSteps: [...derivePlaceholderWorkflow(intent)],
    outputDir: join(ctx.workingDirectory, `.${APP_NAME}`, "skills"),
    force: false,
  };
}

/**
 * LLM이 번들 `create-skill` 스킬을 실행하도록 유도하는 프롬프트를 생성
 *
 * `shouldInjectAsUserMessage`로 전달되며, 모델은 bundled skill 이름을 감지해
 * 자동 라우팅하도록 설계되어 있습니다 (SkillManager.buildPromptSection 참조).
 *
 * @param rawArgs - 사용자가 입력한 원본 인자
 * @returns LLM에 주입할 메시지 문자열
 */
function buildInterviewPrompt(rawArgs: string): string {
  const hint = rawArgs.trim();
  const hintLine = hint
    ? `User hint so far: "${hint}"`
    : "User has not provided a name or intent yet.";

  return [
    "Please run the bundled `create-skill` skill to help me create a new dhelix skill end-to-end.",
    "",
    hintLine,
    "",
    "Workflow:",
    "1. Interview me for: skill name (kebab-case), intent, triggers, anti-triggers, required tools, model tier, workflow steps, fork vs inline context.",
    "2. Draft the SKILL.md frontmatter and body.",
    "3. Validate the skill against dhelix conventions (name uniqueness, Zod schema, etc).",
    "4. Invoke the scaffoldSkill helper (or the `create-skill` slash command with `--intent`) to materialize files on disk.",
    "5. Confirm the created files and next steps.",
  ].join("\n");
}

/**
 * /create-skill 슬래시 명령어 정의
 *
 * 사용법:
 *   /create-skill                              — LLM 인터뷰 모드 (번들 스킬 호출)
 *   /create-skill my-skill --intent "do X"     — 헤드리스 스캐폴딩 (직접 scaffoldSkill 호출)
 */
export const createSkillCommand: SlashCommand = {
  name: "create-skill",
  description:
    "Create a new dhelix skill end-to-end — run the bundled create-skill skill to interview, draft, validate.",
  usage: '/create-skill [name] [--intent "..."]',
  execute: async (args: string, ctx: CommandContext): Promise<CommandResult> => {
    const intent = extractIntent(args);
    const nameCandidate = extractNameCandidate(args);

    // 헤드리스 경로: 이름 + intent가 모두 제공된 경우 바로 scaffold 시도
    if (nameCandidate && intent) {
      if (!KEBAB_CASE_REGEX.test(nameCandidate)) {
        return {
          output: `INVALID_NAME: '${nameCandidate}' is not a valid kebab-case skill name. Use lowercase letters, digits, and hyphens (must start with a letter).`,
          success: false,
        };
      }

      try {
        const result = await scaffoldSkill(buildScaffoldOptions(nameCandidate, intent, ctx));
        return {
          output: [
            `Created skill '${nameCandidate}' at ${result.skillDir}`,
            "",
            "Files:",
            ...result.created.map((p) => `  - ${p}`),
            "",
            `Edit ${result.skillMdPath} to refine the skill.`,
            `Evals stub: ${result.evalsPath}`,
          ].join("\n"),
          success: true,
        };
      } catch (err) {
        if (err instanceof ScaffoldError) {
          return {
            output: `${err.code}: ${err.message}`,
            success: false,
          };
        }
        // 예상 못한 에러 → 메시지만 surface, 나머지는 registry.execute의 catch에 맡김
        throw err;
      }
    }

    // LLM 주도 경로: 번들 스킬이 인터뷰/검증을 주관하도록 메시지 주입
    return {
      output: buildInterviewPrompt(args),
      success: true,
      shouldInjectAsUserMessage: true,
    };
  },
};
