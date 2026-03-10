import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { APP_NAME } from "../constants.js";
import { joinPath } from "../utils/path.js";

/** Base directory for all project memory storage */
const PROJECTS_BASE_DIR = joinPath(homedir(), `.${APP_NAME}`, "projects");

/** Main memory file name */
const MEMORY_FILE = "MEMORY.md";

/**
 * Compute a stable project hash from the absolute project root path.
 * Uses SHA-256, taking the first 16 hex characters.
 */
export function computeProjectHash(projectRoot: string): string {
  const absolutePath = resolve(projectRoot);
  const hash = createHash("sha256").update(absolutePath).digest("hex");
  return hash.slice(0, 16);
}

/**
 * Get the memory directory for a given project root.
 * Path: ~/.dbcode/projects/{projectHash}/memory/
 */
export function getMemoryDir(projectRoot: string): string {
  const projectHash = computeProjectHash(projectRoot);
  return joinPath(PROJECTS_BASE_DIR, projectHash, "memory");
}

/**
 * Get the full path to the main MEMORY.md file for a project.
 */
export function getMemoryFilePath(projectRoot: string): string {
  return joinPath(getMemoryDir(projectRoot), MEMORY_FILE);
}

/**
 * Get the full path to a topic memory file.
 */
export function getTopicFilePath(projectRoot: string, topicFileName: string): string {
  return joinPath(getMemoryDir(projectRoot), topicFileName);
}

/**
 * Get the base projects directory path.
 */
export function getProjectsBaseDir(): string {
  return PROJECTS_BASE_DIR;
}
