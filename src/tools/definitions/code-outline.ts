/**
 * 코드 아웃라인 도구 — 파일의 구조(함수, 클래스, 메서드, 타입)를 추출하는 도구
 *
 * 파일 전체를 읽지 않고도 코드 구조를 파악할 수 있어 토큰을 대폭 절약합니다.
 * 예: 500줄 파일(~2000 토큰) → 아웃라인(~200 토큰)
 *
 * 주요 기능:
 * - 트리 구조 출력: ├─ / └─ 로 중첩 심볼(클래스 내 메서드 등) 표현
 * - 줄 번호 표시: :{시작줄} 또는 :{시작줄}-{끝줄}
 * - export 마커: [exported] 태그로 외부 노출 여부 표시
 * - 함수 시그니처: 매개변수 목록 포함 (60자 초과 시 잘라냄)
 * - 파일 메타데이터: 언어, 전체 줄 수
 * - import 목록: 선택적으로 import 문 포함
 *
 * 정규식 기반 파서로 TypeScript, JavaScript, Python, Java, Go, Rust,
 * C/C++, C#, Ruby, PHP, Swift, Kotlin 등 주요 언어를 지원합니다.
 *
 * 권한 수준: "safe" — 파일 시스템을 읽기만 하므로 안전합니다.
 */
import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { type ToolDefinition, type ToolContext, type ToolResult } from "../types.js";
import { normalizePath, resolvePath } from "../../utils/path.js";

// ── 타입 정의 ──

/** 심볼의 종류 */
type SymbolKind =
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "function"
  | "method"
  | "const"
  | "property";

/**
 * 코드에서 추출된 심볼 하나를 나타내는 인터페이스
 */
interface OutlineSymbol {
  /** 심볼 이름 */
  readonly name: string;
  /** 심볼 종류 */
  readonly kind: SymbolKind;
  /** 시작 줄 번호 (1-based) */
  readonly startLine: number;
  /** 끝 줄 번호 (1-based, 단일 줄이면 startLine과 동일) */
  readonly endLine: number;
  /** export 여부 */
  readonly exported: boolean;
  /** 함수/메서드 시그니처 (매개변수 목록) */
  readonly signature?: string;
  /** 중첩된 자식 심볼 (클래스 내 메서드 등) */
  readonly children: OutlineSymbol[];
}

/**
 * 파일 아웃라인 — 파일 하나의 구조 정보
 */
interface FileOutline {
  /** import 문 목록 */
  readonly imports: readonly string[];
  /** 최상위 심볼 목록 */
  readonly symbols: readonly OutlineSymbol[];
  /** 전체 줄 수 */
  readonly totalLines: number;
  /** 감지된 언어 */
  readonly language: string;
}

// ── 언어 감지 ──

/** 파일 확장자 → 언어 이름 매핑 */
const EXTENSION_TO_LANGUAGE: Readonly<Record<string, string>> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (JSX)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (JSX)",
  ".mjs": "JavaScript (ESM)",
  ".cjs": "JavaScript (CJS)",
  ".py": "Python",
  ".java": "Java",
  ".go": "Go",
  ".rs": "Rust",
  ".c": "C",
  ".h": "C/C++ Header",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".hpp": "C++ Header",
  ".cs": "C#",
  ".rb": "Ruby",
  ".php": "PHP",
  ".swift": "Swift",
  ".kt": "Kotlin",
  ".kts": "Kotlin Script",
  ".scala": "Scala",
  ".r": "R",
  ".R": "R",
  ".lua": "Lua",
  ".sh": "Shell",
  ".bash": "Bash",
  ".zsh": "Zsh",
  ".pl": "Perl",
  ".pm": "Perl",
  ".ex": "Elixir",
  ".exs": "Elixir Script",
  ".erl": "Erlang",
  ".hs": "Haskell",
  ".dart": "Dart",
  ".vue": "Vue",
  ".svelte": "Svelte",
};

/**
 * 파일 확장자로 언어를 감지
 *
 * @param filePath - 파일 경로
 * @returns 언어 이름 (알 수 없으면 "Unknown")
 */
function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? "Unknown";
}

// ── 정규식 기반 심볼 추출 ──

