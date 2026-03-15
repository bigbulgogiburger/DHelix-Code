/**
 * 자동 메모리 시스템 — 공개 API 모듈
 *
 * 이 파일은 memory/ 디렉토리의 배럴(barrel) 파일로,
 * 외부에서 사용할 클래스, 함수, 타입을 모아 re-export합니다.
 *
 * 사용 예시:
 * import { MemoryManager, loadProjectMemory } from './memory/index.js';
 *
 * 배럴 파일의 장점:
 * - 하나의 import 경로로 여러 내보내기에 접근 가능
 * - 내부 구현 파일을 직접 import하지 않아도 됨
 * - 내부 리팩토링 시 외부 코드 변경 최소화
 */

// 매니저 클래스 — 메모리 로드/저장/조회를 관리하는 중앙 클래스
export { MemoryManager } from "./manager.js";

// 로더 함수 — 메모리 파일 읽기 관련
export { loadProjectMemory, loadTopicMemory, listTopicFiles, MemoryLoadError } from "./loader.js";

// 라이터 함수 — 메모리 파일 쓰기 관련
export {
  appendMemory,
  saveMemory,
  writeTopicFile,
  clearMemory,
  MemoryWriteError,
} from "./writer.js";

// 경로 유틸리티 — 프로젝트별 메모리 경로 계산
export { computeProjectHash, getMemoryDir, getMemoryFilePath, getTopicFilePath } from "./paths.js";

// 타입 내보내기 — 외부에서 타입 참조용
export type { MemoryConfig, MemoryEntry, MemoryLoadResult } from "./types.js";

// Zod 스키마 — 메모리 항목 입력 검증용
export { memoryEntrySchema } from "./types.js";
