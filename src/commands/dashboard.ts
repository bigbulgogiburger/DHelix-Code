/**
 * /dashboard 명령어 — REST API 대시보드 서버를 관리
 *
 * 사용법:
 * - /dashboard — 대시보드 상태 표시
 * - /dashboard start — 대시보드 서버 시작
 * - /dashboard stop — 대시보드 서버 중지
 * - /dashboard start [port] — 포트 지정하여 시작
 *
 * @module commands/dashboard
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** Dashboard server singleton — lazy initialized */
let dashboardInstance: {
  server: unknown;
  port: number;
  running: boolean;
} | null = null;

export const dashboardCommand: SlashCommand = {
  name: "dashboard",
  description: "Manage the REST API dashboard server",
  usage: "/dashboard [start|stop|status]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const subcommand = args.trim().toLowerCase().split(/\s+/)[0] || "status";
    const portArg = args.trim().split(/\s+/)[1];

    switch (subcommand) {
      case "start": {
        if (dashboardInstance?.running) {
          return {
            output: `Dashboard already running at http://localhost:${dashboardInstance.port}`,
            success: true,
          };
        }

        const port = portArg ? parseInt(portArg, 10) : 18120;
        if (isNaN(port) || port < 1024 || port > 65535) {
          return {
            output: "Invalid port number. Use a port between 1024 and 65535.",
            success: false,
          };
        }

        try {
          // Dynamic import to avoid loading dashboard module when not needed
          const { DashboardServer } = await import("../dashboard/index.js");

          // Create minimal data sources that return empty data
          // These will be enhanced once proper integration is wired
          const server = new DashboardServer({
            port,
            sessions: {
              getSessions: async () => [],
              getSessionById: async () => null,
            },
            mcp: {
              getServers: async () => [],
            },
            jobs: {
              getJobs: async () => [],
            },
            metrics: {
              getMetrics: async () => ({
                totalIterations: 0,
                totalTokens: 0,
                activeAgents: 0,
                uptime: Date.now(),
              }),
            },
          });

          await server.start();
          dashboardInstance = { server, port, running: true };

          return {
            output: [
              `Dashboard started at http://localhost:${port}`,
              "",
              "Endpoints:",
              `  GET http://localhost:${port}/health`,
              `  GET http://localhost:${port}/api/sessions`,
              `  GET http://localhost:${port}/api/mcp/servers`,
              `  GET http://localhost:${port}/api/jobs`,
              `  GET http://localhost:${port}/api/metrics`,
              `  GET http://localhost:${port}/api/events (SSE)`,
            ].join("\n"),
            success: true,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            output: `Failed to start dashboard: ${msg}`,
            success: false,
          };
        }
      }

      case "stop": {
        if (!dashboardInstance?.running) {
          return {
            output: "Dashboard is not running.",
            success: true,
          };
        }

        try {
          const server = dashboardInstance.server as { stop(): Promise<void> };
          await server.stop();
          dashboardInstance = { ...dashboardInstance, running: false };
          return {
            output: "Dashboard stopped.",
            success: true,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return {
            output: `Failed to stop dashboard: ${msg}`,
            success: false,
          };
        }
      }

      case "status":
      default: {
        if (!dashboardInstance?.running) {
          return {
            output: [
              "Dashboard: not running",
              "",
              "Use /dashboard start to launch the REST API server.",
              "Use /dashboard start [port] to specify a custom port (default: 18120).",
            ].join("\n"),
            success: true,
          };
        }

        const server = dashboardInstance.server as { getEventClientCount(): number };
        const clientCount = server.getEventClientCount();

        return {
          output: [
            `Dashboard: running at http://localhost:${dashboardInstance.port}`,
            `SSE clients connected: ${clientCount}`,
            "",
            "Use /dashboard stop to shut down.",
          ].join("\n"),
          success: true,
        };
      }
    }
  },
};
