const DEFAULT_MAX_CHARS = 50000;

export interface OutputLimitResult {
  readonly limited: boolean;
  readonly result: string;
}

export function limitOutput(output: string, maxChars: number = DEFAULT_MAX_CHARS): OutputLimitResult {
  if (output.length <= maxChars) {
    return { limited: false, result: output };
  }

  const headSize = Math.floor(maxChars * 0.6);
  const tailSize = Math.floor(maxChars * 0.4);
  const omitted = output.length - headSize - tailSize;

  const head = output.slice(0, headSize);
  const tail = output.slice(output.length - tailSize);

  return {
    limited: true,
    result: `${head}\n\n... [${omitted} characters omitted] ...\n\n${tail}`,
  };
}
