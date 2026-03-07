import { describe, it, expect } from "vitest";
import { checkCommand } from "../../../src/guardrails/command-filter.js";

describe("checkCommand", () => {
  describe("BLOCK patterns", () => {
    it("should block rm -rf /", () => {
      const result = checkCommand("rm -rf /");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
      expect(result.reason).toContain("Recursive delete");
    });

    it("should block rm -rf / with trailing space", () => {
      const result = checkCommand("rm -rf / --no-preserve-root");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
    });

    it("should NOT block rm -rf /home/user", () => {
      const result = checkCommand("rm -rf /home/user/temp");
      expect(result.passed).toBe(true);
    });

    it("should block writing to /dev/sda", () => {
      const result = checkCommand("echo data > /dev/sda");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
      expect(result.reason).toContain("block device");
    });

    it("should block mkfs commands", () => {
      const result = checkCommand("mkfs.ext4 /dev/sda1");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
      expect(result.reason).toContain("format");
    });

    it("should block dd commands", () => {
      const result = checkCommand("dd if=/dev/zero of=/dev/sda");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
      expect(result.reason).toContain("dd");
    });

    it("should block fork bombs", () => {
      const result = checkCommand(":(){ :|:& };:");
      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
      expect(result.reason).toContain("Fork bomb");
    });
  });

  describe("WARN patterns", () => {
    it("should warn on DROP TABLE", () => {
      const result = checkCommand("mysql -e 'DROP TABLE users'");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.reason).toContain("DROP TABLE");
    });

    it("should warn on DELETE FROM", () => {
      const result = checkCommand("psql -c 'DELETE FROM users WHERE id > 0'");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.reason).toContain("DELETE FROM");
    });

    it("should warn on chmod 777", () => {
      const result = checkCommand("chmod 777 /var/www");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.reason).toContain("chmod");
    });

    it("should warn on sudo rm", () => {
      const result = checkCommand("sudo rm -rf /tmp/files");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.reason).toContain("Sudo remove");
    });
  });

  describe("safe commands", () => {
    it("should pass safe commands with info severity", () => {
      const result = checkCommand("ls -la");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
      expect(result.reason).toBeUndefined();
    });

    it("should pass git commands", () => {
      const result = checkCommand("git status");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("should pass npm commands", () => {
      const result = checkCommand("npm install express");
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });
  });
});
