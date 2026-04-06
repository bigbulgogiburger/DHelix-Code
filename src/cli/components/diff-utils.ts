/**
 * diff-utils.ts — Diff 계산 및 유틸리티 함수 (순수 함수, React/Ink 의존성 없음)
 *
 * 파일 변경사항을 구조화된 diff 데이터로 변환합니다.
 * `diff` 라이브러리의 structuredPatch()를 사용하여 unified diff를 생성하고,
 * 이를 DiffHunk/DiffLine 타입으로 변환합니다.
 *
 * 주요 함수:
 * - computeDiff(): before/after 텍스트로부터 DiffHunk[] 생성
 * - detectLanguage(): 파일 경로 확장자로 언어 추론
 * - formatLineNumber(): 줄번호를 고정 너비 문자열로 포맷
 */
import { structuredPatch } from "diff";

/**
 * diff의 개별 줄 — 추가(add), 삭제(remove), 컨텍스트(context) 중 하나
 *
 * @param type - 줄의 변경 유형
 * @param content - 줄의 텍스트 내용 (개행 미포함)
 * @param oldLineNumber - 원본 파일에서의 줄번호 (추가 줄이면 undefined)
 * @param newLineNumber - 수정 파일에서의 줄번호 (삭제 줄이면 undefined)
 */
export interface DiffLine {
  readonly type: "add" | "remove" | "context";
  readonly content: string;
  readonly oldLineNumber?: number;
  readonly newLineNumber?: number;
}

/**
 * diff 헝크 — 연속된 변경 영역을 나타냄
 *
 * @param header - unified diff 헤더 (예: "@@ -10,5 +10,7 @@")
 * @param lines - 헝크에 포함된 줄들
 */
export interface DiffHunk {
  readonly header: string;
  readonly lines: readonly DiffLine[];
}

/**
 * 두 텍스트 사이의 diff를 DiffHunk 배열로 계산합니다.
 *
 * `diff` 라이브러리의 structuredPatch()를 사용하여 unified diff를 생성한 후,
 * 각 헝크를 DiffHunk/DiffLine 타입으로 변환합니다.
 *
 * @param before - 원본 텍스트
 * @param after - 수정된 텍스트
 * @param contextLines - 변경 주변에 포함할 컨텍스트 줄 수 (기본: 3)
 * @returns DiffHunk 배열. 변경이 없으면 빈 배열 반환
 */
export function computeDiff(
  before: string,
  after: string,
  contextLines: number = 3,
): readonly DiffHunk[] {
  if (before === after) {
    return [];
  }

  const patch = structuredPatch("a", "b", before, after, undefined, undefined, {
    context: contextLines,
  });

  return patch.hunks.map((hunk) => {
    const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
    const lines: DiffLine[] = [];

    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;

    for (const rawLine of hunk.lines) {
      const marker = rawLine[0];
      const content = rawLine.slice(1);

      if (marker === "-") {
        lines.push({
          type: "remove",
          content,
          oldLineNumber: oldLine,
          newLineNumber: undefined,
        });
        oldLine++;
      } else if (marker === "+") {
        lines.push({
          type: "add",
          content,
          oldLineNumber: undefined,
          newLineNumber: newLine,
        });
        newLine++;
      } else {
        lines.push({
          type: "context",
          content,
          oldLineNumber: oldLine,
          newLineNumber: newLine,
        });
        oldLine++;
        newLine++;
      }
    }

    return { header, lines };
  });
}

/**
 * 파일 경로의 확장자로부터 프로그래밍 언어를 추론합니다.
 *
 * shiki 구문 강조에서 사용하는 언어 식별자를 반환합니다.
 * 매핑되지 않는 확장자는 "text"를 반환합니다.
 *
 * @param filePath - 파일 경로 (예: "src/main.ts")
 * @returns 언어 식별자 (예: "typescript")
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

  const extensionMap: Readonly<Record<string, string>> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    toml: "toml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    md: "markdown",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    dockerfile: "dockerfile",
    vue: "vue",
    svelte: "svelte",
  };

  return extensionMap[ext] ?? "text";
}

/**
 * 줄번호를 고정 너비 문자열로 포맷합니다.
 *
 * 줄번호가 없으면 (undefined) 공백으로 채워진 문자열을 반환합니다.
 * 터미널 diff 출력에서 줄번호 열을 정렬할 때 사용합니다.
 *
 * @param num - 줄번호 (undefined이면 공백으로 채움)
 * @param width - 고정 너비 (기본: 4)
 * @returns 오른쪽 정렬된 줄번호 문자열
 */
export function formatLineNumber(num: number | undefined, width: number = 4): string {
  if (num === undefined) {
    return " ".repeat(width);
  }
  return String(num).padStart(width, " ");
}
