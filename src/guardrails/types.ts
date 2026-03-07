export interface GuardrailResult {
  readonly passed: boolean;
  readonly modified?: string;
  readonly reason?: string;
  readonly severity: "block" | "warn" | "info";
}

export interface GuardrailRule {
  readonly name: string;
  readonly description: string;
  readonly severity: "block" | "warn" | "info";
  readonly test: (input: string) => boolean;
}
