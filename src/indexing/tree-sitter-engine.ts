/**
 * Tree-sitter 파싱 엔진 — web-tree-sitter WASM 기반 코드 구조 분석
 *
 * 프로젝트 소스 파일을 tree-sitter로 파싱하여 심볼, 임포트, 익스포트를 추출합니다.
 * 15개 이상의 언어를 지원하며, WASM 기반으로 플랫폼 독립적입니다.
 *
 * repo-map.ts의 정규식 기반 분석보다 정확한 AST 기반 분석을 제공하며,
 * 언어별 SymbolExtractor를 등록하여 확장할 수 있습니다.
 *
 * @example
 * import { TreeSitterEngine } from "./tree-sitter-engine.js";
 * const engine = new TreeSitterEngine();
 * await engine.init();
 * const outline = await engine.getOutline("src/config/loader.ts");
 */

import { createRequire } from "node:module";
import { readFile, lstat } from "node:fs/promises";
import { join, extname } from "node:path";

import type * as TreeSitter from "web-tree-sitter";
import fg from "fast-glob";

import { getLogger } from "../utils/logger.js";

const require = createRequire(import.meta.url);
const log = getLogger();

// ─── 타입 정의 ─────────────────────────────────────────────────────────

/**
 * 소스 파일에서 파싱된 심볼 하나를 나타내는 인터페이스
 *
 * repo-map의 RepoSymbol보다 상세한 정보(시그니처, 부모, 문서화 주석 등)를 포함합니다.
 */
export interface ParsedSymbol {
  /** 심볼 이름 (예: "UserService", "loadConfig") */
  readonly name: string;
  /** 심볼 종류 */
  readonly kind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "variable"
    | "method"
    | "enum"
    | "constant";
  /** 심볼이 정의된 파일의 절대 경로 */
  readonly filePath: string;
  /** 심볼 시작 줄 번호 (1부터 시작) */
  readonly startLine: number;
  /** 심볼 끝 줄 번호 (1부터 시작) */
  readonly endLine: number;
  /** export 키워드 존재 여부 */
  readonly exported: boolean;
  /** 함수/메서드 시그니처 (예: "(name: string, age: number): User") */
  readonly signature?: string;
  /** 부모 클래스/인터페이스 이름 (메서드인 경우) */
  readonly parentName?: string;
  /** JSDoc/docstring 등 문서화 주석 */
  readonly documentation?: string;
}

/**
 * 소스 파일의 import 문 하나를 나타내는 인터페이스
 */
export interface ImportInfo {
  /** import 소스 경로 (예: "./config.js", "react") */
  readonly source: string;
  /** import한 이름 목록 (예: ["useState", "useEffect"]) */
  readonly specifiers: readonly string[];
  /** default import 여부 (import Foo from ...) */
  readonly isDefault: boolean;
  /** namespace import 여부 (import * as Foo from ...) */
  readonly isNamespace: boolean;
  /** import 문이 위치한 줄 번호 (1부터 시작) */
  readonly line: number;
}

/**
 * 소스 파일 하나의 전체 구조 요약
 */
export interface FileOutline {
  /** 파일의 절대 경로 */
  readonly filePath: string;
  /** 파싱에 사용된 언어 이름 (예: "typescript", "python") */
  readonly language: string;
  /** 추출된 심볼 목록 */
  readonly symbols: readonly ParsedSymbol[];
  /** 추출된 import 목록 */
  readonly imports: readonly ImportInfo[];
  /** export된 이름 목록 */
  readonly exports: readonly string[];
}

/**
 * 언어별 심볼 추출 함수의 타입
 *
 * 각 언어마다 AST 노드 구조가 다르므로, 언어별 추출 로직을 분리합니다.
 * Agent 2, Agent 3 등이 별도로 구현하여 registerExtractor()로 등록합니다.
 */
export type SymbolExtractor = (
  rootNode: TreeSitter.Node,
  filePath: string,
  source: string,
) => {
  readonly symbols: readonly ParsedSymbol[];
  readonly imports: readonly ImportInfo[];
  readonly exports: readonly string[];
};

