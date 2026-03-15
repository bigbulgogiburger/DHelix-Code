/**
 * 레포지토리 맵 — 코드베이스의 구조를 경량 분석하여 AI에게 전체 그림을 제공
 *
 * 프로젝트의 모든 소스 파일을 스캔하여 심볼(클래스, 함수, 인터페이스, 타입, 상수, enum)과
 * import 관계를 추출합니다. 이 정보를 LLM의 컨텍스트에 주입하면,
 * AI가 "이 프로젝트에 어떤 모듈이 있고, 어떤 함수가 export되는지" 파악할 수 있습니다.
 *
 * 분석 방법: 정규식(regex) 기반 — tree-sitter보다 가볍고 빠름
 * 지원 언어: TypeScript, JavaScript (.ts, .tsx, .js, .jsx)
 *
 * 주의: 정규식 기반이므로 100% 정확하지 않을 수 있지만,
 * 컨텍스트 제공 목적으로는 충분한 정확도를 가집니다.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { BaseError } from "../utils/error.js";

/**
 * 레포 맵 에러 — 분석 중 발생한 오류
 */
export class RepoMapError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "REPO_MAP_ERROR", context);
  }
}

/**
 * 소스 파일에서 추출된 심볼(기호) 하나를 나타내는 인터페이스
 *
 * 심볼은 코드에서 이름이 있는 선언(클래스, 함수, 인터페이스 등)입니다.
 */
export interface RepoSymbol {
  /** 심볼 이름 (예: "UserService", "loadConfig") */
  readonly name: string;
  /** 심볼 종류: class, function, interface, type, const, enum */
  readonly kind: "class" | "function" | "interface" | "type" | "const" | "enum";
  /** 심볼이 정의된 파일 경로 (프로젝트 루트 기준 상대 경로) */
  readonly file: string;
  /** 심볼이 정의된 줄 번호 (1부터 시작) */
  readonly line: number;
  /** export 키워드가 있는지 여부 — true이면 외부 모듈에서 사용 가능 */
  readonly exported: boolean;
}

/**
 * 레포 맵의 파일 항목 — 파일 하나의 심볼과 임포트 정보
 */
export interface RepoFileEntry {
  /** 파일 경로 (프로젝트 루트 기준 상대 경로, 예: "src/config/loader.ts") */
  readonly path: string;
  /** 이 파일에서 추출된 심볼 목록 */
  readonly symbols: readonly RepoSymbol[];
  /** 이 파일이 import하는 모듈 경로 목록 (from 절의 문자열) */
  readonly imports: readonly string[];
  /** 파일 크기 (바이트) */
  readonly size: number;
}

/**
 * 전체 레포지토리 맵 — 프로젝트 전체의 분석 결과
 */
export interface RepoMap {
  /** 프로젝트 루트 디렉토리의 절대 경로 */
  readonly root: string;
  /** 분석된 모든 파일의 항목 배열 */
  readonly files: readonly RepoFileEntry[];
  /** 전체 심볼 수 (모든 파일 합산) */
  readonly totalSymbols: number;
  /** 분석된 전체 파일 수 */
  readonly totalFiles: number;
}

/** 심볼 추출을 지원하는 파일 확장자 */
const SUPPORTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

/** 분석에서 건너뛸 디렉토리 — 라이브러리, 빌드 산출물 등 */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

/**
 * TypeScript/JavaScript 심볼 추출용 정규식 패턴
 *
 * 각 패턴은 줄의 시작에서 매칭하며, 캡처 그룹 [1]이 심볼 이름입니다.
 * export 키워드 유무는 별도로 확인합니다.
 */
const PATTERNS = {
  /** 클래스 선언: [export] [abstract] class ClassName */
  classDecl: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
  /** 함수 선언: [export] [async] function functionName */
  functionDecl: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
  /** 인터페이스 선언: [export] interface InterfaceName */
  interfaceDecl: /^(?:export\s+)?interface\s+(\w+)/,
  /** 타입 별칭 선언: [export] type TypeName = */
  typeDecl: /^(?:export\s+)?type\s+(\w+)\s*=/,
  /** 상수 선언: [export] const CONST_NAME =|: */
  constDecl: /^(?:export\s+)?const\s+(\w+)\s*[=:]/,
  /** enum 선언: [export] enum EnumName */
  enumDecl: /^(?:export\s+)?enum\s+(\w+)/,
  /** import 선언: import ... from 'module-path' */
  importDecl: /^import\s+.*from\s+['"]([^'"]+)['"]/,
} as const;

/**
 * 소스 파일에서 심볼과 임포트를 추출
 *
 * 파일의 각 줄을 정규식으로 검사하여 심볼 선언과 import 문을 찾습니다.
 *
 * @param content - 소스 파일의 전체 내용
 * @param filePath - 파일의 상대 경로 (심볼에 기록됨)
 * @returns 추출된 심볼 배열과 임포트 경로 배열
 */