/**
 * 블록의 끝 줄을 찾기 — 중괄호 매칭으로 블록의 끝 줄 번호를 결정
 *
 * @param lines - 전체 줄 배열
 * @param startIdx - 시작 줄의 인덱스 (0-based)
 * @returns 블록의 끝 줄 인덱스 (0-based)
 */
function findBlockEnd(lines: readonly string[], startIdx: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        foundOpen = true;
      } else if (ch === "}") {
        depth--;
        if (foundOpen && depth === 0) {
          return i;
        }
      }
    }
  }

  // 중괄호를 못 찾으면 (Python 등 들여쓰기 기반 언어)
  // 들여쓰기가 줄어드는 첫 비공백 줄을 찾음
  if (!foundOpen) {
    const startLine = lines[startIdx];
    const baseIndent = startLine.length - startLine.trimStart().length;

    for (let i = startIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.length === 0) continue; // 빈 줄은 건너뜀
      const currentIndent = lines[i].length - lines[i].trimStart().length;
      if (currentIndent <= baseIndent) {
        return i - 1;
      }
    }
    return lines.length - 1;
  }

  return startIdx;
}

/** 시그니처를 최대 길이로 잘라냄 */
const MAX_SIGNATURE_LENGTH = 60;

/**
 * 함수 시그니처를 정리하고 잘라냄
 *
 * @param raw - 원본 시그니처 문자열
 * @returns 정리된 시그니처 (60자 초과 시 잘라냄)
 */
function truncateSignature(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length > MAX_SIGNATURE_LENGTH) {
    return cleaned.substring(0, MAX_SIGNATURE_LENGTH) + "...";
  }
  return cleaned;
}

// ── TypeScript/JavaScript 패턴 ──

/** TS/JS import 패턴 */
const TS_IMPORT_PATTERN = /^import\s+.*from\s+['"]([^'"]+)['"]/;

/** TS/JS 심볼 패턴 */
const TS_PATTERNS = {
  classDecl:
    /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?/,
  interfaceDecl: /^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[\w,\s]+)?/,
  typeDecl: /^(?:export\s+)?type\s+(\w+)\s*[=<]/,
  enumDecl: /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/,
  functionDecl:
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*(.+?))?(?:\s*\{|$)/,
  arrowFunctionDecl:
    /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*(.+?))?\s*=>/,
  constDecl: /^(?:export\s+)?const\s+(\w+)\s*[=:]/,
  methodDecl:
    /^\s+(?:(?:public|private|protected|static|readonly|async|abstract|override|get|set)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*(.+?))?(?:\s*\{|;|$)/,
  propertyDecl:
    /^\s+(?:(?:public|private|protected|static|readonly)\s+)+(\w+)\s*[?!]?\s*(?::\s*(.+?))?(?:\s*[=;]|$)/,
} as const;

// ── Python 패턴 ──

const PY_IMPORT_PATTERN = /^(?:from\s+(\S+)\s+)?import\s+(.+)/;
const PY_PATTERNS = {
  classDecl: /^class\s+(\w+)(?:\s*\(([^)]*)\))?\s*:/,
  functionDecl: /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/,
  methodDecl: /^\s+(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*:/,
} as const;

// ── Go 패턴 ──

const GO_IMPORT_PATTERN = /^\s*(?:import\s+)?["']([^"']+)["']/;
const GO_PATTERNS = {
  structDecl: /^type\s+(\w+)\s+struct\s*\{/,
  interfaceDecl: /^type\s+(\w+)\s+interface\s*\{/,
  typeDecl: /^type\s+(\w+)\s+/,
  functionDecl: /^func\s+(\w+)\s*(?:\[[^\]]*\])?\s*\(([^)]*)\)(?:\s*(?:\(([^)]+)\)|(\S+)))?\s*\{/,
  methodDecl: /^func\s+\([^)]+\)\s+(\w+)\s*\(([^)]*)\)(?:\s*(?:\(([^)]+)\)|(\S+)))?\s*\{/,
} as const;

// ── Rust 패턴 ──

