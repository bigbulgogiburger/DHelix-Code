/**
 * Unit tests for the tolerant XML fallback parser.
 */
import { describe, expect, it } from "vitest";

import {
  XmlFallbackParseError,
  parseXmlFallback,
  toInterpretedPayload,
} from "../../../../src/recombination/interpreter/xml-fallback.js";

describe("parseXmlFallback", () => {
  it("parses a well-formed payload", () => {
    const xml = `
      <plasmid>
        <summary>Guard commits against secret leaks.</summary>
        <intent kind="hook">
          <title>Block on secret entropy</title>
          <description>Fail the commit when entropy exceeds threshold.</description>
          <constraints>
            <item>Severity must be at least MEDIUM</item>
          </constraints>
          <evidence>
            <item>OWASP A02 leakage</item>
          </evidence>
        </intent>
      </plasmid>`;
    const result = parseXmlFallback(xml);
    expect(result.summary).toContain("secret leaks");
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.kind).toBe("hook");
    expect(result.intents[0]?.constraints).toEqual(["Severity must be at least MEDIUM"]);
  });

  it("strips ```xml code fences", () => {
    const xml = "```xml\n<plasmid><summary>ok</summary></plasmid>\n```";
    const result = parseXmlFallback(xml);
    expect(result.summary).toBe("ok");
  });

  it("defaults unknown intent kinds to 'agent'", () => {
    const xml = `
      <plasmid>
        <intent kind="not-a-kind">
          <title>t</title>
          <description>d</description>
        </intent>
      </plasmid>`;
    const result = parseXmlFallback(xml);
    expect(result.intents[0]?.kind).toBe("agent");
  });

  it("decodes the five canonical entities", () => {
    const xml = `
      <plasmid>
        <summary>a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;</summary>
      </plasmid>`;
    const result = parseXmlFallback(xml);
    expect(result.summary).toBe("a & b < c > d \"e\" 'f'");
  });

  it("skips intents that lack title or description", () => {
    const xml = `
      <plasmid>
        <summary>s</summary>
        <intent kind="hook"><description>only-desc</description></intent>
        <intent kind="rule"><title>only-title</title></intent>
      </plasmid>`;
    const result = parseXmlFallback(xml);
    expect(result.intents).toHaveLength(0);
  });

  it("throws XmlFallbackParseError when no root element is present", () => {
    expect(() => parseXmlFallback("no xml here")).toThrow(XmlFallbackParseError);
  });

  it("throws on an empty payload", () => {
    expect(() => parseXmlFallback("   ")).toThrow(XmlFallbackParseError);
  });

  it("throws when neither summary nor intents are parseable", () => {
    expect(() => parseXmlFallback("<plasmid></plasmid>")).toThrow(XmlFallbackParseError);
  });

  it("tolerates unterminated <intent> by consuming to end-of-document", () => {
    const xml = `
      <plasmid>
        <summary>s</summary>
        <intent kind="hook">
          <title>t</title>
          <description>d</description>
    `;
    const result = parseXmlFallback(xml);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0]?.title).toBe("t");
  });

  it("toInterpretedPayload adapts to the schema envelope", () => {
    const payload = toInterpretedPayload({
      summary: "s",
      intents: [
        {
          kind: "rule",
          title: "t",
          description: "d",
          constraints: [],
          evidence: [],
          params: {},
        },
      ],
    });
    expect(payload.intents).toHaveLength(1);
    expect(payload.summary).toBe("s");
  });
});
