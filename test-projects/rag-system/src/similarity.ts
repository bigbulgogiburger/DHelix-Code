export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must be of the same length');
  }
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
}

export function magnitude(v: number[]): number {
  return Math.sqrt(v.reduce((sum, vi) => sum + vi * vi, 0));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must be of the same length');
  }
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dotProduct(a, b) / (magA * magB);
}