const RUST_PATTERNS = {
  structDecl: /^(?:pub(?:\([^)]*\))?\s+)?struct\s+(\w+)/,
  enumDecl: /^(?:pub(?:\([^)]*\))?\s+)?enum\s+(\w+)/,
  traitDecl: /^(?:pub(?:\([^)]*\))?\s+)?trait\s+(\w+)/,
  implDecl: /^impl(?:<[^>]*>)?\s+(?:(\w+)\s+for\s+)?(\w+)/,
  functionDecl:
    /^(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*(?:\{|where)/,
  methodDecl:
    /^\s+(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*(.+?))?\s*(?:\{|where)/,
} as const;

// ── Java/Kotlin/C# 패턴 ──

const JAVA_PATTERNS = {
  classDecl: /^(?:(?:public|private|protected|abstract|final|static)\s+)*class\s+(\w+)/,
  interfaceDecl: /^(?:(?:public|private|protected)\s+)*interface\s+(\w+)/,
  enumDecl: /^(?:(?:public|private|protected)\s+)*enum\s+(\w+)/,
  methodDecl:
    /^\s+(?:(?:public|private|protected|static|final|abstract|synchronized|native|override|open)\s+)*(?:\w+(?:<[^>]*>)?)\s+(\w+)\s*\(([^)]*)\)/,
} as const;

// ── 언어 패밀리 분류 ──

type LanguageFamily = "typescript" | "python" | "go" | "rust" | "java" | "generic";

/**
 * 파일 확장자로 언어 패밀리를 결정
 */
function getLanguageFamily(filePath: string): LanguageFamily {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
    case ".vue":
    case ".svelte":
      return "typescript";
    case ".py":
      return "python";
    case ".go":
      return "go";
    case ".rs":
      return "rust";
    case ".java":
    case ".kt":
    case ".kts":
    case ".cs":
    case ".scala":
    case ".swift":
    case ".dart":
      return "java";
    default:
      return "generic";
  }
}

/**
 * TypeScript/JavaScript 파일에서 심볼을 추출
 */
function extractTsSymbols(lines: readonly string[]): {
  imports: string[];
  symbols: OutlineSymbol[];
} {
  const imports: string[] = [];
  const symbols: OutlineSymbol[] = [];
  /** 현재 처리 중인 클래스/인터페이스 심볼 (멤버를 자식으로 추가) */
  let currentContainer: OutlineSymbol | null = null;
  let containerEndLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // 빈 줄, 주석 건너뛰기
    if (
      trimmed.length === 0 ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*")
    ) {
      continue;
    }

    // import 추출
    const importMatch = trimmed.match(TS_IMPORT_PATTERN);
    if (importMatch) {
      imports.push(trimmed);
      continue;
    }

    // 컨테이너 범위를 벗어났는지 확인
    if (currentContainer && lineNum > containerEndLine) {
      currentContainer = null;
    }

    const isExported = trimmed.startsWith("export");
    const isInsideContainer = currentContainer !== null && lineNum <= containerEndLine;

    // 멤버 (클래스/인터페이스 내부)
    if (isInsideContainer && currentContainer) {
      // 메서드
      const methodMatch = trimmed.match(TS_PATTERNS.methodDecl);
      if (
        (methodMatch && methodMatch[1] !== "constructor") ||
        (methodMatch && methodMatch[1] === "constructor")
      ) {
        const name = methodMatch![1];
        const params = methodMatch![2] ?? "";
        const returnType = methodMatch![3] ?? "";
        const sig = returnType
          ? `(${truncateSignature(params)}): ${truncateSignature(returnType)}`
          : `(${truncateSignature(params)})`;
        const endIdx = findBlockEnd(lines, i);
        currentContainer.children.push({
          name,
          kind: "method",
          startLine: lineNum,
          endLine: endIdx + 1,
          exported: false,
          signature: sig,
          children: [],
        });
        continue;
      }

      // 프로퍼티
      const propMatch = trimmed.match(TS_PATTERNS.propertyDecl);
      if (propMatch) {
        currentContainer.children.push({
          name: propMatch[1],
          kind: "property",
          startLine: lineNum,
          endLine: lineNum,
          exported: false,
          children: [],
        });
        continue;
      }
    }

    // 최상위 심볼: class
    const classMatch = trimmed.match(TS_PATTERNS.classDecl);
    if (classMatch) {
      const endIdx = findBlockEnd(lines, i);
      const sym: OutlineSymbol = {
        name: classMatch[1],
        kind: "class",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      };
      symbols.push(sym);
      currentContainer = sym;
      containerEndLine = endIdx + 1;
      continue;
    }

    // interface
    const ifaceMatch = trimmed.match(TS_PATTERNS.interfaceDecl);
    if (ifaceMatch) {
      const endIdx = findBlockEnd(lines, i);
      const sym: OutlineSymbol = {
        name: ifaceMatch[1],
        kind: "interface",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      };
      symbols.push(sym);
      currentContainer = sym;
      containerEndLine = endIdx + 1;
      continue;
    }

    // type alias
    const typeMatch = trimmed.match(TS_PATTERNS.typeDecl);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: "type",
        startLine: lineNum,
        endLine: lineNum,
        exported: isExported,
        children: [],
      });
      continue;
    }

    // enum
    const enumMatch = trimmed.match(TS_PATTERNS.enumDecl);
    if (enumMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: enumMatch[1],
        kind: "enum",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      });
      continue;
    }

    // function declaration
    const funcMatch = trimmed.match(TS_PATTERNS.functionDecl);
    if (funcMatch) {
      const params = funcMatch[2] ?? "";
      const returnType = funcMatch[3] ?? "";
      const sig = returnType
        ? `(${truncateSignature(params)}): ${truncateSignature(returnType)}`
        : `(${truncateSignature(params)})`;
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: funcMatch[1],
        kind: "function",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        signature: sig,
        children: [],
      });
      continue;
    }

    // arrow function (const foo = (...) => ...)
    const arrowMatch = trimmed.match(TS_PATTERNS.arrowFunctionDecl);
    if (arrowMatch) {
      const params = arrowMatch[2] ?? "";
      const returnType = arrowMatch[3] ?? "";
      const sig = returnType
        ? `(${truncateSignature(params)}): ${truncateSignature(returnType)}`
        : `(${truncateSignature(params)})`;
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: arrowMatch[1],
        kind: "function",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        signature: sig,
        children: [],
      });
      continue;
    }

    // const (not arrow function — simple value)
    if (!isInsideContainer) {
      const constMatch = trimmed.match(TS_PATTERNS.constDecl);
      if (constMatch) {
        // 함수/화살표가 아닌 const만
        symbols.push({
          name: constMatch[1],
          kind: "const",
          startLine: lineNum,
          endLine: lineNum,
          exported: isExported,
          children: [],
        });
        continue;
      }
    }
  }

  return { imports, symbols };
}

