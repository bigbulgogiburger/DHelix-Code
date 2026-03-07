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
    extractDetail: (args) => typeof args?.file_path === "string" ? args.file_path : undefined,
  },
  file_write: {
    running: "Writing",
    complete: "Wrote",
    extractDetail: (args) => typeof args?.file_path === "string" ? args.file_path : undefined,
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

export function getToolDisplayText(
  name: string,
  status: ToolStatus,
  args?: Record<string, unknown>,
  output?: string,
): string {
  const config = toolDisplayMap[name];
  if (!config) {
    return status === "running" ? `Running ${name}` : `Completed ${name}`;
  }

  const verb = status === "running" ? config.running : config.complete;
  const detail = config.extractDetail?.(args, output);

  return detail ? `${verb} ${detail}` : verb;
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

export const SPINNER_INTERVAL_MS = 80;
