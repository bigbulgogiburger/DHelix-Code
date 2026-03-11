// Auto-Memory System — public API

export { MemoryManager } from "./manager.js";
export { loadProjectMemory, loadTopicMemory, listTopicFiles, MemoryLoadError } from "./loader.js";
export {
  appendMemory,
  saveMemory,
  writeTopicFile,
  clearMemory,
  MemoryWriteError,
} from "./writer.js";
export { computeProjectHash, getMemoryDir, getMemoryFilePath, getTopicFilePath } from "./paths.js";
export type { MemoryConfig, MemoryEntry, MemoryLoadResult } from "./types.js";
export { memoryEntrySchema } from "./types.js";