/**
 * Python 파일에서 심볼을 추출
 */
function extractPySymbols(lines: readonly string[]): {
  imports: string[];
  symbols: OutlineSymbol[];
} {
  const imports: string[] = [];
  const symbols: OutlineSymbol[] = [];
  let currentContainer: OutlineSymbol | null = null;
  let containerIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;

    // import 추출
    const importMatch = trimmed.match(PY_IMPORT_PATTERN);
    if (importMatch && indent === 0) {
      imports.push(trimmed);
      continue;
    }

    // 컨테이너를 벗어났는지 확인
    if (currentContainer && indent <= containerIndent && trimmed.length > 0) {
      currentContainer = null;
    }

    // 메서드 (클래스 내부)
    if (currentContainer && indent > containerIndent) {
      const methodMatch = trimmed.match(PY_PATTERNS.methodDecl);
      if (methodMatch) {
        const params = methodMatch[2] ?? "";
        const returnType = methodMatch[3] ?? "";
        const sig = returnType
          ? `(${truncateSignature(params)}) -> ${truncateSignature(returnType)}`
          : `(${truncateSignature(params)})`;
        const endIdx = findBlockEnd(lines, i);
        currentContainer.children.push({
          name: methodMatch[1],
          kind: "method",
          startLine: lineNum,
          endLine: endIdx + 1,
          exported: false,
          signature: sig,
          children: [],
        });
        continue;
      }
    }

    // class
    const classMatch = trimmed.match(PY_PATTERNS.classDecl);
    if (classMatch && indent === 0) {
      const endIdx = findBlockEnd(lines, i);
      const sym: OutlineSymbol = {
        name: classMatch[1],
        kind: "class",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: true, // Python은 기본적으로 모두 공개
        children: [],
      };
      symbols.push(sym);
      currentContainer = sym;
      containerIndent = indent;
      continue;
    }

    // function
    const funcMatch = trimmed.match(PY_PATTERNS.functionDecl);
    if (funcMatch && indent === 0) {
      const params = funcMatch[2] ?? "";
      const returnType = funcMatch[3] ?? "";
      const sig = returnType
        ? `(${truncateSignature(params)}) -> ${truncateSignature(returnType)}`
        : `(${truncateSignature(params)})`;
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: funcMatch[1],
        kind: "function",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: !funcMatch[1].startsWith("_"),
        signature: sig,
        children: [],
      });
      continue;
    }
  }

  return { imports, symbols };
}

