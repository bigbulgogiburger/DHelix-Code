import { describe, it, expect } from "vitest";
import {
  sanitizeEnv,
  getSandboxEnvMode,
  DEFAULT_DENIED_VARS,
  DEFAULT_ALLOWED_VARS,
  type EnvSanitizeConfig,
} from "../../../src/sandbox/env-sanitizer.js";

describe("env-sanitizer", () => {
  /** 테스트용 환경변수 — 안전한 변수와 민감한 변수를 모두 포함 */
  const testEnv: Record<string, string> = {
    HOME: "/home/testuser",
    USER: "testuser",
    PATH: "/usr/bin:/usr/local/bin",
    SHELL: "/bin/bash",
    LANG: "en_US.UTF-8",
    NODE_ENV: "development",
    // 민감한 변수
    ANTHROPIC_API_KEY: "sk-ant-secret",
    OPENAI_API_KEY: "sk-openai-secret",
    AWS_ACCESS_KEY_ID: "AKIA...",
    AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI...",
    SSH_AUTH_SOCK: "/tmp/ssh-agent.sock",
    GITHUB_TOKEN: "ghp_xxx",
    DATABASE_URL: "postgres://...",
    // 비밀 패턴에 해당하는 커스텀 변수
    MY_CUSTOM_SECRET: "very-secret",
    MY_API_KEY: "some-key",
    SERVICE_TOKEN: "tok-123",
    PAYMENT_PASSWORD: "pay-pass",
    // 일반 사용자 변수
    EDITOR: "vim",
    CUSTOM_VAR: "custom-value",
  };

  describe("sanitizeEnv — permissive 모드 (기본)", () => {
    it("DEFAULT_DENIED_VARS에 포함된 변수를 제거해야 한다", () => {
      const result = sanitizeEnv(testEnv);

      expect(result["ANTHROPIC_API_KEY"]).toBeUndefined();
      expect(result["OPENAI_API_KEY"]).toBeUndefined();
      expect(result["AWS_ACCESS_KEY_ID"]).toBeUndefined();
      expect(result["AWS_SECRET_ACCESS_KEY"]).toBeUndefined();
      expect(result["SSH_AUTH_SOCK"]).toBeUndefined();
      expect(result["GITHUB_TOKEN"]).toBeUndefined();
      expect(result["DATABASE_URL"]).toBeUndefined();
    });

    it("비밀 패턴(*_KEY, *_SECRET, *_TOKEN, *_PASSWORD)에 해당하는 변수를 제거해야 한다", () => {
      const result = sanitizeEnv(testEnv);

      expect(result["MY_CUSTOM_SECRET"]).toBeUndefined();
      expect(result["MY_API_KEY"]).toBeUndefined();
      expect(result["SERVICE_TOKEN"]).toBeUndefined();
      expect(result["PAYMENT_PASSWORD"]).toBeUndefined();
    });

    it("안전한 환경변수는 유지해야 한다", () => {
      const result = sanitizeEnv(testEnv);

      expect(result["HOME"]).toBe("/home/testuser");
      expect(result["USER"]).toBe("testuser");
      expect(result["PATH"]).toBe("/usr/bin:/usr/local/bin");
      expect(result["SHELL"]).toBe("/bin/bash");
      expect(result["NODE_ENV"]).toBe("development");
      expect(result["EDITOR"]).toBe("vim");
      expect(result["CUSTOM_VAR"]).toBe("custom-value");
    });

    it("stripSecrets=false이면 비밀 패턴 제거를 비활성화해야 한다", () => {
      const result = sanitizeEnv(testEnv, { stripSecrets: false });

      // 비밀 패턴은 건너뛰지만 DEFAULT_DENIED_VARS는 여전히 제거
      expect(result["MY_CUSTOM_SECRET"]).toBe("very-secret");
      expect(result["MY_API_KEY"]).toBe("some-key");
      // DEFAULT_DENIED_VARS에 있는 것은 여전히 제거
      expect(result["ANTHROPIC_API_KEY"]).toBeUndefined();
      expect(result["SSH_AUTH_SOCK"]).toBeUndefined();
    });

    it("커스텀 deniedEnvVars를 사용할 수 있어야 한다", () => {
      const config: EnvSanitizeConfig = {
        deniedEnvVars: new Set(["CUSTOM_VAR", "EDITOR"]),
        stripSecrets: false,
      };
      const result = sanitizeEnv(testEnv, config);

      expect(result["CUSTOM_VAR"]).toBeUndefined();
      expect(result["EDITOR"]).toBeUndefined();
      // 커스텀 denied를 사용하면 DEFAULT_DENIED_VARS는 적용되지 않음
      expect(result["HOME"]).toBe("/home/testuser");
    });
  });

  describe("sanitizeEnv — whitelist (allowedEnvVars) 모드", () => {
    it("allowedEnvVars에 명시된 변수만 포함해야 한다", () => {
      const config: EnvSanitizeConfig = {
        allowedEnvVars: new Set(["HOME", "USER", "PATH"]),
      };
      const result = sanitizeEnv(testEnv, config);

      expect(Object.keys(result)).toEqual(expect.arrayContaining(["HOME", "USER", "PATH"]));
      expect(result["SHELL"]).toBeUndefined();
      expect(result["EDITOR"]).toBeUndefined();
      expect(result["ANTHROPIC_API_KEY"]).toBeUndefined();
    });

    it("allowedEnvVars가 빈 Set이면 blacklist 모드로 폴백해야 한다", () => {
      const config: EnvSanitizeConfig = {
        allowedEnvVars: new Set(),
      };
      const result = sanitizeEnv(testEnv, config);

      // 빈 Set은 whitelist로 간주되지 않고 blacklist(permissive) 모드로 동작
      expect(result["HOME"]).toBe("/home/testuser");
      // 민감한 변수는 여전히 제거
      expect(result["ANTHROPIC_API_KEY"]).toBeUndefined();
    });
  });

  describe("PATH 처리", () => {
    it("기본적으로 PATH를 상속해야 한다", () => {
      const result = sanitizeEnv(testEnv);
      expect(result["PATH"]).toBe("/usr/bin:/usr/local/bin");
    });

    it("inheritPath=false이면 PATH를 제거해야 한다", () => {
      const result = sanitizeEnv(testEnv, { inheritPath: false });
      expect(result["PATH"]).toBeUndefined();
    });

    it("customPath가 설정되면 해당 값으로 PATH를 대체해야 한다", () => {
      const result = sanitizeEnv(testEnv, { customPath: "/custom/bin" });
      expect(result["PATH"]).toBe("/custom/bin");
    });

    it("allowedEnvVars에 PATH가 없어도 inheritPath=true(기본)이면 PATH를 추가해야 한다", () => {
      const config: EnvSanitizeConfig = {
        allowedEnvVars: new Set(["HOME"]),
      };
      const result = sanitizeEnv(testEnv, config);
      expect(result["PATH"]).toBe("/usr/bin:/usr/local/bin");
    });

    it("allowedEnvVars에 PATH가 없고 inheritPath=false이면 PATH를 추가하지 않아야 한다", () => {
      const config: EnvSanitizeConfig = {
        allowedEnvVars: new Set(["HOME"]),
        inheritPath: false,
      };
      const result = sanitizeEnv(testEnv, config);
      expect(result["PATH"]).toBeUndefined();
    });
  });

  describe("undefined 값 처리", () => {
    it("값이 undefined인 환경변수는 무시해야 한다", () => {
      const envWithUndefined: Record<string, string | undefined> = {
        HOME: "/home/test",
        MISSING: undefined,
      };
      const result = sanitizeEnv(envWithUndefined);
      expect(result["HOME"]).toBe("/home/test");
      expect("MISSING" in result).toBe(false);
    });
  });

  describe("getSandboxEnvMode", () => {
    it("기본값은 permissive여야 한다", () => {
      const original = process.env["DHELIX_SANDBOX_ENV"];
      delete process.env["DHELIX_SANDBOX_ENV"];
      expect(getSandboxEnvMode()).toBe("permissive");
      if (original !== undefined) {
        process.env["DHELIX_SANDBOX_ENV"] = original;
      }
    });

    it("유효하지 않은 값이면 permissive를 반환해야 한다", () => {
      const original = process.env["DHELIX_SANDBOX_ENV"];
      process.env["DHELIX_SANDBOX_ENV"] = "invalid";
      expect(getSandboxEnvMode()).toBe("permissive");
      if (original !== undefined) {
        process.env["DHELIX_SANDBOX_ENV"] = original;
      } else {
        delete process.env["DHELIX_SANDBOX_ENV"];
      }
    });
  });

  describe("DEFAULT_DENIED_VARS 상수", () => {
    it("주요 민감 변수를 포함해야 한다", () => {
      expect(DEFAULT_DENIED_VARS.has("ANTHROPIC_API_KEY")).toBe(true);
      expect(DEFAULT_DENIED_VARS.has("OPENAI_API_KEY")).toBe(true);
      expect(DEFAULT_DENIED_VARS.has("AWS_ACCESS_KEY_ID")).toBe(true);
      expect(DEFAULT_DENIED_VARS.has("SSH_AUTH_SOCK")).toBe(true);
      expect(DEFAULT_DENIED_VARS.has("GITHUB_TOKEN")).toBe(true);
    });
  });

  describe("DEFAULT_ALLOWED_VARS 상수", () => {
    it("기본 셸 환경변수를 포함해야 한다", () => {
      expect(DEFAULT_ALLOWED_VARS.has("HOME")).toBe(true);
      expect(DEFAULT_ALLOWED_VARS.has("PATH")).toBe(true);
      expect(DEFAULT_ALLOWED_VARS.has("USER")).toBe(true);
      expect(DEFAULT_ALLOWED_VARS.has("SHELL")).toBe(true);
      expect(DEFAULT_ALLOWED_VARS.has("NODE_ENV")).toBe(true);
    });
  });
});
