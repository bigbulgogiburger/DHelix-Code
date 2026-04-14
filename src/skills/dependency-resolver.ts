/**
 * Skill Dependency Resolver — topological sort for skill loading order
 *
 * Builds a dependency graph from skill manifests and returns skills
 * in topological order (dependencies first) using Kahn's algorithm.
 * Detects circular dependencies and throws a descriptive error.
 */

import { BaseError } from "../utils/error.js";

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * Thrown when a circular dependency is detected in the skill dependency graph.
 */
export class CircularDependencyError extends BaseError {
  constructor(cycle: readonly string[]) {
    super(
      `Circular dependency detected among skills: ${cycle.join(" → ")}`,
      "CIRCULAR_DEPENDENCY",
      { cycle: [...cycle] },
    );
  }
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolves skill loading order using topological sort (Kahn's algorithm).
 *
 * @param skills - Map of skill name → dependency names
 * @returns Ordered array of skill names (dependencies first)
 * @throws CircularDependencyError if a cycle is detected
 */
export function resolveSkillDependencies(
  skills: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  if (skills.size === 0) {
    return [];
  }

  // Build adjacency list and in-degree map (immutable source → mutable working copies)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  // Initialize all nodes
  for (const name of skills.keys()) {
    inDegree.set(name, 0);
    dependents.set(name, []);
  }

  // Build edges: dependency → dependent
  for (const [name, deps] of skills) {
    for (const dep of deps) {
      // Only consider dependencies that are in the skills map
      if (skills.has(dep)) {
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
        const list = dependents.get(dep);
        if (list) {
          list.push(name);
        }
      }
    }
  }

  // Kahn's algorithm — collect nodes with zero in-degree
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    // Sort queue for deterministic output
    queue.sort();
    const current = queue.shift()!;
    sorted.push(current);

    for (const dependent of dependents.get(current) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // If not all nodes were visited, there is a cycle
  if (sorted.length !== skills.size) {
    const remaining = [...skills.keys()].filter((n) => !sorted.includes(n));
    throw new CircularDependencyError(remaining);
  }

  return sorted;
}
