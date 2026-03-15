/**
 * Result of a single agent loop iteration for circuit breaker tracking.
 */
export interface IterationResult {
  readonly filesModified: ReadonlySet<string>;
  readonly error?: string;
  readonly hasOutput: boolean;
}

/** Circuit breaker state */
export type CircuitState = "closed" | "open";

/** Status snapshot of the circuit breaker */
export interface CircuitBreakerStatus {
  readonly state: CircuitState;
  readonly reason?: string;
  readonly iterationCount: number;
  readonly consecutiveNoChangeCount: number;
  readonly consecutiveSameErrorCount: number;
}

/** Thresholds for circuit breaker triggers */
const NO_CHANGE_THRESHOLD = 3;
const SAME_ERROR_THRESHOLD = 5;
const DEFAULT_MAX_ITERATIONS = 50;

/**
 * Ralph Loop pattern — prevents infinite agent loops.
 *
 * Opens circuit (stops iteration) when:
 * - 3 consecutive iterations with no file changes and no output
 * - 5 consecutive iterations producing the same error
 * - Exceeding maxIterations hard limit
 *
 * The circuit breaker is "closed" (allowing iterations) by default
 * and "opens" (blocking iterations) when a condition is triggered.
 */
export class CircuitBreaker {
  private readonly maxIterations: number;
  private iterationCount = 0;
  private consecutiveNoChangeCount = 0;
  private consecutiveSameErrorCount = 0;
  private lastError: string | undefined = undefined;
  private currentState: CircuitState = "closed";
  private openReason: string | undefined = undefined;

  constructor(maxIterations?: number) {
    this.maxIterations = maxIterations ?? DEFAULT_MAX_ITERATIONS;
  }

  /**
   * Record the result of an iteration and update circuit state.
   */
  recordIteration(result: IterationResult): void {
    // Don't record after circuit is already open
    if (this.currentState === "open") return;

    this.iterationCount++;

    // Track consecutive no-change iterations
    if (result.filesModified.size === 0 && !result.hasOutput) {
      this.consecutiveNoChangeCount++;
    } else {
      this.consecutiveNoChangeCount = 0;
    }

    // Track consecutive same-error iterations
    if (result.error) {
      if (result.error === this.lastError) {
        this.consecutiveSameErrorCount++;
      } else {
        this.consecutiveSameErrorCount = 1;
        this.lastError = result.error;
      }
    } else {
      this.consecutiveSameErrorCount = 0;
      this.lastError = undefined;
    }

    // Check triggers
    if (this.iterationCount >= this.maxIterations) {
      this.currentState = "open";
      this.openReason = `Exceeded maximum iteration limit (${this.maxIterations})`;
    } else if (this.consecutiveNoChangeCount >= NO_CHANGE_THRESHOLD) {
      this.currentState = "open";
      this.openReason = `${NO_CHANGE_THRESHOLD} consecutive iterations with no file changes or output`;
    } else if (this.consecutiveSameErrorCount >= SAME_ERROR_THRESHOLD) {
      this.currentState = "open";
      this.openReason = `${SAME_ERROR_THRESHOLD} consecutive iterations with the same error: "${this.lastError}"`;
    }
  }

  /**
   * Check whether the agent loop should continue.
   * Returns true if the circuit is closed (safe to continue).
   * Returns false if the circuit is open (must stop).
   */
  shouldContinue(): boolean {
    return this.currentState === "closed";
  }

  /**
   * Get a snapshot of the current circuit breaker status.
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.currentState,
      reason: this.openReason,
      iterationCount: this.iterationCount,
      consecutiveNoChangeCount: this.consecutiveNoChangeCount,
      consecutiveSameErrorCount: this.consecutiveSameErrorCount,
    };
  }

  /**
   * Reset the circuit breaker to its initial state.
   * Used when starting a new agent loop or after manual recovery.
   */
  reset(): void {
    this.iterationCount = 0;
    this.consecutiveNoChangeCount = 0;
    this.consecutiveSameErrorCount = 0;
    this.lastError = undefined;
    this.currentState = "closed";
    this.openReason = undefined;
  }
}
