/**
 * Skill template engine — SKILL.md / evals.json 텍스트를 순수 함수로 렌더
 *
 * 특징:
 * - 외부 의존 없음 (handlebars 불필요 — 인라인 mustache-lite 렌더러 사용)
 * - 순수 함수 (I/O 없음, 동일 입력 동일 출력)
 * - ≤500 라인 가드 — 위반 시 ScaffoldError("VALIDATION_FAILED")
 * - SKILL.md frontmatter는 skillManifestSchema 통과 보장
 *
 * 참고: 실제 파일 생성은 scaffold.ts가 수행한다. 이 모듈은 문자열만 다룬다.
 */

import { validateManifest } from "../manifest.js";
import {
  ScaffoldError,
  type TemplateInput,
  type TemplateOutput,
} from "./types.js";

/** SKILL.md 최대 라인 수 (progressive disclosure 원칙) */
const MAX_SKILL_LINES = 500;

/**
 * "pushy" description 생성 — intent + triggers를 합쳐 명확한 트리거 문장으로
 *
 * 규칙 (Claude Code skill-creator v2.0 벤치마크):
 * - "Use when ..." 절 포함
 * - 최대 3개의 구체 트리거 예시 나열
 * - 본문이 아닌 metadata에 포함
 *
 * @param intent - 자연어 목적
 * @param triggers - should-trigger 예시
 * @returns 단일 줄로 압축된 description
 */
export function composePushyDescription(
  intent: string,
  triggers: readonly string[],
): string {
  const head = intent.trim().replace(/[.!?]+$/, "");
  const topTriggers = triggers.slice(0, 3).map((t) => t.trim().replace(/[.!?]+$/, ""));
  const useClause =
    topTriggers.length === 0
      ? ""
      : ` Use when the user says things like: ${topTriggers.map((t) => `"${t}"`).join(", ")}.`;
  return `${head}.${useClause}`;
}

/**
 * 아주 작은 mustache-lite 렌더러 — `{{var}}`, `{{#each arr}}…{{/each}}` 지원
 *
 * 지원하지 않는 것 (의도적):
 * - 조건문 ({{#if}})
 * - 중첩 섹션 (이름 충돌 방지 위해 단일 레벨만)
 * - HTML escaping (SKILL.md는 마크다운이므로 불필요)
 *
 * @param template - 템플릿 문자열
 * @param data - 치환할 데이터
 * @returns 렌더된 문자열
 */