/**
 * Go 파일에서 심볼을 추출
 */
function extractGoSymbols(lines: readonly string[]): {
  imports: string[];
  symbols: OutlineSymbol[];
} {
  const imports: string[] = [];
  const symbols: OutlineSymbol[] = [];
  let inImportBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed.length === 0 || trimmed.startsWith("//")) continue;

    // import 블록 처리
    if (trimmed === "import (") {
      inImportBlock = true;
      continue;
    }
    if (inImportBlock) {
      if (trimmed === ")") {
        inImportBlock = false;
        continue;
      }
      const impMatch = trimmed.match(GO_IMPORT_PATTERN);
      if (impMatch) {
        imports.push(impMatch[1]);
      }
      continue;
    }

    // 단일 import
    if (trimmed.startsWith("import ")) {
      const impMatch = trimmed.match(/^import\s+(?:\w+\s+)?["']([^"']+)["']/);
      if (impMatch) {
        imports.push(impMatch[1]);
      }
      continue;
    }

    const isExported =
      /^(?:type|func)\s+[A-Z]/.test(trimmed) || /^func\s+\([^)]+\)\s+[A-Z]/.test(trimmed);

    // struct
    const structMatch = trimmed.match(GO_PATTERNS.structDecl);
    if (structMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: structMatch[1],
        kind: "class",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: structMatch[1][0] === structMatch[1][0].toUpperCase(),
        children: [],
      });
      continue;
    }

    // interface
    const ifaceMatch = trimmed.match(GO_PATTERNS.interfaceDecl);
    if (ifaceMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: ifaceMatch[1],
        kind: "interface",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: ifaceMatch[1][0] === ifaceMatch[1][0].toUpperCase(),
        children: [],
      });
      continue;
    }

    // method (func (receiver) Name(...))
    const methodMatch = trimmed.match(GO_PATTERNS.methodDecl);
    if (methodMatch) {
      const params = methodMatch[2] ?? "";
      const returnType = methodMatch[3] ?? methodMatch[4] ?? "";
      const sig = returnType
        ? `(${truncateSignature(params)}): ${truncateSignature(returnType)}`
        : `(${truncateSignature(params)})`;
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: methodMatch[1],
        kind: "method",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        signature: sig,
        children: [],
      });
      continue;
    }

    // function
    const funcMatch = trimmed.match(GO_PATTERNS.functionDecl);
    if (funcMatch) {
      const params = funcMatch[2] ?? "";
      const returnType = funcMatch[3] ?? funcMatch[4] ?? "";
      const sig = returnType
        ? `(${truncateSignature(params)}): ${truncateSignature(returnType)}`
        : `(${truncateSignature(params)})`;
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: funcMatch[1],
        kind: "function",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: funcMatch[1][0] === funcMatch[1][0].toUpperCase(),
        signature: sig,
        children: [],
      });
      continue;
    }
  }

  return { imports, symbols };
}

/**
 * Rust 파일에서 심볼을 추출
 */
function extractRustSymbols(lines: readonly string[]): {
  imports: string[];
  symbols: OutlineSymbol[];
} {
  const imports: string[] = [];
  const symbols: OutlineSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (trimmed.length === 0 || trimmed.startsWith("//")) continue;

    // use statements
    if (trimmed.startsWith("use ")) {
      imports.push(trimmed);
      continue;
    }

    const isExported = trimmed.startsWith("pub");

    // struct
    const structMatch = trimmed.match(RUST_PATTERNS.structDecl);
    if (structMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: structMatch[1],
        kind: "class",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      });
      continue;
    }

    // enum
    const enumMatch = trimmed.match(RUST_PATTERNS.enumDecl);
    if (enumMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: enumMatch[1],
        kind: "enum",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      });
      continue;
    }

    // trait
    const traitMatch = trimmed.match(RUST_PATTERNS.traitDecl);
    if (traitMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: traitMatch[1],
        kind: "interface",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      });
      continue;
    }

    // function
    const funcMatch = trimmed.match(RUST_PATTERNS.functionDecl);
    if (funcMatch) {
      const params = funcMatch[2] ?? "";
      const returnType = funcMatch[3] ?? "";
      const sig = returnType
        ? `(${truncateSignature(params)}) -> ${truncateSignature(returnType)}`
        : `(${truncateSignature(params)})`;
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: funcMatch[1],
        kind: "function",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        signature: sig,
        children: [],
      });
      continue;
    }
  }

  return { imports, symbols };
}

