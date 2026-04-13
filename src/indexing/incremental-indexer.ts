/**
 * Incremental Tree-Sitter Indexer — 변경된 파일만 선택적으로 재인덱싱
 *
 * 파일이 변경되었을 때만 해당 파일의 인덱스를 업데이트합니다.
 * SHA-256 해시 비교를 통해 실제로 내용이 바뀐 파일만 처리하며,
 * 배치 크기 제한으로 대량 변경 시에도 시스템 부하를 제어합니다.
 *
 * @example
 * import { IncrementalIndexer } from "./incremental-indexer.js";
 * const indexer = new IncrementalIndexer({ debounceMs: 300, maxBatchSize: 30 });
 * const result = await indexer.processChanges([
 *   { path: "/project/src/foo.ts", type: "modified", timestamp: Date.now() },
 * ]);
 * console.log(result.indexed, result.skipped);
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

import { getLogger } from "../utils/logger.js";

const log = getLogger();

// ─── 공개 인터페이스 ────────────────────────────────────────────────────

/**
 * 파일 변경 이벤트 — 파일 감시기(watcher)가 감지한 변경 사항
 */
export interface FileChangeEvent {
  /** 변경된 파일의 절대 경로 */
  readonly path: string;
  /** 변경 유형: 생성/수정/삭제 */
  readonly type: "created" | "modified" | "deleted";
  /** 이벤트 발생 시각 (Unix timestamp ms) */
  readonly timestamp: number;
}

/**
 * 인덱스 항목 — 파일 하나의 인덱싱 메타데이터
 */
export interface IndexEntry {
  /** 파일의 절대 경로 */
  readonly filePath: string;
  /** tree-sitter 언어 이름 (예: "typescript", "python") */
  readonly language: string;
  /** 마지막으로 인덱싱된 시각 (Unix timestamp ms) */
  readonly lastIndexedAt: number;
  /** 파일 내용의 SHA-256 해시 (변경 감지에 사용) */
  readonly contentHash: string;
  /** 이 파일에서 추출된 심볼 수 */
  readonly symbolCount: number;
}

/**
 * 증분 인덱서 설정
 */
export interface IncrementalIndexerConfig {
  /**
   * 파일 변경 이벤트 디바운스 대기 시간 (ms)
   * @default 500
   */
  readonly debounceMs?: number;
  /**
   * 한 번의 processChanges 호출에서 처리할 최대 파일 수
   * @default 50
   */
  readonly maxBatchSize?: number;
  /**
   * 인덱싱 대상 파일 glob 패턴 목록
   * @default ['**\/*.ts', '**\/*.tsx', '**\/*.js', ...]
   */
  readonly watchPatterns?: readonly string[];
  /**
   * 인덱싱에서 제외할 glob 패턴 목록
   * @default ['node_modules', 'dist', '.git', 'build', '.next', 'coverage']
   */
  readonly ignorePatterns?: readonly string[];
}

/**
 * 증분 인덱싱 결과 요약
 */
export interface IncrementalResult {
  /** 새로 인덱싱된 파일 수 (created 또는 해시 변경된 modified) */
  readonly indexed: number;
  /** 인덱스에서 제거된 파일 수 (deleted) */
  readonly removed: number;
  /** 해시 동일로 스킵된 파일 수 */
  readonly skipped: number;
  /** 처리 중 오류가 발생한 파일 목록 */
  readonly errors: readonly { filePath: string; error: string }[];
  /** 전체 처리 소요 시간 (ms) */
  readonly durationMs: number;
}

/**
 * 인덱스 통계 정보
 */
export interface IndexStats {
  /** 인덱스에 등록된 전체 파일 수 */
  readonly totalFiles: number;
  /** 인덱스에 등록된 전체 심볼 수 */
  readonly totalSymbols: number;
  /** 마지막 전체 재인덱싱 시각 (ms). 한 번도 실행되지 않았으면 0 */
  readonly lastFullIndexAt: number;
  /** 지금까지 수행된 증분 업데이트 횟수 */
  readonly incrementalUpdates: number;
}

// ─── 기본값 상수 ───────────────────────────────────────────────────────

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MAX_BATCH_SIZE = 50;

/** 기본 감시 대상 파일 패턴 */
const DEFAULT_WATCH_PATTERNS: readonly string[] = [
  "**/*.ts",
  "**/*.tsx",
  "**/*.js",
  "**/*.jsx",
  "**/*.py",
  "**/*.go",
  "**/*.rs",
  "**/*.java",
  "**/*.c",
  "**/*.cpp",
  "**/*.cs",
  "**/*.rb",
  "**/*.php",
  "**/*.swift",
  "**/*.kt",
] as const;

/** 기본 무시 패턴 */
const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  "node_modules",
  "dist",
  ".git",
  "build",
  ".next",
  "coverage",
] as const;

