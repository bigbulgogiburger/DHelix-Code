/**
 * LSP 모듈 — 언어 서버 프로토콜 통합 배럴 파일
 *
 * 외부에서는 이 파일만 import하여 LSP 기능을 사용합니다.
 *
 * @example
 * ```typescript
 * import { LSPManager, type LSPSession } from "./lsp/index.js";
 * ```
 */

export { LSPManager, LSPNotAvailableError, getLSPManager, disposeLSPManager } from "./manager.js";
export type {
  LSPSession,
  LSPLanguageId,
  LSPManagerConfig,
  LSPServerConfig,
  LSPServerInstance,
  LSPServerState,
  DefinitionResult,
  ReferenceResult,
  TypeInfoResult,
  RenameEdit,
} from "./types.js";
export {
  detectProjectLanguages,
  detectAvailableServers,
  getServerConfig,
  isServerInstalled,
} from "./language-detector.js";