// ─── 캐시 엔트리 타입 ───────────────────────────────────────────────────

interface CacheEntry {
  readonly outline: FileOutline;
  readonly mtime: number;
}

// ─── 엔진 클래스 ────────────────────────────────────────────────────────

/**
 * Tree-sitter 기반 코드 파싱 엔진
 *
 * web-tree-sitter(WASM)를 사용하여 소스 파일을 AST로 파싱하고,
 * 등록된 SymbolExtractor를 통해 심볼/임포트/익스포트를 추출합니다.
 *
 * 주요 특징:
 * - WASM 런타임 초기화 (idempotent)
 * - 언어 문법 lazy 로딩 + 캐싱
 * - 파일 mtime 기반 파싱 캐시 (최대 200개)
 * - 언어별 추출기(SymbolExtractor) 플러그인 구조
 *
 * @example
 * const engine = new TreeSitterEngine();
 * await engine.init();
 * engine.registerExtractor("typescript", typescriptExtractor);
 * const outline = await engine.getOutline("/path/to/file.ts");
 */
export class TreeSitterEngine {
  /** WASM 런타임 초기화 완료 여부 */
  private initialized = false;

  /** web-tree-sitter Parser 클래스 참조 (init() 후 설정) */
  private ParserClass: typeof TreeSitter.Parser | undefined;

  /** web-tree-sitter Language 클래스 참조 (init() 후 설정) */
  private LanguageClass: typeof TreeSitter.Language | undefined;

  /** 로딩된 언어 문법 캐시 (언어 이름 → Language 객체) */
  private readonly languageCache: Map<string, TreeSitter.Language> = new Map();

  /** 파싱 결과 캐시 (파일 경로 → {outline, mtime}) */
  private readonly parseCache: Map<string, CacheEntry> = new Map();

  /** 언어별 심볼 추출 함수 (언어 이름 → SymbolExtractor) */
  private readonly extractors: Map<string, SymbolExtractor> = new Map();

