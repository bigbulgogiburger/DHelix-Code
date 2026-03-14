export interface RecoveryStrategy {
  readonly errorPattern: RegExp;
  readonly action: "retry" | "compact" | "fallback-strategy";
  readonly maxRetries: number;
  readonly backoffMs?: number;
  readonly description: string;
}

export const RECOVERY_STRATEGIES: readonly RecoveryStrategy[] = [
  {
    errorPattern: /request too large|context.*exceed|token.*limit/i,
    action: "compact",
    maxRetries: 1,
    description: "Context overflow — auto-compact and retry",
  },
  {
    errorPattern: /ETIMEDOUT|timeout|timed out/i,
    action: "retry",
    maxRetries: 2,
    backoffMs: 2000,
    description: "Timeout — retry with backoff",
  },
  {
    errorPattern: /parse.*error|invalid.*json|unexpected token/i,
    action: "fallback-strategy",
    maxRetries: 1,
    description: "Parse error — fallback to text parsing",
  },
  {
    errorPattern: /ELOCK|lock.*exist|locked/i,
    action: "retry",
    maxRetries: 3,
    backoffMs: 1000,
    description: "File lock — wait and retry",
  },
];

export function findRecoveryStrategy(error: Error): RecoveryStrategy | undefined {
  return RECOVERY_STRATEGIES.find((s) => s.errorPattern.test(error.message));
}
