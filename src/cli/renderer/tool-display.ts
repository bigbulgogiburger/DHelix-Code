/**
 * tool-display.ts — 도구 호출을 사람이 읽기 쉬운 형태로 변환하는 렌더러
 *
 * 각 도구(file_read, file_edit, bash_exec 등)의 호출 상태와 결과를
 * 의미 있는 헤더, 서브텍스트, 미리보기로 변환합니다.
 *
 * 예시 출력:
 * - "Read src/cli/App.tsx (352 lines)" — file_read 완료
 * - "Running ls -la" — bash_exec 실행 중
 * - "Update src/utils/path.ts (+3 -1)" — file_edit 완료 (diff 미리보기 포함)
 *
 * 이 모듈은 ToolCallBlock 컴포넌트에서 사용됩니다.
 * toolDisplayMap에 각 도구별 표시 설정이 정의되어 있으며,
 * 새 도구를 추가할 때 이 맵에 항목을 추가하면 됩니다.
 */

/** 도구 상태 — running(실행 중), complete(완료), error(에러), denied(거부됨) */
type ToolStatus = "running" | "complete" | "error" | "denied";

/**
 * 도구 헤더 정보 — ToolCallBlock에서 상단에 표시
 * @param header - 메인 헤더 텍스트 (예: "Read src/App.tsx")
 * @param color - 헤더 색상 (Ink 색상명)
 * @param subtext - 추가 정보 텍스트 (예: "352 lines")
 */
export interface ToolHeaderInfo {
  readonly header: string;
  readonly color: string;
  readonly subtext?: string;
}

/**
 * 도구별 표시 설정 — 각 도구의 실행/완료 메시지, 색상, 상세 정보 추출 방법을 정의
 *
 * @param running/complete - 실행 중/완료 시 동사 (예: "Reading"/"Read")
 * @param headerVerb/runningHeaderVerb - 헤더에 표시할 동사
 * @param headerColor - 헤더 색상
 * @param extractDetail - 인수/출력/메타데이터에서 상세 정보 추출
 * @param extractPreview - diff 또는 출력 미리보기 추출
 * @param extractHeaderArg - 헤더에 표시할 주요 인수 추출 (파일 경로, 명령어 등)
 * @param extractSubtext - 서브텍스트 추출 (줄 수, 바이트 수 등)
 */
interface ToolDisplayConfig {
  readonly running: string;
  readonly complete: string;
  readonly headerVerb: string;
  readonly runningHeaderVerb: string;
  readonly headerColor: string;
  readonly extractDetail?: (
    args?: Record<string, unknown>,
    output?: string,
    metadata?: Readonly<Record<string, unknown>>,
  ) => string | undefined;
  /** Extract a preview snippet (diff, output preview, etc.) shown below the status line */
  readonly extractPreview?: (
    args?: Record<string, unknown>,
    output?: string,
    status?: ToolStatus,
    metadata?: Readonly<Record<string, unknown>>,
  ) => string | undefined;
  readonly extractHeaderArg?: (args?: Record<string, unknown>) => string | undefined;
  readonly extractSubtext?: (
    args?: Record<string, unknown>,
    output?: string,
    duration?: number,
  ) => string | undefined;
}

/** 파일 경로를 표시용으로 축약 — 충분히 짧으면 그대로 유지, 길면 "…/dir/file" 형태로 */
function shortenPath(filePath: string, maxLen = 60): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  if (parts.length <= 2) return filePath;
  return `…/${parts[parts.length - 2]}/${filename}`;
}

