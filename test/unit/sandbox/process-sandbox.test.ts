import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { homedir } from "node:os";
import {
  createProcessSandbox,
  createDefaultFilesystemPolicy,
  type ProcessSandboxConfig,
} from "../../../src/sandbox/process-sandbox.js";

describe("process-sandbox", () => {
  const projectDir = "/tmp/test-project";
  const home = homedir();

  describe("createProcessSandbox", () => {
    it("정제된 환경변수를 반환해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      expect(sandbox.env).toBeDefined();
      expect(typeof sandbox.env).toBe("object");
      // 민감한 변수가 제거되어야 한다
      expect(sandbox.env["ANTHROPIC_API_KEY"]).toBeUndefined();
      expect(sandbox.env["OPENAI_API_KEY"]).toBeUndefined();
    });

    it("기본 maxOutputSize는 10MB여야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      expect(sandbox.maxOutputSize).toBe(10 * 1024 * 1024);
    });

    it("커스텀 maxOutputSize를 설정할 수 있어야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
        maxOutputSize: 5 * 1024 * 1024,
      });

      expect(sandbox.maxOutputSize).toBe(5 * 1024 * 1024);
    });

    it("timeout 값을 올바르게 전달해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 60_000,
      });

      expect(sandbox.timeout).toBe(60_000);
    });

    it("envConfig를 전달하면 해당 설정으로 환경변수를 정제해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
        envConfig: {
          allowedEnvVars: new Set(["HOME", "PATH"]),
        },
      });

      expect(sandbox.env["HOME"]).toBeDefined();
      expect(sandbox.env["PATH"]).toBeDefined();
      // allowedEnvVars에 없는 변수는 제거
      expect(sandbox.env["SHELL"]).toBeUndefined();
    });
  });

  describe("validatePath — 기본 정책", () => {
    it("프로젝트 디렉토리 내 경로를 허용해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(resolve(projectDir, "src/index.ts"));
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain("Project working directory");
    });

    it("프로젝트 디렉토리 자체를 허용해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(projectDir);
      expect(result.allowed).toBe(true);
    });

    it("~/.ssh/ 경로를 차단해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(resolve(home, ".ssh/id_rsa"));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("SSH keys");
    });

    it("~/.aws/ 경로를 차단해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(resolve(home, ".aws/credentials"));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("AWS credentials");
    });

    it("~/.gnupg/ 경로를 차단해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(resolve(home, ".gnupg/secring.gpg"));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("GPG keys");
    });

    it("~/.dhelix/ 경로를 허용해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(resolve(home, ".dhelix/settings.json"));
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain("Dhelix configuration");
    });

    it("~/.config/gcloud/ 경로를 차단해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath(resolve(home, ".config/gcloud/credentials.json"));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Google Cloud");
    });

    it("허용/차단 목록에 없는 경로는 차단해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath("/some/random/path");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not in any allowed rule");
    });
  });

  describe("validatePath — 상대 경로", () => {
    it("상대 경로를 workingDir 기준으로 해석해야 한다", () => {
      const sandbox = createProcessSandbox({
        workingDir: projectDir,
        timeout: 120_000,
      });

      const result = sandbox.validatePath("src/index.ts");
      expect(result.allowed).toBe(true);
    });
  });

  describe("validatePath — 커스텀 정책", () => {
    it("커스텀 filesystemPolicy를 사용할 수 있어야 한다", () => {
      const config: ProcessSandboxConfig = {
        workingDir: projectDir,
        timeout: 120_000,
        filesystemPolicy: {
          allowedPaths: [
            { pattern: "/custom/allowed", recursive: true, reason: "Custom allowed" },
          ],
          deniedPaths: [
            { pattern: "/custom/denied", recursive: true, reason: "Custom denied" },
          ],
        },
      };

      const sandbox = createProcessSandbox(config);

      expect(sandbox.validatePath("/custom/allowed/file.txt").allowed).toBe(true);
      expect(sandbox.validatePath("/custom/denied/secret.txt").allowed).toBe(false);
      // 프로젝트 디렉토리는 커스텀 정책에 포함되지 않으므로 차단
      expect(sandbox.validatePath(resolve(projectDir, "src/index.ts")).allowed).toBe(false);
    });

    it("deniedPaths가 allowedPaths보다 우선해야 한다", () => {
      const config: ProcessSandboxConfig = {
        workingDir: projectDir,
        timeout: 120_000,
        filesystemPolicy: {
          allowedPaths: [
            { pattern: "/shared", recursive: true, reason: "Shared directory" },
          ],
          deniedPaths: [
            { pattern: "/shared/secret", recursive: true, reason: "Secret subdirectory" },
          ],
        },
      };

      const sandbox = createProcessSandbox(config);

      expect(sandbox.validatePath("/shared/readme.md").allowed).toBe(true);
      expect(sandbox.validatePath("/shared/secret/key.pem").allowed).toBe(false);
    });

    it("allowedPaths가 비어있으면 차단 목록에 해당하지 않는 경로를 허용해야 한다", () => {
      const config: ProcessSandboxConfig = {
        workingDir: projectDir,
        timeout: 120_000,
        filesystemPolicy: {
          allowedPaths: [],
          deniedPaths: [
            { pattern: "/blocked", recursive: true, reason: "Blocked" },
          ],
        },
      };

      const sandbox = createProcessSandbox(config);

      expect(sandbox.validatePath("/anything/goes").allowed).toBe(true);
      expect(sandbox.validatePath("/blocked/file.txt").allowed).toBe(false);
    });
  });

  describe("createDefaultFilesystemPolicy", () => {
    it("기본 정책에 프로젝트 디렉토리가 허용 목록에 포함되어야 한다", () => {
      const policy = createDefaultFilesystemPolicy(projectDir);

      const projectRule = policy.allowedPaths.find((r) =>
        r.pattern === resolve(projectDir),
      );
      expect(projectRule).toBeDefined();
      expect(projectRule?.recursive).toBe(true);
    });

    it("기본 정책에 ~/.ssh가 차단 목록에 포함되어야 한다", () => {
      const policy = createDefaultFilesystemPolicy(projectDir);

      const sshRule = policy.deniedPaths.find((r) =>
        r.pattern === resolve(home, ".ssh"),
      );
      expect(sshRule).toBeDefined();
      expect(sshRule?.recursive).toBe(true);
    });

    it("기본 정책에 ~/.dhelix가 허용 목록에 포함되어야 한다", () => {
      const policy = createDefaultFilesystemPolicy(projectDir);

      const dhelixRule = policy.allowedPaths.find((r) =>
        r.pattern === resolve(home, ".dhelix"),
      );
      expect(dhelixRule).toBeDefined();
    });
  });
});
