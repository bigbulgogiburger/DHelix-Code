type ToolStatus = "running" | "complete" | "error" | "denied";

interface ToolDisplayConfig {
  readonly running: string;
  readonly complete: string;
  readonly extractDetail?: (args?: Record<string, unknown>, output?: string) => string | undefined;
}

const toolDisplayMap: Record<string, ToolDisplayConfig> = {
  file_read: {
    running: "Reading",
    complete: "Read",
    extractDetail: (args, output) => {
      const filePath = typeof args?.file_path === "string" ? args.file_path : undefined;
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
      const filePath = typeof args?.file_path === "string" ? args.file_path : undefined;
      if (!filePath) return undefined;
      const content = typeof args?.content === "string" ? args.content : undefined;
      if (content) {
        const bytes = new TextEncoder().encode(content).byteLength;
        if (bytes < 1024) return `${filePath} (${bytes} B)`;
        return `${filePath} (${(bytes / 1024).toFixed(1)} KB)`;
      }
      return filePath;
    },
  },
  file_edit: {
    running: "Editing",
    complete: "Edited",
    extractDetail: (args) => typeof args?.file_path === "string" ? args.file_path : undefined,
  },
  bash_exec: {
    running: "Running",
    complete: "Ran",
    extractDetail: (args) => {
      const cmd = typeof args?.command === "string" ? args.command : undefined;
      if (!cmd) return undefined;
      return cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd;
    },
  },
  glob_search: {
    running: "Searching for",
    complete: "Found",
    extractDetail: (args, output) => {
      if (output) {
        const lines = output.trim().split("\n").filter((l) => l.length > 0);
        return `${lines.length} file${lines.length === 1 ? "" : "s"}`;
      }
      return typeof args?.pattern === "string" ? args.pattern : undefined;
    },
  },
  grep_search: {
    running: "Searching for",
    complete: "Searched for",
    extractDetail: (args) => {
      const pattern = typeof args?.pattern === "string" ? args.pattern : undefined;
      return pattern ? `"${pattern}"` : undefined;
    },
  },
  mkdir: {
    running: "Creating",
    complete: "Created",
    extractDetail: (args) => typeof args?.path === "string" ? args.path : undefined,
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
