/**
 * src/skills/creator — 배럴 모듈
 *
 * create-skill 스킬과 /create-skill 슬래시 커맨드가 의존하는 공개 API.
 * 외부에서 다른 경로로 접근하지 말 것 — 이 배럴만 사용.
 */

export { scaffoldSkill, type ScaffoldDeps } from "./scaffold.js";
export {
  renderSkillScaffold,
  renderTemplate,
  composePushyDescription,
} from "./template-engine.js";
export {
  ScaffoldError,
  scaffoldOptionsSchema,
  type ScaffoldErrorCode,
  type ScaffoldOptions,
  type ScaffoldResult,
  type TemplateInput,
  type TemplateOutput,
} from "./types.js";