/**
 * Java/Kotlin/C#/Swift 파일에서 심볼을 추출
 */
function extractJavaSymbols(lines: readonly string[]): {
  imports: string[];
  symbols: OutlineSymbol[];
} {
  const imports: string[] = [];
  const symbols: OutlineSymbol[] = [];
  let currentContainer: OutlineSymbol | null = null;
  let containerEndLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    if (
      trimmed.length === 0 ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*")
    ) {
      continue;
    }

    // import/package
    if (trimmed.startsWith("import ") || trimmed.startsWith("package ")) {
      imports.push(trimmed);
      continue;
    }

    // 컨테이너 범위를 벗어났는지 확인
    if (currentContainer && lineNum > containerEndLine) {
      currentContainer = null;
    }

    const isExported = trimmed.startsWith("public") || trimmed.startsWith("open");
    const isInsideContainer = currentContainer !== null && lineNum <= containerEndLine;

    // 메서드 (클래스 내부)
    if (isInsideContainer && currentContainer) {
      const methodMatch = trimmed.match(JAVA_PATTERNS.methodDecl);
      if (methodMatch) {
        const params = methodMatch[2] ?? "";
        const endIdx = findBlockEnd(lines, i);
        currentContainer.children.push({
          name: methodMatch[1],
          kind: "method",
          startLine: lineNum,
          endLine: endIdx + 1,
          exported: isExported,
          signature: `(${truncateSignature(params)})`,
          children: [],
        });
        continue;
      }
    }

    // class
    const classMatch = trimmed.match(JAVA_PATTERNS.classDecl);
    if (classMatch) {
      const endIdx = findBlockEnd(lines, i);
      const sym: OutlineSymbol = {
        name: classMatch[1],
        kind: "class",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      };
      symbols.push(sym);
      currentContainer = sym;
      containerEndLine = endIdx + 1;
      continue;
    }

    // interface
    const ifaceMatch = trimmed.match(JAVA_PATTERNS.interfaceDecl);
    if (ifaceMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: ifaceMatch[1],
        kind: "interface",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      });
      continue;
    }

    // enum
    const enumMatch = trimmed.match(JAVA_PATTERNS.enumDecl);
    if (enumMatch) {
      const endIdx = findBlockEnd(lines, i);
      symbols.push({
        name: enumMatch[1],
        kind: "enum",
        startLine: lineNum,
        endLine: endIdx + 1,
        exported: isExported,
        children: [],
      });
      continue;
    }
  }

  return { imports, symbols };
}

/**
 * 범용 정규식으로 심볼을 추출 (지원하지 않는 언어용 폴백)
 *
 * function, class, interface, type, export, def, struct, enum 키워드를 포함하는
 * 줄을 단순하게 추출합니다.
 */
function extractGenericSymbols(lines: readonly string[]): {
  imports: string[];
  symbols: OutlineSymbol[];
} {
  const imports: string[] = [];
  const symbols: OutlineSymbol[] = [];
  const genericPattern =
    /^(?:export\s+)?(?:pub\s+)?(?:async\s+)?(?:static\s+)?(function|class|interface|type|struct|enum|def|fn|const|let|var)\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lineNum = i + 1;

    if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("#")) continue;

    // import/require 추출
    if (
      trimmed.startsWith("import ") ||
      trimmed.startsWith("from ") ||
      trimmed.includes("require(")
    ) {
      imports.push(trimmed);
      continue;
    }

    const match = trimmed.match(genericPattern);
    if (match) {
      const keyword = match[1];
      const name = match[2];
      const isExported = trimmed.startsWith("export") || trimmed.startsWith("pub");

      let kind: SymbolKind;
      switch (keyword) {
        case "class":
        case "struct":
          kind = "class";
          break;
        case "interface":
          kind = "interface";
          break;
        case "type":
          kind = "type";
          break;
        case "enum":
          kind = "enum";
          break;
        case "const":
        case "let":
        case "var":
          kind = "const";
          break;
        default:
          kind = "function";
      }

      symbols.push({
        name,
        kind,
        startLine: lineNum,
        endLine: lineNum,
        exported: isExported,
        children: [],
      });
    }
  }

  return { imports, symbols };
}