  /** 파일 확장자 → tree-sitter 언어 이름 매핑 */
  private static readonly LANGUAGE_MAP: Readonly<Record<string, string>> = {
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

  /** 최대 파싱 캐시 크기 — 초과 시 가장 오래된 항목부터 제거 */
  private static readonly MAX_CACHE_SIZE = 200;

  constructor() {
    // 필드는 선언부에서 초기화됨
  }

  // ─── 초기화 ─────────────────────────────────────────────────────────

  /**
   * web-tree-sitter WASM 런타임을 초기화합니다 (idempotent).
   *
   * 첫 호출 시에만 WASM 모듈을 로드하며, 이후 호출은 즉시 반환됩니다.
   * getOutline(), searchSymbols() 등을 호출하기 전에 반드시 실행해야 합니다.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const { Parser: ParserCls, Language: LangCls } = await import("web-tree-sitter");
      const wasmPath = require.resolve("web-tree-sitter/web-tree-sitter.wasm");
      await ParserCls.init({ locateFile: () => wasmPath });
      this.ParserClass = ParserCls;
      this.LanguageClass = LangCls;
      this.initialized = true;
      log.debug("tree-sitter WASM 런타임 초기화 완료");
    } catch (error) {
      log.error({ error }, "tree-sitter WASM 런타임 초기화 실패");
    }
  }

  // ─── 언어 로딩 ──────────────────────────────────────────────────────

  /**
   * 언어 문법을 로드합니다 (lazy, 캐시됨).
   *
   * tree-sitter-wasms 패키지에서 WASM 파일을 찾아 로드합니다.
   * 한번 로드된 언어는 캐시되어 재사용됩니다.
   *
   * @param langName - tree-sitter 언어 이름 (예: "typescript", "python")
   * @returns Language 객체, 로드 실패 시 undefined
   */
  async loadLanguage(langName: string): Promise<TreeSitter.Language | undefined> {
    if (!this.initialized || !this.ParserClass || !this.LanguageClass) {
      log.warn("tree-sitter가 초기화되지 않음 — loadLanguage 호출 전 init() 필요");
      return undefined;
    }

    const cached = this.languageCache.get(langName);
    if (cached) return cached;

    try {
      const wasmPath = require.resolve(
        `tree-sitter-wasms/out/tree-sitter-${langName}.wasm`,
      );
      const lang = await this.LanguageClass.load(wasmPath);
      this.languageCache.set(langName, lang);
      log.debug({ langName }, "tree-sitter 언어 문법 로드 완료");
      return lang;
    } catch (error) {
      log.debug({ langName, error }, "tree-sitter 언어 문법 로드 실패 — WASM 파일 없음");
      return undefined;
    }
  }

  // ─── 유틸리티 ────────────────────────────────────────────────────────

  /**
   * 파일 확장자가 지원되는 언어인지 확인합니다.
   *
   * @param ext - 파일 확장자 (점 포함, 예: ".ts", ".py")
   * @returns 지원 여부
   */
  isSupported(ext: string): boolean {
    return ext in TreeSitterEngine.LANGUAGE_MAP;
  }

  /**
   * 지원되는 언어 목록을 반환합니다.
   *
   * @returns 언어 이름 배열 (중복 제거됨)
   */
  getSupportedLanguages(): readonly string[] {
    return [...new Set(Object.values(TreeSitterEngine.LANGUAGE_MAP))];
  }

  /**
   * 파싱 캐시를 모두 제거합니다.
   *
   * 메모리 절약이 필요하거나 파일이 대량으로 변경된 경우 사용합니다.
   */
  clearCache(): void {
    this.parseCache.clear();
    log.debug("tree-sitter 파싱 캐시 전체 삭제");
  }

  // ─── 추출기 등록 ────────────────────────────────────────────────────

  /**
   * 언어별 심볼 추출 함수를 등록합니다.
   *
   * 각 언어의 AST 구조는 다르므로, 언어별 추출 로직을 별도로 구현하여
   * 이 메서드로 등록합니다. 이미 등록된 언어에 다시 등록하면 덮어씁니다.
   *
   * @param language - tree-sitter 언어 이름 (예: "typescript", "python")
   * @param extractor - 심볼 추출 함수
   */
  registerExtractor(language: string, extractor: SymbolExtractor): void {
    this.extractors.set(language, extractor);
    log.debug({ language }, "심볼 추출기 등록 완료");
  }

  // ─── 파일 파싱 ──────────────────────────────────────────────────────

  /**
   * 파일을 파싱하여 구조 요약(FileOutline)을 반환합니다.
   *
   * mtime(수정 시간) 기반 캐시를 사용하여 변경되지 않은 파일은 재파싱하지 않습니다.
   * 캐시가 MAX_CACHE_SIZE를 초과하면 가장 오래된 항목부터 제거합니다.
   *
   * @param filePath - 파싱할 파일의 절대 경로
   * @returns FileOutline 객체, 실패 시 undefined
   */
  async getOutline(filePath: string): Promise<FileOutline | undefined> {
    if (!this.initialized || !this.ParserClass) {
      log.warn("tree-sitter가 초기화되지 않음 — getOutline 호출 전 init() 필요");
      return undefined;
    }

    // 확장자에서 언어 결정
    const ext = extname(filePath);
    const langName = TreeSitterEngine.LANGUAGE_MAP[ext];
    if (!langName) {
      log.debug({ filePath, ext }, "지원하지 않는 파일 확장자");
      return undefined;
    }

    // mtime 기반 캐시 확인
    let mtime: number;
    try {
      const stats = await lstat(filePath);
      mtime = stats.mtimeMs;
    } catch {
      log.debug({ filePath }, "파일 stat 실패 — 파일이 존재하지 않거나 접근 불가");
      return undefined;
    }

    const cached = this.parseCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.outline;
    }

    // 언어 문법 로드
    const language = await this.loadLanguage(langName);
    if (!language) {
      return undefined;
    }

    // 파일 읽기
    let source: string;
    try {
      source = await readFile(filePath, "utf-8");
    } catch {
      log.debug({ filePath }, "파일 읽기 실패");
      return undefined;
    }

    // 파싱 실행
    const parser = new this.ParserClass();
    try {
      parser.setLanguage(language);
      const tree = parser.parse(source);
      if (!tree) {
        log.debug({ filePath }, "tree-sitter 파싱 결과가 null");
        return undefined;
      }

      try {
        // 심볼 추출기가 등록되어 있으면 사용, 없으면 빈 결과
        const extractor = this.extractors.get(langName);
        const extracted = extractor
          ? extractor(tree.rootNode, filePath, source)
          : { symbols: [], imports: [], exports: [] };

        const outline: FileOutline = {
          filePath,
          language: langName,
          symbols: extracted.symbols,
          imports: extracted.imports,
          exports: extracted.exports,
        };

        // 캐시 크기 제한 — 초과 시 가장 오래된 항목 제거
        if (this.parseCache.size >= TreeSitterEngine.MAX_CACHE_SIZE) {
          const firstKey = this.parseCache.keys().next().value;
          if (firstKey !== undefined) {
            this.parseCache.delete(firstKey);
          }
        }

        this.parseCache.set(filePath, { outline, mtime });
        return outline;
      } finally {
        tree.delete();
      }
    } finally {
      // WASM 메모리 해제
      parser.delete();
    }
  }

