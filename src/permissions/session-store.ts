/**
 * Session-scoped approval cache.
 * Remembers "always allow" decisions for the duration of the session.
 */
export class SessionApprovalStore {
  private readonly approved = new Set<string>();

  /** Build a cache key from tool name and optional args */
  private buildKey(toolName: string, args?: Readonly<Record<string, unknown>>): string {
    if (args && "path" in args && typeof args.path === "string") {
      return `${toolName}:${args.path}`;
    }
    return toolName;
  }

  /** Check if a tool call has been pre-approved this session */
  isApproved(toolName: string, args?: Readonly<Record<string, unknown>>): boolean {
    // Check exact match
    if (this.approved.has(this.buildKey(toolName, args))) {
      return true;
    }
    // Check tool-level approval (no specific args)
    return this.approved.has(toolName);
  }

  /** Approve a tool (optionally with specific args) for this session */
  approve(toolName: string, args?: Readonly<Record<string, unknown>>): void {
    this.approved.add(this.buildKey(toolName, args));
  }

  /** Approve all future calls to a specific tool */
  approveAll(toolName: string): void {
    this.approved.add(toolName);
  }

  /** Clear all approvals */
  clear(): void {
    this.approved.clear();
  }

  /** Get the count of approvals */
  get size(): number {
    return this.approved.size;
  }
}