// ── 아웃라인 빌드 ──

/**
 * 파일 내용에서 아웃라인을 빌드
 *
 * @param content - 파일 전체 내용
 * @param filePath - 파일 경로 (언어 감지용)
 * @returns 파일 아웃라인 (심볼, import, 언어, 줄 수)
 */
function buildOutline(content: string, filePath: string): FileOutline {
  const lines = content.split("\n");
  const language = detectLanguage(filePath);
  const family = getLanguageFamily(filePath);

  let result: { imports: string[]; symbols: OutlineSymbol[] };

  switch (family) {
    case "typescript":
      result = extractTsSymbols(lines);
      break;
    case "python":
      result = extractPySymbols(lines);
      break;
    case "go":
      result = extractGoSymbols(lines);
      break;
    case "rust":
      result = extractRustSymbols(lines);
      break;
    case "java":
      result = extractJavaSymbols(lines);
      break;
    default:
      result = extractGenericSymbols(lines);
  }

  return {
    imports: result.imports,
    symbols: result.symbols,
    totalLines: lines.length,
    language,
  };
}

// ── 아웃라인 렌더링 ──

/**
 * 줄 번호 범위를 문자열로 렌더링
 */
function renderLineRange(sym: OutlineSymbol): string {
  if (sym.startLine === sym.endLine) {
    return `:${sym.startLine}`;
  }
  return `:${sym.startLine}-${sym.endLine}`;
}

/**
 * 심볼 트리를 텍스트로 렌더링
 *
 * @param symbols - 렌더링할 심볼 배열
 * @param prefix - 현재 들여쓰기 접두사
 * @param includeSignatures - 함수 시그니처 포함 여부
 * @param includeLineNumbers - 줄 번호 포함 여부
 * @returns 렌더링된 줄 배열
 */
function renderSymbolTree(
  symbols: readonly OutlineSymbol[],
  prefix: string,
  includeSignatures: boolean,
  includeLineNumbers: boolean,
): string[] {
  const result: string[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const isLast = i === symbols.length - 1;
    const connector = isLast ? "└─" : "├─";
    const childPrefix = isLast ? `${prefix}   ` : `${prefix}│  `;

    // 심볼 이름과 시그니처 조합
    let nameStr = `${sym.kind} ${sym.name}`;
    if (includeSignatures && sym.signature) {
      nameStr += sym.signature;
    }

    // 줄 번호
    const lineStr = includeLineNumbers ? `  ${renderLineRange(sym)}` : "";

    // export 마커
    const exportStr = sym.exported ? "  [exported]" : "";

    result.push(`${prefix}${connector} ${nameStr}${lineStr}${exportStr}`);

    // 자식 심볼 렌더링 (재귀)
    if (sym.children.length > 0) {
      const childLines = renderSymbolTree(
        sym.children,
        childPrefix,
        includeSignatures,
        includeLineNumbers,
      );
      result.push(...childLines);
    }
  }

  return result;
}

/**
 * 아웃라인을 최종 텍스트로 렌더링
 */
function renderOutline(
  outline: FileOutline,
  filePath: string,
  options: {
    includeImports: boolean;
    includeSignatures: boolean;
    includeLineNumbers: boolean;
  },
): string {
  const parts: string[] = [];

  // 파일 헤더
  parts.push(`File: ${normalizePath(filePath)} (${outline.language}, ${outline.totalLines} lines)`);
  parts.push("");

  // Import 섹션
  if (options.includeImports && outline.imports.length > 0) {
    parts.push("Imports:");
    const maxShow = 15;
    const shown = outline.imports.slice(0, maxShow);
    for (const imp of shown) {
      parts.push(`  ${imp}`);
    }
    if (outline.imports.length > maxShow) {
      parts.push(`  ... (${outline.imports.length - maxShow} more)`);
    }
    parts.push("");
  }

  // Symbols 섹션
  if (outline.symbols.length > 0) {
    parts.push("Symbols:");
    const tree = renderSymbolTree(
      outline.symbols,
      "  ",
      options.includeSignatures,
      options.includeLineNumbers,
    );
    parts.push(...tree);
  } else {
    parts.push("Symbols: (none found)");
  }

  // Exports 섹션
  const exported = outline.symbols.filter((s) => s.exported).map((s) => s.name);
  if (exported.length > 0) {
    parts.push("");
    parts.push(`Exports: ${exported.join(", ")}`);
  }

  return parts.join("\n");
}

