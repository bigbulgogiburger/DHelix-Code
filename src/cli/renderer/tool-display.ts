type ToolStatus = "running" | "complete" | "error" | "denied";

interface ToolDisplayConfig {
  readonly running: string;
  readonly complete: string;
  readonly extractDetail?: (args?: Record<string, unknown>, output?: string) => string | undefined;
  /** Extract a preview snippet (diff, output preview, etc.) shown below the status line */
  readonly extractPreview?: (
    args?: Record<string, unknown>,
    output?: string,
    status?: ToolStatus,
  ) => string | undefined;
}

/** Shorten a file path to just filename for display, keep full if short enough */
function shortenPath(filePath: string, maxLen = 60): string {
  if (filePath.length <= maxLen) return filePath;
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1];
  if (parts.length <= 2) return filePath;
  return `…/${parts[parts.length - 2]}/${filename}`;
}

/** Build a diff with ±3 context lines, removed lines (-), and added lines (+) */
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

/** Generate a unified-diff-like preview for file_edit with line numbers and context */
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

/** Build a change summary like "Added 3 lines, removed 1 line" */
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

/** Format bash output preview */
function formatBashPreview(
  _args?: Record<string, unknown>,
  output?: string,
  status?: ToolStatus,
): string | undefined {
  if (!output || status === "running") return undefined;
  const lines = output.trim().split("\n");
  if (lines.length === 0) return undefined;
  const maxLines = 5;
  const preview = lines.slice(0, maxLines);
  if (lines.length > maxLines) preview.push(`  … (${lines.length - maxLines} more lines)`);
  return preview.join("\n");
}

const toolDisplayMap: Record<string, ToolDisplayConfig> = {
  file_read: {
    running: "Reading",
    complete: "Read",
    extractDetail: (args, output) => {
      const filePath =
        typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined;
      if (!filePath) return undefined;
      if (output) {
        const lines = output.trim().split("\n");
        const lineCount = lines.filter((l) => l.length > 0).length;
        if (lineCount > 0) return `${filePath} (${lineCount} lines)`;
      }
      return filePath;
    },
  },
  file_write: {
    running: "Writing",
    complete: "Wrote",
    extractDetail: (args) => {
      const filePath =
        typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined;
      if (!filePath) return undefined;
      const content = typeof args?.content === "string" ? args.content : undefined;
      if (content) {
        const lineCount = content.split("\n").length;
        const bytes = new TextEncoder().encode(content).byteLength;
        if (bytes < 1024) return `${filePath} (${lineCount} lines, ${bytes} B)`;
        return `${filePath} (${lineCount} lines, ${(bytes / 1024).toFixed(1)} KB)`;
      }
      return filePath;
    },
  },
  file_edit: {
    running: "Editing",
    complete: "Edited",
    extractDetail: (args) => {
      const filePath =
        typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined;
      if (!filePath) return undefined;
      const replaceAll = args?.replace_all === true;
      const summary = formatChangeSummary(args);
      if (replaceAll) return `${filePath} (replace all)`;
      if (summary) return `${filePath} — ${summary}`;
      return filePath;
    },
    extractPreview: (args, output, status) => {
      if (status === "running") return undefined;
      return formatEditDiff(args, output);
    },
  },
  bash_exec: {
    running: "Running",
    complete: "Ran",
    extractDetail: (args) => {
      const cmd = typeof args?.command === "string" ? args.command : undefined;
      if (!cmd) return undefined;
      // Show first line of multi-line commands, truncate long single-line
      const firstLine = cmd.split("\n")[0];
      const display = firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
      const lineCount = cmd.split("\n").length;
      return lineCount > 1 ? `${display} (+${lineCount - 1} lines)` : display;
    },
    extractPreview: formatBashPreview,
  },
  glob_search: {
    running: "Searching files",
    complete: "Found",
    extractDetail: (args, output) => {
      const pattern = typeof args?.pattern === "string" ? `"${args.pattern}"` : undefined;
      if (output) {
        const lines = output
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        const count = `${lines.length} file${lines.length === 1 ? "" : "s"}`;
        return pattern ? `${count} matching ${pattern}` : count;
      }
      return pattern;
    },
  },
  grep_search: {
    running: "Searching",
    complete: "Searched",
    extractDetail: (args, output) => {
      const pattern = typeof args?.pattern === "string" ? `"${args.pattern}"` : undefined;
      if (output) {
        const lines = output
          .trim()
          .split("\n")
          .filter((l) => l.length > 0);
        const matchInfo = `${lines.length} result${lines.length === 1 ? "" : "s"}`;
        return pattern ? `${pattern} — ${matchInfo}` : matchInfo;
      }
      return pattern;
    },
  },
  mkdir: {
    running: "Creating directory",
    complete: "Created directory",
    extractDetail: (args) => (typeof args?.path === "string" ? shortenPath(args.path) : undefined),
  },
  web_fetch: {
    running: "Fetching",
    complete: "Fetched",
    extractDetail: (args) => (typeof args?.url === "string" ? args.url : undefined),
  },
  list_dir: {
    running: "Listing",
    complete: "Listed",
    extractDetail: (args) => (typeof args?.path === "string" ? shortenPath(args.path) : undefined),
  },
  notebook_edit: {
    running: "Editing notebook",
    complete: "Edited notebook",
    extractDetail: (args) =>
      typeof args?.file_path === "string" ? shortenPath(args.file_path) : undefined,
  },
  ask_user: {
    running: "Asking",
    complete: "Asked",
    extractDetail: (args) => {
      const question = typeof args?.question === "string" ? args.question : undefined;
      if (!question) return undefined;
      return question.length > 60 ? question.slice(0, 57) + "…" : question;
    },
  },
};

/** Format duration in ms to human-readable string */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function getToolDisplayText(
  name: string,
  status: ToolStatus,
  args?: Record<string, unknown>,
  output?: string,
  duration?: number,
): string {
  const config = toolDisplayMap[name];
  if (!config) {
    const base = status === "running" ? `Running ${name}` : `Completed ${name}`;
    return duration && status !== "running" ? `${base} (${formatDuration(duration)})` : base;
  }

  const verb = status === "running" ? config.running : config.complete;
  const detail = config.extractDetail?.(args, output);
  const base = detail ? `${verb} ${detail}` : verb;

  return duration && status !== "running" ? `${base} (${formatDuration(duration)})` : base;
}

/** Get a preview snippet for display below the tool status line */
export function getToolPreview(
  name: string,
  status: ToolStatus,
  args?: Record<string, unknown>,
  output?: string,
): string | undefined {
  const config = toolDisplayMap[name];
  return config?.extractPreview?.(args, output, status);
}

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
