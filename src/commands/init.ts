import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { APP_NAME } from "../constants.js";

/** Project initialization directory name */
const PROJECT_DIR = `.${APP_NAME}`;

/** Default DBCODE.md template */
const DBCODE_TEMPLATE = `# ${APP_NAME.toUpperCase()}.md — Project Instructions

Add project-specific instructions here.
${APP_NAME} reads this file at the start of every session.

## Example

\`\`\`
- Runtime: Node.js 20+
- Test: vitest
- Lint: eslint + prettier
\`\`\`
`;

/** Default settings */
const DEFAULT_SETTINGS = {
  model: "gpt-4o",
  allowedTools: [
    "file_read",
    "file_write",
    "file_edit",
    "bash_exec",
    "glob_search",
    "grep_search",
  ],
};

/** Result of project initialization */
export interface InitResult {
  readonly created: boolean;
  readonly path: string;
}

/**
 * Initialize a dbcode project in the given directory.
 * Creates .dbcode/ with DBCODE.md template and settings.json.
 */
export async function initProject(cwd: string): Promise<InitResult> {
  const projectPath = join(cwd, PROJECT_DIR);

  // Check if already initialized
  try {
    await access(projectPath);
    return { created: false, path: projectPath };
  } catch {
    // Directory doesn't exist — proceed
  }

  await mkdir(projectPath, { recursive: true });
  await writeFile(join(projectPath, `${APP_NAME.toUpperCase()}.md`), DBCODE_TEMPLATE, "utf-8");
  await writeFile(
    join(projectPath, "settings.json"),
    JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n",
    "utf-8",
  );

  return { created: true, path: projectPath };
}
