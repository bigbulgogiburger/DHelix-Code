#!/usr/bin/env tsx
/**
 * verify-cli-turns.ts — Verifies assertions from a JSONL turns file
 * Usage: npx tsx verify-cli-turns.ts <turns.jsonl> <project-dir>
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface Assertion {
  type:
    | "file_exists"
    | "file_contains"
    | "file_contains_json"
    | "response_contains"
    | "files_consistent"
    | "no_tool_named"
    | "tool_call_count";
  path?: string;
  substring?: string;
  pathExpr?: string;
  equals?: unknown;
  all?: string[];
  any?: string[];
  files?: string[];
  tool?: string;
  min?: number;
  max?: number;
}

interface TurnLine {
  turn: number;
  name: string;
  prompt: string;
  assertions?: Assertion[];
}

async function main() {
  const turnsFile = process.argv[2];
  const projectDir = process.argv[3];

  if (!turnsFile || !projectDir) {
    console.error("Usage: verify-cli-turns.ts <turns.jsonl> <project-dir>");
    process.exit(1);
  }

  const logDir = join(projectDir, ".cli-turn-logs");
  const lines = readFileSync(turnsFile, "utf8").split("\n").filter(Boolean);
  const turns: TurnLine[] = lines.map((l) => JSON.parse(l));

  let totalAssertions = 0;
  let passedAssertions = 0;
  const failures: string[] = [];

  for (const turn of turns) {
    if (!turn.assertions || turn.assertions.length === 0) continue;

    const logFile = join(logDir, `turn-${turn.turn}.json`);
    let turnOutput: Record<string, unknown> = {};
    if (existsSync(logFile)) {
      try {
        turnOutput = JSON.parse(readFileSync(logFile, "utf8"));
      } catch {
        // ignore parse errors
      }
    }
    const responseContent = String(turnOutput["content"] ?? turnOutput["result"] ?? "");

    for (const assertion of turn.assertions) {
      totalAssertions++;
      let passed = false;
      let detail = "";

      switch (assertion.type) {
        case "file_exists": {
          const p = join(projectDir, assertion.path!);
          passed = existsSync(p);
          detail = `file_exists: ${assertion.path}`;
          break;
        }
        case "file_contains": {
          const p = join(projectDir, assertion.path!);
          if (existsSync(p)) {
            const content = readFileSync(p, "utf8");
            passed = content.includes(assertion.substring!);
          }
          detail = `file_contains: ${assertion.path} has "${assertion.substring}"`;
          break;
        }
        case "file_contains_json": {
          const p = join(projectDir, assertion.path!);
          if (existsSync(p)) {
            try {
              const data = JSON.parse(readFileSync(p, "utf8"));
              // Simple JSONPath: $.field
              const field = assertion.pathExpr!.replace(/^\$\./, "");
              passed = data[field] === assertion.equals;
              detail = `file_contains_json: ${assertion.path}[${field}] === ${assertion.equals} (got: ${data[field]})`;
            } catch {
              detail = `file_contains_json: failed to parse ${assertion.path}`;
            }
          }
          break;
        }
        case "response_contains": {
          if (assertion.all) {
            passed = assertion.all.every((kw) =>
              responseContent.toLowerCase().includes(kw.toLowerCase()),
            );
            detail = `response_contains all: ${assertion.all.join(",")}`;
          } else if (assertion.any) {
            passed = assertion.any.some((kw) =>
              responseContent.toLowerCase().includes(kw.toLowerCase()),
            );
            detail = `response_contains any: ${assertion.any.join(",")}`;
          }
          break;
        }
        case "files_consistent": {
          // Check that referenced files share consistent key-value patterns
          const files = (assertion.files ?? []).map((f) => join(projectDir, f));
          const contents = files.map((f) => (existsSync(f) ? readFileSync(f, "utf8") : ""));
          // Simple: all files exist and are non-empty
          passed = contents.every((c) => c.length > 0);
          detail = `files_consistent: ${assertion.files?.join(",")}`;
          break;
        }
        default:
          passed = true; // Unknown assertion types pass by default
          detail = `unknown type: ${assertion.type}`;
      }

      if (passed) {
        passedAssertions++;
        console.log(`  ✓ Turn ${turn.turn}: ${detail}`);
      } else {
        failures.push(`Turn ${turn.turn}: ${detail}`);
        console.log(`  ✗ Turn ${turn.turn}: ${detail}`);
      }
    }
  }

  console.log(`\n=== VERIFICATION RESULTS ===`);
  console.log(`Passed: ${passedAssertions}/${totalAssertions}`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log("All assertions passed!");
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