/** 파일 확장자 → tree-sitter 언어 이름 매핑 */
const EXTENSION_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".cs": "c_sharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
} as const;

// ─── 유틸리티 함수 ────────────────────────────────────────────────────

/**
 * 문자열 내용의 SHA-256 해시를 계산합니다.
 *
 * 파일 내용 변경 감지에 사용됩니다.
 * 동일한 내용은 항상 동일한 해시를 반환하므로 idempotent합니다.
 *
 * @param content - 해시를 계산할 문자열 (파일 내용)
 * @returns 16진수 형식의 SHA-256 해시 문자열
 *
 * @example
 * computeFileHash("hello world") // "b94d27b9934d3e08..."
 */
export function computeFileHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * glob 패턴 하나를 정규식으로 변환합니다.
 *
 * 지원 문법:
 * - `**` — 임의의 경로 세그먼트 (0개 이상)
 * - `*` — 단일 경로 세그먼트 내 임의 문자
 * - `?` — 임의의 단일 문자
 * - `.`, `+`, `^`, `$`, `(`, `)`, `[`, `]`, `{`, `}` — 이스케이프 처리
 *
 * @param pattern - 변환할 glob 패턴
 * @returns 정규식 객체
 */
function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  let regexStr = "";
  let i = 0;

  while (i < normalized.length) {
    const ch = normalized[i];

    if (ch === "*" && normalized[i + 1] === "*") {
      // `**` — 경로 구분자를 포함한 0개 이상의 임의 문자
      regexStr += ".*";
      i += 2;
      // `**/` 또는 `/**` 형태의 슬래시 처리
      if (normalized[i] === "/") {
        i++;
      }
    } else if (ch === "*") {
      // `*` — 경로 구분자를 제외한 0개 이상의 임의 문자
      regexStr += "[^/]*";
      i++;
    } else if (ch === "?") {
      // `?` — 경로 구분자를 제외한 임의의 단일 문자
      regexStr += "[^/]";
      i++;
    } else if (/[.+^$()[\]{}|]/.test(ch)) {
      // 정규식 특수문자 이스케이프
      regexStr += `\\${ch}`;
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/**
 * 파일 경로가 감시 패턴에 포함되고 무시 패턴에 해당하지 않는지 확인합니다.
 *
 * 무시 패턴은 경로의 임의 세그먼트에서 일치하면 제외됩니다.
 * 감시 패턴은 하나라도 매칭되면 포함됩니다.
 *
 * @param filePath - 검사할 파일 경로 (절대 또는 상대)
 * @param watchPatterns - 포함 패턴 목록 (예: ['**\/*.ts'])
 * @param ignorePatterns - 제외 패턴 목록 (예: ['node_modules', 'dist'])
 * @returns 인덱싱 대상이면 true
 *
 * @example
 * matchesPattern("src/foo.ts", ["**\/*.ts"], ["node_modules"]) // true
 * matchesPattern("node_modules/lib.ts", ["**\/*.ts"], ["node_modules"]) // false
 */
export function matchesPattern(
  filePath: string,
  watchPatterns: readonly string[],
  ignorePatterns: readonly string[],
): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const segments = normalized.split("/");

  // 무시 패턴 확인 — 경로 세그먼트에 직접 포함 또는 glob 매칭
  for (const ignore of ignorePatterns) {
    const normalizedIgnore = ignore.replace(/\\/g, "/");

    // 경로 세그먼트 중 하나가 무시 패턴과 일치하는지 확인
    if (segments.includes(normalizedIgnore)) {
      return false;
    }

    // glob 패턴으로 전체 경로 매칭
    const ignoreRegex = globToRegex(normalizedIgnore);
    if (ignoreRegex.test(normalized)) {
      return false;
    }

    // `**/ignoreName/**` 형태로도 확인
    const deepIgnoreRegex = globToRegex(`**/${normalizedIgnore}/**`);
    if (deepIgnoreRegex.test(normalized)) {
      return false;
    }
  }

  // 감시 패턴 확인 — 하나라도 매칭되면 포함
  for (const pattern of watchPatterns) {
    const regex = globToRegex(pattern);
    if (regex.test(normalized)) {
      return true;
    }
    // 절대 경로 끝부분 매칭도 시도
    const lastParts = normalized.split("/").slice(-2).join("/");
    if (regex.test(lastParts)) {
      return true;
    }
    // 파일명만으로도 매칭 시도
    const basename = segments[segments.length - 1] ?? "";
    const simplePattern = pattern.replace(/^\*\*\//, "");
    const simpleRegex = globToRegex(simplePattern);
    if (simpleRegex.test(basename)) {
      return true;
    }
  }

  return false;
}

// ─── 인덱서 클래스 ───────────────────────────────────────────────────

/**
 * 증분 인덱서 — 파일 변경 이벤트를 처리하여 인덱스를 최신 상태로 유지
 *
 * 파일 해시 비교를 통해 실제로 내용이 변경된 파일만 재인덱싱합니다.
 * `processChanges()`는 배치 크기 제한을 적용하여 대량 변경 시에도
 * 시스템 부하를 제어합니다.
 *
 * 주요 특징:
 * - SHA-256 해시 기반 변경 감지
 * - 배치 크기 제한 (maxBatchSize)
 * - glob 패턴 기반 파일 필터링
 * - dispose()로 리소스 정리
 *
 * @example
 * const indexer = new IncrementalIndexer({ maxBatchSize: 30 });
 * const result = await indexer.processChanges(events);
 * console.log(`indexed: ${result.indexed}, skipped: ${result.skipped}`);
 */
export class IncrementalIndexer {
  /** 파일 경로 → IndexEntry 매핑 */
  private readonly index: Map<string, IndexEntry> = new Map();

  /** 디바운스 대기 시간 (ms) */
  private readonly debounceMs: number;

  /** 배치당 최대 처리 파일 수 */
  private readonly maxBatchSize: number;

  /** 인덱싱 대상 glob 패턴 */
  private readonly watchPatterns: readonly string[];

  /** 제외 glob 패턴 */
  private readonly ignorePatterns: readonly string[];

  /** 마지막 전체 재인덱싱 시각 (ms) */
  private lastFullIndexAt = 0;

  /** 수행된 증분 업데이트 횟수 */
  private incrementalUpdateCount = 0;

  /** dispose 호출 여부 */
  private disposed = false;

  /**
   * 증분 인덱서를 생성합니다.
   *
   * @param config - 인덱서 설정 (모든 항목 선택적)
   */
  constructor(config?: IncrementalIndexerConfig) {
    this.debounceMs = config?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxBatchSize = config?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.watchPatterns = config?.watchPatterns ?? DEFAULT_WATCH_PATTERNS;
    this.ignorePatterns = config?.ignorePatterns ?? DEFAULT_IGNORE_PATTERNS;
  }

  // ─── 공개 API ──────────────────────────────────────────────────────

  /**
   * 현재 인덱스 상태를 읽기 전용 맵으로 반환합니다.
   *
   * 반환된 맵은 내부 맵의 읽기 전용 뷰이므로 직접 수정할 수 없습니다.
   *
   * @returns 파일 경로 → IndexEntry 맵 (읽기 전용)
   */
  getIndex(): ReadonlyMap<string, IndexEntry> {
    return this.index;
  }

  /**
   * 특정 파일이 재인덱싱이 필요한지 해시를 비교하여 판단합니다.
   *
   * 파일이 인덱스에 없으면 true, 해시가 다르면 true, 같으면 false를 반환합니다.
   *
   * @param filePath - 확인할 파일의 절대 경로
   * @param currentHash - 현재 파일 내용의 SHA-256 해시
   * @returns 재인덱싱이 필요하면 true
   */
  needsReindex(filePath: string, currentHash: string): boolean {
    const entry = this.index.get(filePath);
    if (!entry) return true;
    return entry.contentHash !== currentHash;
  }

  /**
   * 파일 변경 이벤트 목록을 처리하여 인덱스를 업데이트합니다.
   *
   * 처리 순서:
   * 1. 패턴 필터링 — watchPatterns/ignorePatterns에 맞지 않는 파일 제외
   * 2. 배치 크기 제한 — maxBatchSize 초과분은 처리하지 않음
   * 3. deleted: 인덱스에서 항목 제거
   * 4. created/modified: 파일 읽기 → 해시 비교 → 변경된 경우만 재인덱싱
   *
   * @param changes - 처리할 파일 변경 이벤트 배열
   * @returns 처리 결과 요약 (IncrementalResult)
   */
  async processChanges(changes: readonly FileChangeEvent[]): Promise<IncrementalResult> {
    this.assertNotDisposed();

    const startTime = Date.now();
    let indexed = 0;
    let removed = 0;
    let skipped = 0;
    const errors: { filePath: string; error: string }[] = [];

    // 패턴 필터링 — deleted 이벤트는 파일이 없으므로 패턴 검사 생략
    const filteredChanges = changes.filter((c) => {
      if (c.type === "deleted") return true;
      return matchesPattern(c.path, this.watchPatterns, this.ignorePatterns);
    });

    // 배치 크기 제한
    const batchChanges = filteredChanges.slice(0, this.maxBatchSize);

    for (const change of batchChanges) {
      try {
        if (change.type === "deleted") {
          if (this.index.has(change.path)) {
            this.index.delete(change.path);
            removed++;
          }
          continue;
        }

        // created / modified: 파일 읽기 및 해시 비교
        let content: string;
        try {
          content = await readFile(change.path, "utf-8");
        } catch (readErr) {
          errors.push({
            filePath: change.path,
            error: readErr instanceof Error ? readErr.message : String(readErr),
          });
          continue;
        }

        const currentHash = computeFileHash(content);

        if (!this.needsReindex(change.path, currentHash)) {
          skipped++;
          continue;
        }

        // 언어 결정
        const ext = extname(change.path);
        const language = EXTENSION_TO_LANGUAGE[ext] ?? "unknown";

        // 심볼 수 추정 (실제 tree-sitter 파싱 없이 간단하게 추정)
        const symbolCount = estimateSymbolCount(content);

        const entry: IndexEntry = {
          filePath: change.path,
          language,
          lastIndexedAt: Date.now(),
          contentHash: currentHash,
          symbolCount,
        };

        this.index.set(change.path, entry);
        indexed++;
      } catch (err) {
        errors.push({
          filePath: change.path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.incrementalUpdateCount++;

    const durationMs = Date.now() - startTime;
    log.debug({ indexed, removed, skipped, errors: errors.length, durationMs }, "증분 인덱싱 완료");

    return {
      indexed,
      removed,
      skipped,
      errors,
      durationMs,
    };
  }

  /**
   * 특정 파일의 인덱스를 무효화합니다.
   *
   * 무효화된 파일은 다음 processChanges() 호출 시 무조건 재인덱싱됩니다.
   * 파일이 인덱스에 없으면 아무 작업도 수행하지 않습니다.
   *
   * @param filePath - 무효화할 파일의 절대 경로
   */
  invalidate(filePath: string): void {
    this.assertNotDisposed();
    this.index.delete(filePath);
    log.debug({ filePath }, "파일 인덱스 무효화");
  }

  /**
   * 전체 인덱스를 초기화합니다.
   *
   * 모든 인덱스 항목을 삭제하여 다음 processChanges() 호출 시
   * 모든 파일이 새로 인덱싱되도록 합니다 (풀 리인덱싱 유도).
   */
  invalidateAll(): void {
    this.assertNotDisposed();
    const count = this.index.size;
    this.index.clear();
    this.lastFullIndexAt = 0;
    log.debug({ count }, "전체 인덱스 초기화");
  }

  /**
   * 인덱스 통계 정보를 반환합니다.
   *
   * @returns IndexStats 객체
   */
  getStats(): IndexStats {
    const totalSymbols = Array.from(this.index.values()).reduce(
      (sum, entry) => sum + entry.symbolCount,
      0,
    );

    return {
      totalFiles: this.index.size,
      totalSymbols,
      lastFullIndexAt: this.lastFullIndexAt,
      incrementalUpdates: this.incrementalUpdateCount,
    };
  }

  /**
   * 설정된 디바운스 대기 시간을 반환합니다.
   *
   * 파일 감시기가 연속된 변경 이벤트를 병합하는 데 사용합니다.
   *
   * @returns 디바운스 ms
   */
  getDebounceMs(): number {
    return this.debounceMs;
  }

  /**
   * 인덱서를 정리하고 모든 리소스를 해제합니다.
   *
   * dispose() 호출 후에는 어떤 메서드도 호출할 수 없습니다.
   * 중복 호출은 무시됩니다.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.index.clear();
    log.debug("IncrementalIndexer disposed");
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────────────────

  /**
   * dispose 여부를 확인하고 이미 해제된 경우 오류를 발생시킵니다.
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("IncrementalIndexer is already disposed");
    }
  }
}

// ─── 내부 유틸리티 ───────────────────────────────────────────────────

/**
 * 파일 내용에서 심볼 수를 간단하게 추정합니다.
 *
 * 정확한 파싱 없이 일반적인 선언 패턴을 카운트합니다.
 * 실제 정확한 심볼 수는 TreeSitterEngine.getOutline()을 사용하세요.
 *
 * @param content - 파일 내용
 * @returns 추정 심볼 수
 */
function estimateSymbolCount(content: string): number {
  const patterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+\w+/gm,
    /^(?:export\s+)?(?:abstract\s+)?class\s+\w+/gm,
    /^(?:export\s+)?interface\s+\w+/gm,
    /^(?:export\s+)?type\s+\w+\s*=/gm,
    /^(?:export\s+)?const\s+\w+\s*[=:]/gm,
    /^(?:export\s+)?enum\s+\w+/gm,
    /^def\s+\w+/gm,
    /^class\s+\w+/gm,
    /^func\s+\w+/gm,
    /^fn\s+\w+/gm,
    /^pub\s+fn\s+\w+/gm,
  ];

  let count = 0;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  }
  return count;
}