export function renderTemplate(
  template: string,
  data: Readonly<Record<string, unknown>>,
): string {
  let out = template;

  // {{#each arr}}...{{/each}} 블록을 먼저 처리 (내부 {{this}}, {{@index}} 지원)
  out = out.replace(
    /\{\{#each\s+([a-zA-Z_][\w.]*)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_match, key: string, body: string) => {
      const arr = data[key];
      if (!Array.isArray(arr)) return "";
      return arr
        .map((item: unknown, idx: number) => {
          let piece = body;
          piece = piece.replace(/\{\{this\}\}/g, String(item));
          piece = piece.replace(/\{\{@index\}\}/g, String(idx));
          return piece;
        })
        .join("");
    },
  );

  // 단순 {{var}} 치환 — 점 표기법은 지원하지 않고 top-level 키만 처리
  out = out.replace(/\{\{([a-zA-Z_][\w]*)\}\}/g, (_match, key: string) => {
    const v = data[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });

  return out;
}

/**
 * SKILL.md 인라인 템플릿 — references/ 에 의존하지 않는 최소 골격
 *
 * Claude Code skill-creator v2.0의 구조를 따른다:
 * - Mission / When This Triggers / Workflow / Quality Bar / References
 * - 본문은 300 라인 미만으로 유지
 */
const SKILL_MD_TEMPLATE = `---
name: {{name}}
description: "{{description}}"
userInvocable: true
argumentHint: "[args]"
trustLevel: project
context: {{context}}
minModelTier: {{minModelTier}}
---

# {{name}}

## Mission

{{description}}

## When This Triggers

- User explicitly calls \`/{{name}}\` with optional arguments
- User phrases that should match:
{{#each triggers}}
  - "{{this}}"
{{/each}}

### Should NOT Trigger On

{{#each antiTriggers}}
- "{{this}}"
{{/each}}

## Workflow

Follow each step in order. Do not skip; if a step is not applicable, state *why* and proceed.

{{#each workflowSteps}}
{{@index}}. {{this}}

{{/each}}

## Quality Bar

A run of this skill is complete only when:

- [ ] All workflow steps above executed (or explicitly justified skip)
- [ ] No destructive operations without user confirmation
- [ ] Outputs match the user's stated intent

## Required Tools

{{requiredToolsLine}}

## Notes for the Operator

- Prefer editing existing files over creating new ones when the intent is refinement
- Explain *why* on each non-obvious rule — avoid blanket ALWAYS/MUST
- If blocked, surface the blocker and ask before creating workarounds
`;

/** evals.json 템플릿 — v1에는 assertions 없이 prompt/expectations 골격만 */
const EVALS_JSON_TEMPLATE = `{
  "skill_name": "{{name}}",
  "version": 1,
  "cases": [
    {
      "id": "e1",
      "prompt": {{trigger0}},
      "files": [],
      "expectations": [
        "The workflow described in SKILL.md is followed in order.",
        "No destructive edits occur without confirmation."
      ]
    },
    {
      "id": "e2",
      "prompt": {{trigger1}},
      "files": [],
      "expectations": [
        "The skill produces output aligned with the user's stated intent.",
        "If args are missing, the skill asks or applies documented defaults."
      ]
    }
  ]
}
`;

/**
 * SKILL.md + evals.json 을 렌더한다
 *
 * 동작:
 * 1. description이 비어있으면 composePushyDescription으로 자동 생성 — 하지만 호출자가 제공하는 게 권장
 * 2. 라인 수 가드 → 500 초과 시 ScaffoldError("VALIDATION_FAILED")
 * 3. frontmatter 추출 후 validateManifest 통과 확인 — 실패 시 ScaffoldError("VALIDATION_FAILED")
 *
 * @param input - 템플릿 데이터
 * @returns 렌더된 SKILL.md + evals.json + 라인 수
 * @throws ScaffoldError - 라인 초과 또는 매니페스트 검증 실패
 */
export function renderSkillScaffold(input: TemplateInput): TemplateOutput {
  const requiredToolsLine =
    input.requiredTools && input.requiredTools.length > 0
      ? input.requiredTools.map((t) => `- \`${t}\``).join("\n")
      : "_(none explicitly required — operator selects appropriate tools per step)_";

  const skillMd = renderTemplate(SKILL_MD_TEMPLATE, {
    name: input.name,
    description: input.description,
    triggers: input.triggers,
    antiTriggers: input.antiTriggers,
    workflowSteps: input.workflowSteps,
    requiredToolsLine,
    context: input.fork ? "fork" : "inline",
    minModelTier: input.minModelTier,
  });

  const lineCount = skillMd.split(/\r?\n/).length;
  if (lineCount > MAX_SKILL_LINES) {
    throw new ScaffoldError(
      "VALIDATION_FAILED",
      `SKILL.md exceeds ${String(MAX_SKILL_LINES)} lines (${String(lineCount)}) — split content into references/`,
    );
  }

  // frontmatter 추출 및 검증
  const frontmatterMatch = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new ScaffoldError("VALIDATION_FAILED", "Rendered SKILL.md has no frontmatter block");
  }
  const fmObj = parseYamlFrontmatter(frontmatterMatch[1] ?? "");
  const manifestResult = validateManifest(fmObj);
  if (!manifestResult.valid) {
    throw new ScaffoldError(
      "VALIDATION_FAILED",
      `Rendered frontmatter invalid: ${manifestResult.errors.join("; ")}`,
    );
  }

  // evals.json 렌더 — JSON 값으로 이스케이프하기 위해 JSON.stringify 사용
  const evalsJson = renderTemplate(EVALS_JSON_TEMPLATE, {
    name: input.name,
    trigger0: JSON.stringify(input.triggers[0] ?? ""),
    trigger1: JSON.stringify(input.triggers[1] ?? input.triggers[0] ?? ""),
  });

  // JSON이 유효한지 파싱으로 확인 (템플릿 실수 조기 감지)
  try {
    JSON.parse(evalsJson) as unknown;
  } catch (err) {
    throw new ScaffoldError(
      "VALIDATION_FAILED",
      `Rendered evals.json is not valid JSON: ${(err as Error).message}`,
    );
  }

  return { skillMd, evalsJson, lineCount };
}

/**
 * 아주 단순한 YAML frontmatter 파서 — scalar/boolean/숫자/문자열만 지원
 *
 * create-skill이 생성하는 SKILL.md는 본 엔진의 템플릿에서 나오므로
 * 구조가 알려져 있고 제한적이다. 외부 YAML 라이브러리를 도입하지 않기 위해
 * 최소 기능만 구현한다. 다른 곳에서 쓸 의도가 아니며 export하지 않는다.
 *
 * @param yaml - frontmatter 내부 (--- 사이)
 * @returns key/value 객체
 */
function parseYamlFrontmatter(yaml: string): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value: string = line.slice(colon + 1).trim();
    // 따옴표 제거
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // 타입 coercion (minimal)
    if (value === "true") out[key] = true;
    else if (value === "false") out[key] = false;
    else if (value === "null") out[key] = null;
    else if (/^-?\d+(\.\d+)?$/.test(value)) out[key] = Number(value);
    else out[key] = value;
  }
  return out;
}