/** 컨텍스트 줄 포함 diff 생성 — 삭제 줄(-), 추가 줄(+), 주변 컨텍스트 줄을 포함 */
function formatContextDiff(
  contextLines: readonly string[],
  contextStartLine: number,
  changeLineNumber: number,
  oldStr: string | undefined,
  newStr: string | undefined,
): string {
  const addedLines = newStr ? newStr.split("\n") : [];
  const addedCount = addedLines.length;

  const result: string[] = [];
  const maxPreviewLines = 16;
  let count = 0;

  // changeOffset: index in contextLines where the new (added) lines begin
  const changeOffset = changeLineNumber - contextStartLine;
  const afterStart = changeOffset + addedCount;

  // Before-context lines
  for (let i = 0; i < changeOffset && i < contextLines.length; i++) {
    if (count >= maxPreviewLines) {
      result.push("  …");
      return result.join("\n");
    }
    const ln = String(contextStartLine + i).padStart(4, " ");
    result.push(`${ln}   ${contextLines[i]}`);
    count++;
  }

  // Removed lines (from old_string)
  if (oldStr) {
    const oldLines = oldStr.split("\n");
    let removedLineNum = changeLineNumber;
    for (const line of oldLines) {
      if (count >= maxPreviewLines) {
        result.push("  …");
        return result.join("\n");
      }
      const ln = String(removedLineNum).padStart(4, " ");
      result.push(`${ln} - ${line}`);
      removedLineNum++;
      count++;
    }
  }

  // Added lines (from new_string)
  let addedLineNum = changeLineNumber;
  for (const line of addedLines) {
    if (count >= maxPreviewLines) {
      result.push("  …");
      return result.join("\n");
    }
    const ln = String(addedLineNum).padStart(4, " ");
    result.push(`${ln} + ${line}`);
    addedLineNum++;
    count++;
  }

  // After-context lines
  for (let i = afterStart; i < contextLines.length; i++) {
    if (count >= maxPreviewLines) {
      result.push("  …");
      return result.join("\n");
    }
    const ln = String(contextStartLine + i).padStart(4, " ");
    result.push(`${ln}   ${contextLines[i]}`);
    count++;
  }

  return result.join("\n");
}

