export interface RequestBody {
  items: string[];
  count: number;
}

// 1) function parameter
export function processItems(data: RequestBody): string[] {
  const filtered = data.items.filter((item) => item.length > 0);
  return filtered;
}

// 2) function parameter
export function formatOutput(data: string[]): string {
  return data.join(", ");
}

// 3) local variable via assignment
export function createDefault(): RequestBody {
  const data: RequestBody = { items: [], count: 0 };
  return data;
}

// 4) function parameter with spread
export function merge(
  data: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return { ...data, ...extra };
}

// 5) function parameter with type guard
export function validate(data: unknown): boolean {
  return data !== null && data !== undefined;
}
