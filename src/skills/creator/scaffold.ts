/**
 * Skill scaffolder — 입력 검증 + 파일 시스템 작성의 유일한 진입점
 *
 * 책임:
 * - ScaffoldOptions 검증 (Zod + 비즈니스 규칙: 디렉토리 충돌)
 * - 템플릿 엔진 호출 (renderSkillScaffold)
 * - 원자적 디렉토리 생성 + 파일 쓰기
 * - ScaffoldError로 일관된 실패 모드 노출
 *
 * 테스트 용이성을 위해 fs 의존성을 주입 가능하게 설계.
 */

import { join } from "node:path";
import * as defaultFs from "node:fs/promises";
import { composePushyDescription, renderSkillScaffold } from "./template-engine.js";
import {
  ScaffoldError,
  scaffoldOptionsSchema,
  type ScaffoldOptions,
  type ScaffoldResult,
  type TemplateInput,
} from "./types.js";

/** 주입 가능한 fs 인터페이스 — 테스트에서 mocking 용 */
export interface ScaffoldDeps {
  readonly fs?: typeof defaultFs;
}

/**
 * 스킬 디렉토리 전체를 스캐폴드한다
 *
 * 출력 레이아웃:
 * ```
 * <outputDir>/<name>/
 * ├── SKILL.md
 * ├── evals/
 * │   └── evals.json
 * └── references/        # 빈 디렉토리 — 후속 추가용
 * ```
 *
 * @param rawOpts - 검증 전 원시 입력 (보통 CLI 인자 또는 LLM 생성 JSON)
 * @param deps - fs 주입 (테스트용). 생략 시 node:fs/promises 사용
 * @returns 생성된 파일 경로 집합
 * @throws ScaffoldError - 코드별 실패 사유:
 *   - "INVALID_NAME": kebab-case 규칙 위반 등 입력 검증 실패
 *   - "NAME_COLLISION": 대상 디렉토리가 이미 존재하고 force=false
 *   - "VALIDATION_FAILED": 템플릿 렌더/매니페스트 검증 실패 (템플릿 엔진에서 전파)
 *   - "IO_ERROR": 파일/디렉토리 쓰기 실패
 */
export async function scaffoldSkill(
  rawOpts: ScaffoldOptions | Record<string, unknown>,
  deps?: ScaffoldDeps,
): Promise<ScaffoldResult> {
  const fs = deps?.fs ?? defaultFs;

  // 1. 입력 검증
  const parsed = scaffoldOptionsSchema.safeParse(rawOpts);
  if (!parsed.success) {
    // kebab-case 위반은 별도 코드로 구분
    const nameIssue = parsed.error.issues.find((i) => i.path[0] === "name");
    if (nameIssue) {
      throw new ScaffoldError("INVALID_NAME", nameIssue.message);
    }
    throw new ScaffoldError(
      "VALIDATION_FAILED",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  const opts = parsed.data;

  // 2. 충돌 감지 — 기존 스킬 디렉토리 존재 여부
  const skillDir = join(opts.outputDir, opts.name);
  const skillMdPath = join(skillDir, "SKILL.md");

  const exists = await pathExists(fs, skillMdPath);
  if (exists && !opts.force) {
    throw new ScaffoldError(
      "NAME_COLLISION",
      `Skill already exists at ${skillMdPath} — pass force=true to overwrite`,
    );
  }

  // 3. description 자동 생성 (호출자가 intent만 제공한 경우 대비)
  const description = composePushyDescription(opts.intent, opts.triggers);

  const templateInput: TemplateInput = {
    name: opts.name,
    description,
    triggers: opts.triggers,
    antiTriggers: opts.antiTriggers,
    fork: opts.fork,
    requiredTools: opts.requiredTools,
    minModelTier: opts.minModelTier,
    workflowSteps: opts.workflowSteps,
  };

  // 4. 렌더 — VALIDATION_FAILED는 여기서 자연스럽게 전파됨
  const rendered = renderSkillScaffold(templateInput);

  // 5. 파일 시스템 작성
  const evalsDir = join(skillDir, "evals");
  const referencesDir = join(skillDir, "references");
  const evalsPath = join(evalsDir, "evals.json");

  const created: string[] = [];
  try {
    await fs.mkdir(skillDir, { recursive: true });
    created.push(skillDir);
    await fs.mkdir(evalsDir, { recursive: true });
    created.push(evalsDir);
    await fs.mkdir(referencesDir, { recursive: true });
    created.push(referencesDir);

    await fs.writeFile(skillMdPath, rendered.skillMd, { encoding: "utf8" });
    created.push(skillMdPath);
    await fs.writeFile(evalsPath, rendered.evalsJson, { encoding: "utf8" });
    created.push(evalsPath);
  } catch (err) {
    throw new ScaffoldError(
      "IO_ERROR",
      `Failed to write skill files: ${(err as Error).message}`,
    );
  }

  return { skillDir, skillMdPath, evalsPath, created };
}

/**
 * 파일 경로 존재 여부를 조용히 확인 — access 실패는 곧 "없음"
 */
async function pathExists(fs: typeof defaultFs, p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
