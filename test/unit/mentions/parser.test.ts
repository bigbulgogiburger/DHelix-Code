import { describe, it, expect } from "vitest";
import { parseMentions, stripMentions } from "../../../src/mentions/parser.js";

describe("parseMentions", () => {
  it("should parse @file mentions", () => {
    const mentions = parseMentions("Look at @file:src/index.ts for details");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("file");
    expect(mentions[0].value).toBe("src/index.ts");
  });

  it("should parse implicit file mentions (with extension)", () => {
    const mentions = parseMentions("Check @src/utils/error.ts");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("file");
    expect(mentions[0].value).toBe("src/utils/error.ts");
  });

  it("should parse relative file paths", () => {
    const mentions = parseMentions("See @./relative/path.ts");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("file");
    expect(mentions[0].value).toBe("./relative/path.ts");
  });

  it("should parse @url mentions", () => {
    const mentions = parseMentions("Check @https://example.com/api/docs");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("url");
    expect(mentions[0].value).toBe("https://example.com/api/docs");
  });

  it("should parse explicit @url: prefix", () => {
    const mentions = parseMentions("See @url:https://docs.example.com");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("url");
    expect(mentions[0].value).toBe("https://docs.example.com");
  });

  it("should parse @mcp mentions", () => {
    const mentions = parseMentions("Show @postgres:sql://users/schema");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("mcp");
    expect(mentions[0].server).toBe("postgres");
    expect(mentions[0].value).toBe("sql://users/schema");
  });

  it("should parse multiple mentions in one text", () => {
    const text = "Compare @file:src/a.ts and @file:src/b.ts with @https://example.com";
    const mentions = parseMentions(text);
    expect(mentions).toHaveLength(3);
    expect(mentions[0].type).toBe("file");
    expect(mentions[1].type).toBe("file");
    expect(mentions[2].type).toBe("url");
  });

  it("should return empty array for text with no mentions", () => {
    const mentions = parseMentions("Just a regular message with no @ mentions");
    expect(mentions).toHaveLength(0);
  });

  it("should deduplicate identical mentions", () => {
    const mentions = parseMentions("@file:src/a.ts and again @file:src/a.ts");
    expect(mentions).toHaveLength(1);
  });

  it("should sort mentions by position", () => {
    const text = "@https://url.com and @file:src/z.ts";
    const mentions = parseMentions(text);
    expect(mentions[0].start).toBeLessThan(mentions[1].start);
  });
});

describe("stripMentions", () => {
  it("should strip @file: prefix", () => {
    const result = stripMentions("See @file:src/index.ts");
    expect(result).toBe("See src/index.ts");
  });

  it("should strip @url: prefix", () => {
    const result = stripMentions("Visit @url:https://example.com");
    expect(result).toBe("Visit https://example.com");
  });
});