// ── 매개변수 스키마 ──

/**
 * 매개변수 스키마 — 분석할 파일 경로와 출력 옵션을 정의
 */
const paramSchema = z.object({
  /** 분석할 파일의 절대 경로 */
  file_path: z.string().describe("분석할 파일의 절대 경로"),
  /** import 목록 포함 여부 (기본: false) */
  include_imports: z.boolean().optional().default(false).describe("import 목록 포함"),
  /** 함수 시그니처 포함 여부 (기본: true) */
  include_signatures: z.boolean().optional().default(true).describe("함수 시그니처 포함"),
  /** 줄 번호 포함 여부 (기본: true) */
  include_line_numbers: z.boolean().optional().default(true).describe("줄 번호 포함"),
});

type Params = z.infer<typeof paramSchema>;

/**
 * 코드 아웃라인 실행 함수 — 파일의 구조를 분석하여 심볼 트리를 반환
 *
 * @param params - 검증된 매개변수 (파일 경로, 옵션)
 * @param context - 실행 컨텍스트 (작업 디렉토리 등)
 * @returns 아웃라인 결과 (심볼 트리 텍스트)
 */
async function execute(params: Params, context: ToolContext): Promise<ToolResult> {
  const filePath = resolvePath(context.workingDirectory, params.file_path);

  try {
    // 파일 존재 확인
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return {
        output: `Not a file: ${filePath}`,
        isError: true,
      };
    }

    // 빈 파일 처리
    if (fileStat.size === 0) {
      return {
        output: `[Empty file: ${filePath}]`,
        isError: false,
        metadata: {
          toolName: "code_outline",
          filePath: normalizePath(filePath),
          language: detectLanguage(filePath),
          symbolCount: 0,
          importCount: 0,
        },
      };
    }

    // 파일 읽기 및 아웃라인 빌드
    const content = await readFile(filePath, "utf-8");
    const outline = buildOutline(content, filePath);

    // 아웃라인 렌더링
    const output = renderOutline(outline, filePath, {
      includeImports: params.include_imports,
      includeSignatures: params.include_signatures,
      includeLineNumbers: params.include_line_numbers,
    });

    return {
      output,
      isError: false,
      metadata: {
        toolName: "code_outline",
        filePath: normalizePath(filePath),
        language: outline.language,
        symbolCount: outline.symbols.length,
        importCount: outline.imports.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // 파일 없음
    if (message.includes("ENOENT")) {
      return {
        output: `File not found: ${filePath}`,
        isError: true,
      };
    }

    // 권한 없음
    if (message.includes("EACCES")) {
      return {
        output: `Permission denied: ${filePath}`,
        isError: true,
      };
    }

    return {
      output: `Failed to analyze file: ${message}`,
      isError: true,
    };
  }
}

/**
 * code_outline 도구 정의 — 내보내기하여 도구 레지스트리에 등록
 */
export const codeOutlineTool: ToolDefinition<Params> = {
  name: "code_outline",
  description:
    "파일의 구조(함수, 클래스, 메서드, 타입)를 추출합니다. " +
    "파일 전체를 읽지 않고도 코드 구조를 파악할 수 있어 토큰을 절약합니다.\n\n" +
    "사용 시점:\n" +
    "- 파일 구조를 빠르게 파악할 때 (file_read 대신)\n" +
    "- 어떤 함수/클래스가 있는지 확인할 때\n" +
    "- 수정할 위치를 찾을 때 (줄 번호 확인 후 file_read로 해당 부분만 읽기)\n\n" +
    "file_read를 사용해야 할 때:\n" +
    "- 실제 코드 내용이 필요할 때\n" +
    "- 특정 줄 범위의 코드를 볼 때",
  parameterSchema: paramSchema,
  permissionLevel: "safe",
  timeoutMs: 15_000,
  execute,
};
