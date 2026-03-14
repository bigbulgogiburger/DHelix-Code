import { describe, it, expect } from "vitest";
import { detectTransportType } from "../../../src/mcp/managed-config.js";

describe("detectTransportType", () => {
  it("should detect stdio from command field", () => {
    expect(detectTransportType({ command: "node", args: ["server.js"] })).toBe("stdio");
  });

  it("should detect http from url field", () => {
    expect(detectTransportType({ url: "https://example.com/mcp" })).toBe("http");
  });

  it("should use explicit transport override", () => {
    expect(detectTransportType({ command: "node", transport: "http" })).toBe("http");
  });

  it("should prefer explicit transport over url inference", () => {
    expect(detectTransportType({ url: "https://example.com/mcp", transport: "sse" })).toBe("sse");
  });

  it("should default to stdio when no fields present", () => {
    expect(detectTransportType({})).toBe("stdio");
  });

  it("should detect http when only url is provided", () => {
    expect(detectTransportType({ url: "http://localhost:8080/mcp" })).toBe("http");
  });

  it("should detect stdio when only command is provided", () => {
    expect(detectTransportType({ command: "python" })).toBe("stdio");
  });

  it("should prefer url over command when both present and no explicit transport", () => {
    expect(detectTransportType({ command: "node", url: "http://localhost:3000" })).toBe("http");
  });
});
