/**
 * 빌트인 커맨드 배럴 — 모든 기본 슬래시 명령어를 하나의 배열로 제공
 *
 * index.ts에서 개별 임포트를 제거하고 이 배럴을 사용합니다.
 * 새 슬래시 명령어를 추가할 때 이 파일에 추가하면 됩니다.
 */
import { type SlashCommand } from "./registry.js";
import { clearCommand } from "./clear.js";
import { compactCommand } from "./compact.js";
import { helpCommand } from "./help.js";
import { modelCommand } from "./model.js";
import { resumeCommand } from "./resume.js";
import { rewindCommand } from "./rewind.js";
import { effortCommand } from "./effort.js";
import { fastCommand } from "./fast.js";
import { simplifyCommand } from "./simplify.js";
import { batchCommand } from "./batch.js";
import { debugCommand } from "./debug.js";
import { mcpCommand } from "./mcp.js";
import { configCommand } from "./config.js";
import { diffCommand } from "./diff.js";
import { doctorCommand } from "./doctor.js";
import { statsCommand } from "./stats.js";
import { analyticsCommand } from "./analytics.js";
import { statusCommand } from "./status.js";
import { contextCommand } from "./context.js";
import { copyCommand } from "./copy.js";
import { exportCommand } from "./export.js";
import { forkCommand } from "./fork.js";
import { outputStyleCommand } from "./output-style.js";
import { renameCommand } from "./rename.js";
import { costCommand } from "./cost.js";
import { updateCommand } from "./update.js";
import { initCommand } from "./init.js";
import { planCommand } from "./plan.js";
import { undoCommand } from "./undo.js";
import { memoryCommand } from "./memory.js";
import { keybindingsCommand } from "./keybindings.js";
import { reviewCommand } from "./review.js";
import { commitCommand } from "./commit.js";
import { createSkillCommand } from "./create-skill.js";
import { skillEvalCommand } from "./skill-eval.js";
import { skillImproveCommand } from "./skill-improve.js";
import { skillReviewCommand } from "./skill-review.js";
import { toneCommand } from "./tone.js";
import { bugCommand } from "./bug.js";
import { voiceCommand } from "./voice.js";
import { architectCommand, editorCommand, dualCommand } from "./dual-model.js";
import { extensionsCommand } from "./extensions.js";
import { dashboardCommand } from "./dashboard.js";

export const builtinCommands: readonly SlashCommand[] = [
  clearCommand,
  compactCommand,
  helpCommand,
  modelCommand,
  resumeCommand,
  rewindCommand,
  effortCommand,
  fastCommand,
  simplifyCommand,
  batchCommand,
  debugCommand,
  mcpCommand,
  configCommand,
  diffCommand,
  doctorCommand,
  statsCommand,
  analyticsCommand,
  statusCommand,
  contextCommand,
  copyCommand,
  exportCommand,
  forkCommand,
  outputStyleCommand,
  renameCommand,
  costCommand,
  updateCommand,
  initCommand,
  planCommand,
  undoCommand,
  memoryCommand,
  keybindingsCommand,
  reviewCommand,
  commitCommand,
  createSkillCommand,
  skillEvalCommand,
  skillImproveCommand,
  skillReviewCommand,
  toneCommand,
  bugCommand,
  voiceCommand,
  architectCommand,
  editorCommand,
  dualCommand,
  extensionsCommand,
  dashboardCommand,
];

/** helpCommand에서 전체 명령어 목록을 설정하기 위한 setter */
export { setHelpCommands } from "./help.js";