function extractSymbols(
  content: string,
  filePath: string,
): {
  symbols: RepoSymbol[];
  imports: string[];
} {
  const symbols: RepoSymbol[] = [];
  const imports: string[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1; // 줄 번호는 1부터 시작

    // import 문 추출: import { ... } from 'path'
    const importMatch = line.match(PATTERNS.importDecl);
    if (importMatch) {
      imports.push(importMatch[1]);
      continue; // import 줄은 심볼 검사 건너뜀
    }

    // export 키워드 존재 여부 확인
    const isExported = line.startsWith("export");

    // 각 심볼 패턴을 순서대로 매칭 시도 (첫 매칭에서 중단)
    for (const [patternName, pattern] of Object.entries(PATTERNS)) {
      if (patternName === "importDecl") continue; // import 패턴은 위에서 처리됨
      const match = line.match(pattern);
      if (match) {
        // 패턴 이름에서 "Decl" 접미사를 제거하여 kind 결정
        // (예: "classDecl" → "class", "functionDecl" → "function")
        const kind = patternName.replace("Decl", "") as RepoSymbol["kind"];
        symbols.push({
          name: match[1],
          kind,
          file: filePath,
          line: lineNum,
          exported: isExported,
        });
        break; // 한 줄에서 첫 매칭만 사용
      }
    }
  }

  return { symbols, imports };
}

/**
 * 디렉토리를 재귀적으로 탐색하여 모든 소스 파일 경로를 수집
 *
 * SKIP_DIRS에 포함된 디렉토리(node_modules, .git 등)는 건너뜁니다.
 * SUPPORTED_EXTENSIONS에 해당하는 파일만 수집합니다.
 *
 * @param dir - 탐색할 디렉토리 경로
 * @param root - 프로젝트 루트 경로 (상대 경로 계산용)
 * @returns 소스 파일의 절대 경로 배열
 */
async function collectFiles(dir: string, root: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      // 건너뛸 디렉토리 확인 (node_modules, .git 등)
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);
      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        // 하위 디렉토리 재귀 탐색
        const subFiles = await collectFiles(fullPath, root);
        files.push(...subFiles);
      } else if (SUPPORTED_EXTENSIONS.has(extname(entry))) {
        // 지원하는 확장자의 파일만 수집
        files.push(fullPath);
      }
    }
  } catch (error) {
    // ENOENT(디렉토리 없음)는 무시, 그 외 에러는 재발생
    if (
      !(
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      )
    ) {
      throw error;
    }
  }

  return files;
}

/**
 * 프로젝트 루트 디렉토리에서 레포지토리 맵을 빌드
 *
 * 모든 소스 파일을 스캔하여 심볼과 임포트를 추출하고,
 * 전체 프로젝트의 구조를 나타내는 RepoMap을 생성합니다.
 *
 * @param rootDir - 프로젝트 루트 디렉토리의 절대 경로
 * @returns 전체 레포 맵 (파일 목록, 심볼, 통계)
 */
export async function buildRepoMap(rootDir: string): Promise<RepoMap> {
  // 모든 소스 파일 경로 수집
  const filePaths = await collectFiles(rootDir, rootDir);
  const files: RepoFileEntry[] = [];
  let totalSymbols = 0;

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath, "utf-8");
      // 절대 경로를 프로젝트 루트 기준 상대 경로로 변환
      const relPath = relative(rootDir, filePath).replace(/\\/g, "/");
      const { symbols, imports } = extractSymbols(content, relPath);

      files.push({
        path: relPath,
        symbols,
        imports,
        size: content.length,
      });

      totalSymbols += symbols.length;
    } catch {
      // 읽을 수 없는 파일은 건너뜀 (바이너리 파일 등)
    }
  }

  return {
    root: rootDir,
    files,
    totalSymbols,
    totalFiles: files.length,
  };
}

/**
 * 레포 맵을 LLM 컨텍스트 주입용 문자열로 렌더링
 *
 * export된 심볼만 표시하여 간결한 프로젝트 구조 요약을 생성합니다.
 * 토큰 예산(budget)을 초과하지 않도록 자동으로 잘립니다.
 *
 * 출력 예시:
 * Repository Map (42 files, 156 symbols)
 *
 * src/config/loader.ts:
 *   function loadConfig (L69)
 * src/skills/manager.ts:
 *   class SkillManager (L32)
 *
 * @param map - 렌더링할 레포 맵
 * @param maxTokens - 최대 토큰 예산 (기본: 4000, 약 16000자)
 * @returns 렌더링된 텍스트 (토큰 예산 내)
 */
export function renderRepoMap(map: RepoMap, maxTokens = 4000): string {
  // 토큰 예산을 문자 수로 변환 (대략 1토큰 ≈ 4자)
  const maxChars = maxTokens * 4;
  const lines: string[] = [
    `Repository Map (${map.totalFiles} files, ${map.totalSymbols} symbols)`,
    "",
  ];

  let charCount = lines.join("\n").length;

  for (const file of map.files) {
    // export된 심볼만 표시 (내부 심볼은 외부 모듈에서 접근 불가)
    const exportedSymbols = file.symbols.filter((s) => s.exported);
    if (exportedSymbols.length === 0) continue;

    const fileLine = `${file.path}:`;
    // 각 심볼을 "  종류 이름 (L줄번호)" 형식으로 표시
    const symbolLines = exportedSymbols.map((s) => `  ${s.kind} ${s.name} (L${s.line})`);
    const block = [fileLine, ...symbolLines].join("\n");

    // 토큰 예산 초과 시 중단
    if (charCount + block.length + 1 > maxChars) break;

    lines.push(block);
    charCount += block.length + 1;
  }

  return lines.join("\n");
}