  // ─── 심볼 검색 ──────────────────────────────────────────────────────

  /**
   * 여러 파일에서 심볼을 검색합니다.
   *
   * fast-glob으로 파일을 탐색한 뒤, 각 파일의 outline에서
   * 쿼리 문자열과 이름이 매칭되는 심볼을 수집합니다.
   *
   * @param query - 검색할 심볼 이름 (부분 일치, 대소문자 무시)
   * @param options - 검색 옵션
   * @param options.kind - 특정 종류만 필터링
   * @param options.directory - 검색 디렉토리 (기본: cwd)
   * @param options.maxResults - 최대 결과 수 (기본: 50)
   * @param options.fileExtensions - 검색할 파일 확장자 (기본: 전체 지원 확장자)
   * @returns 매칭된 심볼 배열
   */
  async searchSymbols(
    query: string,
    options?: {
      readonly kind?: ParsedSymbol["kind"];
      readonly directory?: string;
      readonly maxResults?: number;
      readonly fileExtensions?: readonly string[];
    },
  ): Promise<readonly ParsedSymbol[]> {
    const dir = options?.directory ?? process.cwd();
    const maxResults = options?.maxResults ?? 50;
    const extensions =
      options?.fileExtensions ?? Object.keys(TreeSitterEngine.LANGUAGE_MAP);
    const patterns = extensions.map((ext) =>
      ext.startsWith(".") ? `**/*${ext}` : `**/*.${ext}`,
    );

    let files: readonly string[];
    try {
      files = await fg(patterns, {
        cwd: dir,
        ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
        absolute: false,
      });
    } catch {
      log.debug({ dir }, "fast-glob 파일 탐색 실패");
      return [];
    }

    const results: ParsedSymbol[] = [];
    const lowerQuery = query.toLowerCase();

    for (const file of files) {
      if (results.length >= maxResults) break;

      const absolutePath = join(dir, file);
      const outline = await this.getOutline(absolutePath);
      if (!outline) continue;

      for (const sym of outline.symbols) {
        if (results.length >= maxResults) break;

        const nameMatches = sym.name.toLowerCase().includes(lowerQuery);
        if (!nameMatches) continue;

        const kindMatches = !options?.kind || sym.kind === options.kind;
        if (!kindMatches) continue;

        results.push(sym);
      }
    }

    return results;
  }

  // ─── 의존성 분석 ────────────────────────────────────────────────────

  /**
   * 파일의 import/export 의존성을 분석합니다.
   *
   * getOutline()의 결과에서 imports와 exports만 추출하여 반환합니다.
   *
   * @param filePath - 분석할 파일의 절대 경로
   * @returns imports와 exports 정보, 실패 시 빈 결과
   */
  async findDependencies(
    filePath: string,
  ): Promise<{ readonly imports: readonly ImportInfo[]; readonly exports: readonly string[] }> {
    const outline = await this.getOutline(filePath);
    if (!outline) {
      return { imports: [], exports: [] };
    }
    return { imports: outline.imports, exports: outline.exports };
  }
}
