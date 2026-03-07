import { describe, it, expect } from "vitest";
import {
  applyInputGuardrails,
  applyOutputGuardrails,
} from "../../src/guardrails/index.js";

describe("Guardrails Pipeline Integration", () => {
  describe("applyInputGuardrails", () => {
    it("should block dangerous bash commands like rm -rf /", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "rm -rf /",
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
      expect(result.reason).toContain("Blocked dangerous command");
    });

    it("should block rm -rf / with flags", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "sudo rm -rf / --no-preserve-root",
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
    });

    it("should block fork bombs", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: ":(){ :|:& };:",
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
    });

    it("should block dd writes", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "dd if=/dev/zero of=/dev/sda bs=1M",
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
    });

    it("should block mkfs commands", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "mkfs.ext4 /dev/sda1",
      });

      expect(result.passed).toBe(false);
      expect(result.severity).toBe("block");
    });

    it("should warn on DROP TABLE", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: 'mysql -e "DROP TABLE users"',
      });

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.reason).toContain("SQL DROP TABLE");
    });

    it("should warn on chmod 777", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "chmod 777 /var/www",
      });

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
    });

    it("should pass safe commands", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "ls -la /tmp",
      });

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("should pass non-bash tools without filtering", () => {
      const result = applyInputGuardrails("file_read", {
        path: "/etc/passwd",
      });

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("should handle bash_exec with non-string command", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: 42,
      });

      // Non-string command should pass (no string to check)
      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
    });

    it("should allow rm -rf on specific directories", () => {
      const result = applyInputGuardrails("bash_exec", {
        command: "rm -rf /tmp/build-output",
      });

      // This should pass — rm -rf on a specific subdirectory is OK
      expect(result.passed).toBe(true);
    });
  });

  describe("applyOutputGuardrails", () => {
    it("should redact OpenAI API keys in output", () => {
      const output = "Config loaded: OPENAI_KEY=sk-abc123xyz456789012345678901234567890";
      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.modified).toBeDefined();
      expect(result.modified).toContain("[REDACTED]");
      expect(result.modified).not.toContain("sk-abc123xyz");
    });

    it("should redact AWS access keys", () => {
      const output = "AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE";
      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.modified).toBeDefined();
      expect(result.modified).toContain("[REDACTED]");
      expect(result.modified).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    it("should redact GitHub tokens", () => {
      const output = "Using token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.modified).toBeDefined();
      expect(result.modified).toContain("[REDACTED]");
    });

    it("should redact Bearer tokens", () => {
      const output = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature";
      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.modified).toBeDefined();
      expect(result.modified).toContain("[REDACTED]");
    });

    it("should redact passwords", () => {
      const output = 'database config: password=supersecret123';
      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.modified).toBeDefined();
      expect(result.modified).toContain("[REDACTED]");
    });

    it("should pass output with no secrets", () => {
      const output = "Hello world! This is normal output with no secrets.";
      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
      expect(result.modified).toBeUndefined();
    });

    it("should redact multiple secrets in one output", () => {
      const output = [
        "Config loaded:",
        "AWS_KEY=AKIAIOSFODNN7EXAMPLE",
        "OPENAI_KEY=sk-testkey1234567890123456",
        "password=mysecretpassword",
      ].join("\n");

      const result = applyOutputGuardrails(output);

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("warn");
      expect(result.modified).toBeDefined();
      // All secrets should be redacted
      expect(result.modified).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(result.modified).not.toContain("sk-testkey1234567890123456");
      // [REDACTED] should appear multiple times
      const redactedCount = (result.modified!.match(/\[REDACTED\]/g) ?? []).length;
      expect(redactedCount).toBeGreaterThanOrEqual(2);
    });

    it("should handle empty output", () => {
      const result = applyOutputGuardrails("");

      expect(result.passed).toBe(true);
      expect(result.severity).toBe("info");
      expect(result.modified).toBeUndefined();
    });
  });

  describe("Combined input + output pipeline", () => {
    it("should allow safe command and clean output", () => {
      const inputResult = applyInputGuardrails("bash_exec", {
        command: "echo 'hello'",
      });
      expect(inputResult.passed).toBe(true);

      const outputResult = applyOutputGuardrails("hello");
      expect(outputResult.passed).toBe(true);
      expect(outputResult.modified).toBeUndefined();
    });

    it("should allow safe command but redact secrets in output", () => {
      const inputResult = applyInputGuardrails("bash_exec", {
        command: "cat .env",
      });
      expect(inputResult.passed).toBe(true);

      const outputResult = applyOutputGuardrails(
        "DATABASE_URL=postgres://user:pass@host\nAPI_KEY=sk-realkey12345678901234",
      );
      expect(outputResult.passed).toBe(true);
      expect(outputResult.modified).toBeDefined();
      expect(outputResult.modified).toContain("[REDACTED]");
    });

    it("should block dangerous command before execution", () => {
      const inputResult = applyInputGuardrails("bash_exec", {
        command: "rm -rf /",
      });
      expect(inputResult.passed).toBe(false);
      expect(inputResult.severity).toBe("block");
      // No need to check output — execution should be prevented
    });
  });
});
