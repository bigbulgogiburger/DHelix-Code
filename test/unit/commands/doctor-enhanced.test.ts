import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock modules before importing doctor
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  accessSync: vi.fn(),
  constants: { R_OK: 4, W_OK: 2 },
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/testuser"),
}));

const baseContext = {
  workingDirectory: process.cwd(),
  model: "test-model",
  sessionId: "test-session",
  emit: () => {},
};

describe("/doctor enhanced diagnostics", () => {
  const mockedExecSync = vi.mocked(execSync);
  const mockedExistsSync = vi.mocked(existsSync);
  const mockedAccessSync = vi.mocked(accessSync);

  beforeEach(() => {
    vi.resetAllMocks();
    // Default happy-path stubs
    mockedExecSync.mockImplementation((cmd: string) => {
      const cmdStr = String(cmd);
      if (cmdStr === "git --version") return "git version 2.43.0\n";
      if (cmdStr.includes("rev-parse")) return "true\n";
      if (cmdStr === "df -h .")
        return "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   55G   45G  55% /\n";
      return "";
    });
    mockedExistsSync.mockReturnValue(true);
    mockedAccessSync.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Must re-import after mocks are set up
  async function getDoctorCommand() {
    // Dynamic import to get module with mocks applied
    const mod = await import("../../../src/commands/doctor.js");
    return mod.doctorCommand;
  }

  it("should include all 8 checks when everything passes", async () => {
    const doctorCommand = await getDoctorCommand();
    const result = await doctorCommand.execute("", {
      ...baseContext,
      model: "gpt-4o",
    });

    expect(result.output).toContain("dbcode Doctor");
    expect(result.output).toContain("=============");
    expect(result.output).toContain("Node.js");
    expect(result.output).toContain("Git");
    expect(result.output).toContain("Git repo");
    expect(result.output).toContain("Model");
    expect(result.output).toContain("API key");
    expect(result.output).toContain("Disk space");
    expect(result.output).toContain("Config directory");
    expect(result.output).toContain("Syntax highlighter");
  });

  describe("Node.js version check", () => {
    it("should pass for Node.js 20+", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      // Running in test env which is Node 20+
      expect(result.output).toContain("\u2713 Node.js");
      expect(result.output).toContain("(>=20 required)");
    });
  });

  describe("Git check", () => {
    it("should pass when git is available", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 Git");
      expect(result.output).toContain("2.43.0");
    });

    it("should fail when git is not found", async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr === "git --version") throw new Error("not found");
        if (cmdStr === "df -h .")
          return "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   55G   45G  55% /\n";
        return "";
      });

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2717 Git: Not found in PATH");
      expect(result.output).toContain("Fix: Install Git");
      expect(result.success).toBe(false);
    });
  });

  describe("Git repo check", () => {
    it("should pass in a git repository", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 Git repo");
    });

    it("should warn when not in a git repository", async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr === "git --version") return "git version 2.43.0\n";
        if (cmdStr.includes("rev-parse")) throw new Error("not a repo");
        if (cmdStr === "df -h .")
          return "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   55G   45G  55% /\n";
        return "";
      });

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u26A0 Git repo: Not a git repository");
      expect(result.output).toContain("Fix: Run `git init`");
    });
  });

  describe("Model configuration check", () => {
    it("should pass when model is configured", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", {
        ...baseContext,
        model: "gpt-4o",
      });
      expect(result.output).toContain("\u2713 Model: gpt-4o");
    });

    it("should fail when no model is configured", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", {
        ...baseContext,
        model: "",
      });
      expect(result.output).toContain("\u2717 Model: No model configured");
      expect(result.success).toBe(false);
    });
  });

  describe("API key check", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should pass when OPENAI_API_KEY is set", async () => {
      process.env["OPENAI_API_KEY"] = "sk-test-key";
      delete process.env["DBCODE_API_KEY"];
      delete process.env["ANTHROPIC_API_KEY"];

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 API key: configured");
    });

    it("should pass when DBCODE_API_KEY is set", async () => {
      delete process.env["OPENAI_API_KEY"];
      process.env["DBCODE_API_KEY"] = "dbcode-test-key";
      delete process.env["ANTHROPIC_API_KEY"];

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 API key: configured");
    });

    it("should pass when ANTHROPIC_API_KEY is set", async () => {
      delete process.env["OPENAI_API_KEY"];
      delete process.env["DBCODE_API_KEY"];
      process.env["ANTHROPIC_API_KEY"] = "ant-test-key";

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 API key: configured");
    });

    it("should warn when no API key is set", async () => {
      delete process.env["OPENAI_API_KEY"];
      delete process.env["DBCODE_API_KEY"];
      delete process.env["ANTHROPIC_API_KEY"];

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u26A0 API key: No API key found");
      expect(result.output).toContain("Fix: Set OPENAI_API_KEY");
    });
  });

  describe("Disk space check", () => {
    it("should show available disk space", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 Disk space: 45G free");
    });

    it("should warn when df command fails", async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr === "git --version") return "git version 2.43.0\n";
        if (cmdStr.includes("rev-parse")) return "true\n";
        if (cmdStr === "df -h .") throw new Error("df not available");
        return "";
      });

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u26A0 Disk space: Could not check disk space");
      expect(result.output).toContain("Fix: Check disk usage manually");
    });

    it("should warn when df output is unparseable", async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr === "git --version") return "git version 2.43.0\n";
        if (cmdStr.includes("rev-parse")) return "true\n";
        if (cmdStr === "df -h .") return "unexpected output";
        return "";
      });

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u26A0 Disk space: Could not parse disk space");
    });
  });

  describe("Config directory check", () => {
    it("should pass when config dir exists and is writable", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedAccessSync.mockReturnValue(undefined);

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2713 Config directory: ~/.dbcode (writable)");
    });

    it("should warn when config dir does not exist", async () => {
      mockedExistsSync.mockReturnValue(false);

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u26A0 Config directory: ~/.dbcode does not exist");
      expect(result.output).toContain("Fix: Run dbcode once");
    });

    it("should fail when config dir is not writable", async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedAccessSync.mockImplementation(() => {
        throw new Error("EACCES");
      });

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toContain("\u2717 Config directory: ~/.dbcode is not writable");
      expect(result.output).toContain("Fix: Fix permissions");
      expect(result.success).toBe(false);
    });
  });

  describe("Syntax highlighter check", () => {
    it("should report syntax highlighter status", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      // Shiki may or may not be available in test env — just check the check exists
      expect(result.output).toContain("Syntax highlighter");
    });
  });

  describe("Summary line", () => {
    it("should show correct summary with all passing", async () => {
      // With happy-path mocks and an API key
      process.env["OPENAI_API_KEY"] = "sk-test";

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toMatch(/\d+\/\d+ checks passed/);
      expect(result.success).toBe(true);
    });

    it("should show warnings count in summary", async () => {
      // Remove API keys to trigger a warning
      delete process.env["OPENAI_API_KEY"];
      delete process.env["DBCODE_API_KEY"];
      delete process.env["ANTHROPIC_API_KEY"];

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toMatch(/warning/);
    });

    it("should show failure count in summary when checks fail", async () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        const cmdStr = String(cmd);
        if (cmdStr === "git --version") throw new Error("not found");
        if (cmdStr === "df -h .")
          return "Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1       100G   55G   45G  55% /\n";
        return "";
      });

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      expect(result.output).toMatch(/failure/);
      expect(result.success).toBe(false);
    });
  });

  describe("Output format", () => {
    it("should use correct status symbols", async () => {
      process.env["OPENAI_API_KEY"] = "sk-test";

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      // At least one check mark should appear
      expect(result.output).toContain("\u2713");
    });

    it("should start with header", async () => {
      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      const lines = result.output.split("\n");
      expect(lines[0]).toBe("dbcode Doctor");
      expect(lines[1]).toBe("=============");
    });

    it("should include fix suggestions for warnings and failures", async () => {
      delete process.env["OPENAI_API_KEY"];
      delete process.env["DBCODE_API_KEY"];
      delete process.env["ANTHROPIC_API_KEY"];

      const doctorCommand = await getDoctorCommand();
      const result = await doctorCommand.execute("", baseContext);
      // API key warning should have a fix
      expect(result.output).toContain("Fix:");
    });
  });

  describe("Command metadata", () => {
    it("should have correct name and description", async () => {
      const doctorCommand = await getDoctorCommand();
      expect(doctorCommand.name).toBe("doctor");
      expect(doctorCommand.description).toBe("Run diagnostic checks");
      expect(doctorCommand.usage).toBe("/doctor");
    });
  });
});
