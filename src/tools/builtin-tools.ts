/**
 * 빌트인 도구 배럴 — 모든 기본 도구를 하나의 배열로 제공
 *
 * index.ts에서 개별 임포트를 제거하고 이 배럴을 사용합니다.
 * 새 도구를 추가할 때 이 파일에 추가하면 됩니다.
 *
 * 참고: createAgentTool은 런타임 의존성(client, model, strategy 등)이 필요하므로
 * 이 배럴에 포함하지 않고 index.ts에서 별도로 등록합니다.
 */
import { type ToolDefinition } from "./types.js";
import { fileReadTool } from "./definitions/file-read.js";
import { fileWriteTool } from "./definitions/file-write.js";
import { fileEditTool } from "./definitions/file-edit.js";
import { bashExecTool } from "./definitions/bash-exec.js";
import { bashOutputTool } from "./definitions/bash-output.js";
import { killShellTool } from "./definitions/kill-shell.js";
import { globSearchTool } from "./definitions/glob-search.js";
import { grepSearchTool } from "./definitions/grep-search.js";
import { askUserTool } from "./definitions/ask-user.js";
import { mkdirTool } from "./definitions/mkdir.js";
import { webFetchTool } from "./definitions/web-fetch.js";
import { webSearchTool } from "./definitions/web-search.js";
import { listDirTool } from "./definitions/list-dir.js";
import { notebookEditTool } from "./definitions/notebook-edit.js";
import { todoWriteTool } from "./definitions/todo-write.js";
import { symbolSearchTool } from "./definitions/symbol-search.js";
import { codeOutlineTool } from "./definitions/code-outline.js";
import { findDependenciesTool } from "./definitions/find-dependencies.js";
import { gotoDefinitionTool } from "./definitions/goto-definition.js";
import { findReferencesTool } from "./definitions/find-references.js";
import { getTypeInfoTool } from "./definitions/get-type-info.js";
import { safeRenameTool } from "./definitions/safe-rename.js";
import { applyPatchTool } from "./definitions/apply-patch.js";
import { batchFileOpsTool } from "./definitions/batch-file-ops.js";
import { codeModeTool } from "./definitions/code-mode.js";
import { refactorTool } from "./definitions/refactor.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const builtinTools: readonly ToolDefinition<any>[] = [
  fileReadTool,
  fileWriteTool,
  fileEditTool,
  bashExecTool,
  bashOutputTool,
  killShellTool,
  globSearchTool,
  grepSearchTool,
  askUserTool,
  mkdirTool,
  webFetchTool,
  webSearchTool,
  listDirTool,
  notebookEditTool,
  todoWriteTool,
  symbolSearchTool,
  codeOutlineTool,
  findDependenciesTool,
  gotoDefinitionTool,
  findReferencesTool,
  getTypeInfoTool,
  safeRenameTool,
  applyPatchTool,
  batchFileOpsTool,
  codeModeTool,
  refactorTool,
];

/** createAgentTool은 런타임 의존성이 필요하므로 별도 re-export */
export { createAgentTool } from "./definitions/agent.js";