/** file_edit를 위한 unified-diff 스타일 미리보기 생성 — 줄 번호와 컨텍스트 포함 */
function formatEditDiff(args?: Record<string, unknown>, _output?: string): string | undefined {
  const oldStr = typeof args?.old_string === "string" ? args.old_string : undefined;
  const newStr = typeof args?.new_string === "string" ? args.new_string : undefined;
  if (!oldStr && !newStr) return undefined;

  const lineNumber = typeof args?._lineNumber === "number" ? args._lineNumber : 1;
  const contextLines = Array.isArray(args?._contextLines)
    ? (args._contextLines as string[])
    : undefined;
  const contextStartLine =
    typeof args?._contextStartLine === "number" ? args._contextStartLine : undefined;

  // If we have context lines from file-edit metadata, build a rich diff
  if (contextLines && contextStartLine) {
    return formatContextDiff(contextLines, contextStartLine, lineNumber, oldStr, newStr);
  }

  // Fallback: simple diff without context
  const lines: string[] = [];
  const maxPreviewLines = 12;
  let count = 0;
  let currentLine = lineNumber;

  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];

  for (const line of oldLines) {
    if (count >= maxPreviewLines) {
      lines.push("  …");
      break;
    }
    const ln = String(currentLine).padStart(4, " ");
    lines.push(`${ln} - ${line}`);
    currentLine++;
    count++;
  }

  currentLine = lineNumber;
  for (const line of newLines) {
    if (count >= maxPreviewLines) {
      lines.push("  …");
      break;
    }
    const ln = String(currentLine).padStart(4, " ");
    lines.push(`${ln} + ${line}`);
    currentLine++;
    count++;
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

/** 변경 요약 생성 — "Added 3 lines, removed 1 line" 형태의 문자열 */
function formatChangeSummary(args?: Record<string, unknown>): string | undefined {
  const oldStr = typeof args?.old_string === "string" ? args.old_string : undefined;
  const newStr = typeof args?.new_string === "string" ? args.new_string : undefined;
  if (!oldStr && !newStr) return undefined;

  const removed = oldStr ? oldStr.split("\n").length : 0;
  const added = newStr ? newStr.split("\n").length : 0;

  const parts: string[] = [];
  if (added > 0) parts.push(`Added ${added} line${added === 1 ? "" : "s"}`);
  if (removed > 0) parts.push(`removed ${removed} line${removed === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** bash 출력 미리보기 포맷 — 최대 5줄까지 표시, 실행 중에는 미리보기 없음 */
function formatBashPreview(
  _args?: Record<string, unknown>,
  output?: string,
  status?: ToolStatus,
  _metadata?: Readonly<Record<string, unknown>>,
): string | undefined {
  if (!output || status === "running") return undefined;
  const lines = output.trim().split("\n");
  if (lines.length === 0) return undefined;
  const maxLines = 5;
  const preview = lines.slice(0, maxLines);
  if (lines.length > maxLines) preview.push(`  … (${lines.length - maxLines} more lines)`);
  return preview.join("\n");
}

/** 서브텍스트용 소요시간 문자열 포맷 — 의미 없는 값(0 이하)이면 undefined 반환 */
function formatDurationSubtext(duration?: number): string | undefined {
  if (duration === undefined || duration <= 0) return undefined;
  return formatDuration(duration);
}

/** 출력에서 비어있지 않은 줄 수를 카운트 */
function countNonEmptyLines(output?: string): number {
  if (!output) return 0;
  return output
    .trim()
    .split("\n")
    .filter((l) => l.length > 0).length;
}

/**
 * 도구별 표시 설정 맵 — 각 도구의 렌더링 규칙을 정의
 *
 * 새 도구를 추가할 때:
 * 1. 이 맵에 도구 이름을 키로 새 항목을 추가합니다.
 * 2. running/complete 동사, 색상, 상세 정보 추출기를 설정합니다.
 * 3. 필요시 extractPreview로 미리보기(diff 등)를 제공합니다.
 */
const toolDisplayMap: Record<string, ToolDisplayConfig> = {
  file_read: {
    running: "Reading",
    complete: "Read",
    headerVerb: "Read",
    runningHeaderVerb: "Reading",
    headerColor: "blue",
    extractDetail: (args, output, metadata) => {
      const filePath =
        typeof metadata?.path === "string"
          ? shortenPath(metadata.path)
          : typeof args?.file_path === "string"
            ? shortenPath(args.file_path)
            : undefined;
      if (!filePath) return undefined;

      // Image files
      if (metadata?.type === "image") return `${filePath} — image`;
      // PDF files
      if (metadata?.type === "pdf") {
        const pages = metadata.totalPages ? ` ${metadata.totalPages} pages` : "";
        return `${filePath} — PDF${pages}`;
      }
      // Notebook files
      if (metadata?.type === "notebook") {
        const cells = typeof metadata.cellCount === "number" ? ` ${metadata.cellCount} cells` : "";
        return `${filePath} — notebook${cells}`;
      }

      // Regular file — use metadata totalLines if available
      const totalLines = typeof metadata?.totalLines === "number" ? metadata.totalLines : undefined;
      if (totalLines !== undefined) {
        const from = typeof metadata?.readFrom === "number" ? metadata.readFrom : undefined;
        const to = typeof metadata?.readTo === "number" ? metadata.readTo : undefined;
        if (from !== undefined && to !== undefined) {
          return `${filePath} (lines ${from}-${to} of ${totalLines})`;
        }
        return `${filePath} — ${totalLines} lines`;
      }

      // Fallback to counting output lines
      if (output) {
        const lines = output.trim().split("\n");
        const lineCount = lines.filter((l) => l.length > 0).length;
        if (lineCount > 0) return `${filePath} (${lineCount} lines)`;
      }
      return filePath;
    },
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
    extractSubtext: (_args, output, duration) => {
      const lineCount = countNonEmptyLines(output);
      if (lineCount > 0) return `${lineCount} line${lineCount === 1 ? "" : "s"}`;
      return formatDurationSubtext(duration);
    },
  },
  file_write: {
    running: "Writing",
    complete: "Wrote",
    headerVerb: "Write",
    runningHeaderVerb: "Writing",
    headerColor: "cyan",
    extractDetail: (args, _output, metadata) => {
      const filePath =
        typeof metadata?.path === "string"
          ? shortenPath(metadata.path)
          : typeof args?.file_path === "string"
            ? shortenPath(args.file_path)
            : undefined;
      if (!filePath) return undefined;
      const lineCount = typeof metadata?.lineCount === "number" ? metadata.lineCount : undefined;
      if (lineCount !== undefined) return `${filePath} — ${lineCount} lines`;
      // Fallback
      const content = typeof args?.content === "string" ? args.content : undefined;
      if (content) {
        const lc = content.split("\n").length;
        return `${filePath} — ${lc} lines`;
      }
      return filePath;
    },
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
    extractSubtext: (args) => {
      const content = typeof args?.content === "string" ? args.content : undefined;
      if (!content) return undefined;
      const lineCount = content.split("\n").length;
      const bytes = new TextEncoder().encode(content).byteLength;
      if (bytes < 1024) return `${lineCount} line${lineCount === 1 ? "" : "s"}, ${bytes} B`;
      return `${lineCount} line${lineCount === 1 ? "" : "s"}, ${(bytes / 1024).toFixed(1)} KB`;
    },
  },
  file_edit: {
    running: "Editing",
    complete: "Edited",
    headerVerb: "Update",
    runningHeaderVerb: "Updating",
    headerColor: "cyan",
    extractDetail: (args, _output, metadata) => {
      const filePath =
        typeof metadata?.path === "string"
          ? shortenPath(metadata.path)
          : typeof args?.file_path === "string"
            ? shortenPath(args.file_path)
            : undefined;
      if (!filePath) return undefined;
      const added = typeof metadata?.linesAdded === "number" ? metadata.linesAdded : undefined;
      const removed =
        typeof metadata?.linesRemoved === "number" ? metadata.linesRemoved : undefined;
      if (added !== undefined && removed !== undefined) {
        return `${filePath} (+${added} -${removed})`;
      }
      const replaceAll = args?.replace_all === true;
      if (replaceAll) return `${filePath} (replace all)`;
      const summary = formatChangeSummary(args);
      if (summary) return `${filePath} — ${summary}`;
      return filePath;
    },
    extractPreview: (args, output, status) => {
      if (status === "running") return undefined;
      return formatEditDiff(args, output);
    },
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
    extractSubtext: (args) => formatChangeSummary(args),
  },
  bash_exec: {
    running: "Running",
    complete: "Ran",
    headerVerb: "Bash",
    runningHeaderVerb: "Running",
    headerColor: "yellow",
    extractDetail: (args, _output, metadata) => {
      const cmd =
        typeof metadata?.command === "string"
          ? metadata.command
          : typeof args?.command === "string"
            ? args.command
            : undefined;
      if (!cmd) return undefined;
      const firstLine = cmd.split("\n")[0];
      const display = firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
      const lineCount = cmd.split("\n").length;
      const cmdText = lineCount > 1 ? `${display} (+${lineCount - 1} lines)` : display;

      // Add exit code from metadata
      const exitCode = typeof metadata?.exitCode === "number" ? metadata.exitCode : undefined;
      if (exitCode !== undefined) {
        return `${cmdText} — exit ${exitCode}`;
      }
      return cmdText;
    },
    extractPreview: formatBashPreview,
    extractHeaderArg: (args) => {
      const cmd = typeof args?.command === "string" ? args.command : undefined;
      if (!cmd) return undefined;
      const firstLine = cmd.split("\n")[0];
      return firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;
    },
    extractSubtext: (_args, output, duration) => {
      if (output) {
        const lines = output.trim().split("\n");
        const firstNonEmpty = lines.find((l) => l.trim().length > 0);
        if (firstNonEmpty) {
          const trimmed = firstNonEmpty.trim();
          return trimmed.length > 80 ? trimmed.slice(0, 77) + "…" : trimmed;
        }
      }
      return formatDurationSubtext(duration);
    },
  },
  bash_output: {
    running: "Reading output",
    complete: "Read output",
    headerVerb: "BashOutput",
    runningHeaderVerb: "Reading output",
    headerColor: "yellow",
    extractDetail: (args) => {
      const processId = typeof args?.processId === "string" ? args.processId : undefined;
      return processId ? `from ${processId}` : undefined;
    },
    extractPreview: formatBashPreview,
    extractHeaderArg: (args) => (typeof args?.processId === "string" ? args.processId : undefined),
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  kill_shell: {
    running: "Terminating",
    complete: "Terminated",
    headerVerb: "Kill",
    runningHeaderVerb: "Terminating",
    headerColor: "red",
    extractDetail: (args) => {
      const processId = typeof args?.processId === "string" ? args.processId : undefined;
      const signal = typeof args?.signal === "string" ? args.signal : "SIGTERM";
      return processId ? `${processId} (${signal})` : undefined;
    },
    extractHeaderArg: (args) => (typeof args?.processId === "string" ? args.processId : undefined),
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  glob_search: {
    running: "Searching files",
    complete: "Found",
    headerVerb: "Search",
    runningHeaderVerb: "Searching",
    headerColor: "magenta",
    extractDetail: (args, output, metadata) => {
      const pattern =
        typeof metadata?.pattern === "string"
          ? `"${metadata.pattern}"`
          : typeof args?.pattern === "string"
            ? `"${args.pattern}"`
            : undefined;

      const count = typeof metadata?.count === "number" ? metadata.count : undefined;
      if (count !== undefined) {
        return `${count} file${count === 1 ? "" : "s"} matching ${pattern ?? "pattern"}`;
      }

      // Fallback
      if (output) {
        const lines = output
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        const c = `${lines.length} file${lines.length === 1 ? "" : "s"}`;
        return pattern ? `${c} matching ${pattern}` : c;
      }
      return pattern;
    },
    extractHeaderArg: (args) => (typeof args?.pattern === "string" ? args.pattern : undefined),
    extractSubtext: (_args, output) => {
      const count = countNonEmptyLines(output);
      if (count > 0) return `${count} file${count === 1 ? "" : "s"}`;
      return undefined;
    },
  },
  grep_search: {
    running: "Searching",
    complete: "Searched",
    headerVerb: "Search",
    runningHeaderVerb: "Searching",
    headerColor: "magenta",
    extractDetail: (args, output, metadata) => {
      const pattern =
        typeof metadata?.pattern === "string"
          ? `"${metadata.pattern}"`
          : typeof args?.pattern === "string"
            ? `"${args.pattern}"`
            : undefined;
      const searchPath = typeof args?.path === "string" ? shortenPath(args.path) : undefined;

      const matchCount = typeof metadata?.matchCount === "number" ? metadata.matchCount : undefined;
      if (matchCount !== undefined) {
        const pathSuffix = searchPath ? ` in ${searchPath}` : "";
        return `${pattern ?? "pattern"}${pathSuffix} — ${matchCount} match${matchCount === 1 ? "" : "es"}`;
      }

      // Fallback to output counting
      if (output) {
        const lines = output
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        const matchInfo = `${lines.length} result${lines.length === 1 ? "" : "s"}`;
        const pathSuffix = searchPath ? ` in ${searchPath}` : "";
        return pattern ? `${pattern}${pathSuffix} — ${matchInfo}` : matchInfo;
      }
      return pattern;
    },
    extractHeaderArg: (args) =>
      typeof args?.pattern === "string" ? `"${args.pattern}"` : undefined,
    extractSubtext: (_args, output) => {
      const count = countNonEmptyLines(output);
      if (count > 0) return `${count} result${count === 1 ? "" : "s"}`;
      return undefined;
    },
  },
  mkdir: {
    running: "Creating directory",
    complete: "Created directory",
    headerVerb: "Mkdir",
    runningHeaderVerb: "Creating",
    headerColor: "cyan",
    extractDetail: (args) => (typeof args?.path === "string" ? shortenPath(args.path) : undefined),
    extractHeaderArg: (args) =>
      typeof args?.path === "string" ? shortenPath(args.path) : undefined,
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  web_fetch: {
    running: "Fetching",
    complete: "Fetched",
    headerVerb: "Fetch",
    runningHeaderVerb: "Fetching",
    headerColor: "magenta",
    extractDetail: (args, output, metadata) => {
      const url =
        typeof metadata?.url === "string"
          ? metadata.url
          : typeof args?.url === "string"
            ? args.url
            : undefined;
      if (!url) return undefined;
      // Truncate long URLs
      const displayUrl = url.length > 60 ? url.slice(0, 57) + "…" : url;
      if (output) {
        const bytes = new TextEncoder().encode(output).byteLength;
        if (bytes >= 1024) return `${displayUrl} — ${(bytes / 1024).toFixed(1)} KB`;
        return `${displayUrl} — ${bytes} B`;
      }
      return displayUrl;
    },
    extractHeaderArg: (args) => (typeof args?.url === "string" ? args.url : undefined),
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  web_search: {
    running: "Searching web",
    complete: "Searched web",
    headerVerb: "WebSearch",
    runningHeaderVerb: "Searching web",
    headerColor: "magenta",
    extractDetail: (args, output, metadata) => {
      const query =
        typeof metadata?.query === "string"
          ? `"${metadata.query}"`
          : typeof args?.query === "string"
            ? `"${args.query}"`
            : undefined;

      const resultCount =
        typeof metadata?.resultCount === "number" ? metadata.resultCount : undefined;
      if (resultCount !== undefined) {
        return `${query ?? "query"} — ${resultCount} result${resultCount === 1 ? "" : "s"}`;
      }

      if (output) {
        const lines = output
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        return `${query ?? "query"} — ${lines.length} result${lines.length === 1 ? "" : "s"}`;
      }
      return query;
    },
  },
  list_dir: {
    running: "Listing",
    complete: "Listed",
    headerVerb: "List",
    runningHeaderVerb: "Listing",
    headerColor: "blue",
    extractDetail: (args, output, metadata) => {
      const dirPath =
        typeof metadata?.path === "string"
          ? shortenPath(metadata.path)
          : typeof args?.path === "string"
            ? shortenPath(args.path)
            : undefined;
      const entryCount = typeof metadata?.entryCount === "number" ? metadata.entryCount : undefined;
      if (dirPath && entryCount !== undefined) {
        return `${dirPath} — ${entryCount} entries`;
      }
      if (dirPath && output) {
        const lines = output
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        return `${dirPath} — ${lines.length} entries`;
      }
      return dirPath;
    },
    extractHeaderArg: (args) =>
      typeof args?.path === "string" ? shortenPath(args.path) : undefined,
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  notebook_edit: {
    running: "Editing notebook",
    complete: "Edited notebook",
    headerVerb: "EditNotebook",
    runningHeaderVerb: "Editing",
    headerColor: "cyan",
    extractDetail: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  ask_user: {
    running: "Asking",
    complete: "Asked",
    headerVerb: "Ask",
    runningHeaderVerb: "Asking",
    headerColor: "yellow",
    extractDetail: (args) => {
      const question = typeof args?.question === "string" ? args.question : undefined;
      if (!question) return undefined;
      return question.length > 60 ? question.slice(0, 57) + "…" : question;
    },
    extractHeaderArg: (args) => {
      const question = typeof args?.question === "string" ? args.question : undefined;
      if (!question) return undefined;
      return question.length > 40 ? question.slice(0, 37) + "…" : question;
    },
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  },
  agent: {
    running: "Running agent",
    complete: "Agent completed",
    headerVerb: "Agent",
    runningHeaderVerb: "Running agent",
    headerColor: "green",
    extractDetail: (args, _output, metadata) => {
      const desc = typeof args?.description === "string" ? args.description : undefined;
      const type =
        typeof metadata?.type === "string"
          ? metadata.type
          : typeof args?.type === "string"
            ? args.type
            : undefined;
      if (desc) return type ? `(${type}) ${desc}` : desc;
      return type;
    },
  },
  todo_write: {
    running: "Updating tasks",
    complete: "Updated tasks",
    headerVerb: "Todo",
    runningHeaderVerb: "Updating tasks",
    headerColor: "yellow",
    extractDetail: (_args, _output, metadata) => {
      const total = typeof metadata?.total === "number" ? metadata.total : undefined;
      const completed = typeof metadata?.completed === "number" ? metadata.completed : undefined;
      if (total !== undefined && completed !== undefined) {
        return `${completed}/${total} completed`;
      }
      return undefined;
    },
  },
  code_outline: {
    running: "Analyzing",
    complete: "Outlined",
    headerVerb: "Outline",
    runningHeaderVerb: "Analyzing",
    headerColor: "blue",
    extractDetail: (args, _output, metadata) => {
      const filePath =
        typeof metadata?.filePath === "string"
          ? shortenPath(metadata.filePath)
          : typeof args?.file_path === "string"
            ? shortenPath(args.file_path)
            : undefined;
      if (!filePath) return undefined;

      const lang = typeof metadata?.language === "string" ? metadata.language : undefined;
      const count = typeof metadata?.symbolCount === "number" ? metadata.symbolCount : undefined;
      const parts = [filePath];
      if (lang) parts.push(lang);
      if (count !== undefined) parts.push(`${count} symbols`);
      return parts.join(" — ");
    },
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
  },
  goto_definition: {
    running: "Finding definition",
    complete: "Found definition",
    headerVerb: "GotoDef",
    runningHeaderVerb: "Finding definition",
    headerColor: "blue",
    extractDetail: (args, _output, metadata) => {
      const filePath =
        typeof metadata?.filePath === "string"
          ? shortenPath(metadata.filePath)
          : typeof args?.file_path === "string"
            ? shortenPath(args.file_path)
            : undefined;
      const symbolName = typeof args?.symbol_name === "string" ? args.symbol_name : undefined;
      const count = typeof metadata?.resultCount === "number" ? metadata.resultCount : undefined;
      const parts: string[] = [];
      if (symbolName) parts.push(`"${symbolName}"`);
      if (filePath) parts.push(filePath);
      if (count !== undefined) parts.push(`${count} result${count === 1 ? "" : "s"}`);
      return parts.length > 0 ? parts.join(" — ") : undefined;
    },
    extractHeaderArg: (args) =>
      typeof args?.symbol_name === "string"
        ? args.symbol_name
        : typeof args?.file_path === "string"
          ? shortenPath(args.file_path)
          : undefined,
  },
  find_references: {
    running: "Finding references",
    complete: "Found references",
    headerVerb: "FindRefs",
    runningHeaderVerb: "Finding references",
    headerColor: "blue",
    extractDetail: (args, _output, metadata) => {
      const filePath =
        typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined;
      const count = typeof metadata?.resultCount === "number" ? metadata.resultCount : undefined;
      const fileCount = typeof metadata?.fileCount === "number" ? metadata.fileCount : undefined;
      const parts: string[] = [];
      if (filePath) parts.push(filePath);
      if (count !== undefined) parts.push(`${count} ref${count === 1 ? "" : "s"}`);
      if (fileCount !== undefined) parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
      return parts.length > 0 ? parts.join(" — ") : undefined;
    },
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
  },
  get_type_info: {
    running: "Getting type info",
    complete: "Got type info",
    headerVerb: "TypeInfo",
    runningHeaderVerb: "Getting type info",
    headerColor: "cyan",
    extractDetail: (args, _output, metadata) => {
      const filePath =
        typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined;
      const type = typeof metadata?.type === "string" ? metadata.type : undefined;
      const parts: string[] = [];
      if (filePath) parts.push(filePath);
      if (type) {
        const truncated = type.length > 60 ? type.slice(0, 57) + "..." : type;
        parts.push(truncated);
      }
      return parts.length > 0 ? parts.join(" — ") : undefined;
    },
    extractHeaderArg: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
  },
  safe_rename: {
    running: "Renaming",
    complete: "Renamed",
    headerVerb: "Rename",
    runningHeaderVerb: "Renaming",
    headerColor: "yellow",
    extractDetail: (args, _output, metadata) => {
      const newName = typeof args?.new_name === "string" ? args.new_name : undefined;
      const dryRun = typeof args?.dry_run === "boolean" ? args.dry_run : true;
      const filesModified =
        typeof metadata?.filesModified === "number" ? metadata.filesModified : undefined;
      const totalEdits = typeof metadata?.totalEdits === "number" ? metadata.totalEdits : undefined;
      const parts: string[] = [];
      if (newName) parts.push(`→ "${newName}"`);
      if (dryRun) parts.push("[dry run]");
      if (filesModified !== undefined)
        parts.push(`${filesModified} file${filesModified === 1 ? "" : "s"}`);
      if (totalEdits !== undefined) parts.push(`${totalEdits} edit${totalEdits === 1 ? "" : "s"}`);
      return parts.length > 0 ? parts.join(" — ") : undefined;
    },
    extractHeaderArg: (args) => (typeof args?.new_name === "string" ? args.new_name : undefined),
  },
};

/**
 * MCP 도구 이름에서 서버명과 도구명을 파싱합니다.
 * "mcp__{server}__{tool}" 형태의 이름을 분리합니다.
 *
 * @returns 파싱 결과 { server, tool } 또는 파싱 실패 시 undefined
 */
function parseMCPToolName(
  toolName: string,
): { readonly server: string; readonly tool: string } | undefined {
  if (!toolName.startsWith("mcp__")) return undefined;
  const withoutPrefix = toolName.slice(5); // "mcp__" 제거
  const separatorIndex = withoutPrefix.indexOf("__");
  if (separatorIndex <= 0) return undefined;
  const server = withoutPrefix.slice(0, separatorIndex);
  const tool = withoutPrefix.slice(separatorIndex + 2);
  if (!server || !tool) return undefined;
  return { server, tool };
}

/**
 * MCP 도구 이름의 tool 부분에서 도구 유형을 휴리스틱으로 판별하여
 * 적절한 ToolDisplayConfig를 반환합니다.
 *
 * 판별 규칙:
 * - "search" 포함 → magenta, "Searching" 동사
 * - "read" 또는 "get" 포함 → blue, "Reading" 동사
 * - "write", "create", "edit", "update" 포함 → cyan, "Writing" 동사
 * - "navigate", "click", "snapshot" 포함 → green, "Browsing" 동사
 * - "run", "execute", "eval" 포함 → yellow, "Running" 동사
 * - 기본값 → gray, "Running" 동사
 */
function getMCPToolDisplay(toolName: string): ToolDisplayConfig | undefined {
  const parsed = parseMCPToolName(toolName);
  if (!parsed) return undefined;

  const { server, tool } = parsed;
  const toolLower = tool.toLowerCase();

  // 도구 유형 휴리스틱 판별
  let runningVerb: string;
  let completeVerb: string;
  let headerColor: string;

  if (toolLower.includes("search")) {
    runningVerb = "Searching";
    completeVerb = "Searched";
    headerColor = "magenta";
  } else if (toolLower.includes("read") || toolLower.includes("get")) {
    runningVerb = "Reading";
    completeVerb = "Read";
    headerColor = "blue";
  } else if (
    toolLower.includes("write") ||
    toolLower.includes("create") ||
    toolLower.includes("edit") ||
    toolLower.includes("update")
  ) {
    runningVerb = "Writing";
    completeVerb = "Wrote";
    headerColor = "cyan";
  } else if (
    toolLower.includes("navigate") ||
    toolLower.includes("click") ||
    toolLower.includes("snapshot")
  ) {
    runningVerb = "Browsing";
    completeVerb = "Browsed";
    headerColor = "green";
  } else if (
    toolLower.includes("run") ||
    toolLower.includes("execute") ||
    toolLower.includes("eval")
  ) {
    runningVerb = "Running";
    completeVerb = "Ran";
    headerColor = "yellow";
  } else {
    runningVerb = "Running";
    completeVerb = "Ran";
    headerColor = "gray";
  }

  const headerLabel = `[MCP:${server}] ${tool}`;

  return {
    running: runningVerb,
    complete: completeVerb,
    headerVerb: headerLabel,
    runningHeaderVerb: `${runningVerb} ${headerLabel}`,
    headerColor,
    extractDetail: (_args, _output, metadata) => {
      const serverMeta = typeof metadata?.serverName === "string" ? metadata.serverName : server;
      return `[MCP:${serverMeta}] ${tool}`;
    },
    extractSubtext: (_args, _output, duration) => formatDurationSubtext(duration),
  };
}

/** 밀리초 단위 소요시간을 사람이 읽기 쉬운 문자열로 변환 — "150ms", "1.5s", "2m 30s" */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * 도구의 헤더 정보를 생성합니다.
 * toolDisplayMap에 정의된 설정을 기반으로 동사, 인수, 서브텍스트를 조합합니다.
 * 맵에 없는 도구는 기본 형식("Running tool_name" / "Tool tool_name")으로 표시합니다.
 */
export function getToolHeaderInfo(
  name: string,
  status: ToolStatus,
  args?: Record<string, unknown>,
  output?: string,
  duration?: number,
  metadata?: Readonly<Record<string, unknown>>,
): ToolHeaderInfo {
  const config = toolDisplayMap[name] ?? getMCPToolDisplay(name);
  if (!config) {
    return {
      header: status === "running" ? `Running ${name}` : `Tool ${name}`,
      color: "gray",
      subtext: duration ? formatDuration(duration) : undefined,
    };
  }

  const verb = status === "running" ? config.runningHeaderVerb : config.headerVerb;
  const arg = config.extractHeaderArg?.(args);
  const header = arg ? `${verb} ${arg}` : verb;
  let subtext = config.extractSubtext?.(args, output, duration);

  // When metadata is available, use extractDetail for richer subtext
  if (metadata && config.extractDetail) {
    const detail = config.extractDetail(args, output, metadata);
    if (detail) subtext = detail;
  }

  return { header, color: config.headerColor, subtext };
}

/**
 * 도구의 상태를 한 줄 텍스트로 반환합니다.
 * 예: "Read src/App.tsx — 352 lines (1.2s)"
 */
export function getToolDisplayText(
  name: string,
  status: ToolStatus,
  args?: Record<string, unknown>,
  output?: string,
  duration?: number,
  metadata?: Readonly<Record<string, unknown>>,
): string {
  const config = toolDisplayMap[name] ?? getMCPToolDisplay(name);
  if (!config) {
    const base = status === "running" ? `Running ${name}` : `Completed ${name}`;
    return duration && status !== "running" ? `${base} (${formatDuration(duration)})` : base;
  }

  const verb = status === "running" ? config.running : config.complete;
  const detail = config.extractDetail?.(args, output, metadata);
  const base = detail ? `${verb} ${detail}` : verb;

  return duration && status !== "running" ? `${base} (${formatDuration(duration)})` : base;
}

/** 도구 상태 줄 아래에 표시할 미리보기 스니펫을 가져옴 (diff, 출력 요약 등) */
export function getToolPreview(
  name: string,
  status: ToolStatus,
  args?: Record<string, unknown>,
  output?: string,
  metadata?: Readonly<Record<string, unknown>>,
): string | undefined {
  const config = toolDisplayMap[name] ?? getMCPToolDisplay(name);
  return config?.extractPreview?.(args, output, status, metadata);
}

/** 도구 상태에 해당하는 아이콘 문자를 반환 — running=⠋(스피너), complete=✓, error=✗, denied=! */
export function getToolStatusIcon(status: ToolStatus): string {
  switch (status) {
    case "running":
      return "\u280B";
    case "complete":
      return "\u2713";
    case "error":
      return "\u2717";
    case "denied":
      return "!";
  }
}

export const SPINNER_FRAMES = [
  "\u280B",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283C",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280F",
] as const;

export const SPINNER_INTERVAL_MS = 200;
