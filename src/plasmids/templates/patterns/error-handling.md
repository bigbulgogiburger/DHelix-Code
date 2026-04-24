---
id: ${id}
name: ${name}
description: ${description}
version: ${version}
tier: L2
scope: ${scope}
privacy: ${privacy}
locale: ${locale}
created: ${created}
updated: ${updated}
template: error-handling
---

# ${name}

Composite error-handling policy for async TypeScript code paths.

## Rules

1. **Never swallow errors silently.**
   - An empty `catch {}` is forbidden.
   - Re-throw, return a typed `Result`, or log and continue with a `logger.warn`.
2. **Type the rejection path.**
   - Prefer `Result<T, E>` or a discriminated union over `throw new Error` when
     the caller is expected to branch on the failure.
   - When throwing, throw a class extending a module-level base error.
3. **Respect `AbortSignal`.**
   - Every network or long-running operation must accept and propagate an
     `AbortSignal`. A cancellation is not a failure — surface it as a distinct
     `AbortError` without logging as error.
4. **Attach context.**
   - Errors include the operation name, resource id, and correlation id (if
     present). Stack traces are preserved via `{ cause: err }`.
5. **Retries** — only on idempotent operations. Exponential backoff with jitter;
   cap total wall-clock; document the retry budget in the caller's doc comment.

## Example

```ts
export async function loadPlasmid(
  id: PlasmidId,
  signal?: AbortSignal,
): Promise<Result<LoadedPlasmid, PlasmidError>> {
  try {
    const raw = await readFile(idToPath(id), { signal });
    return ok(parse(raw));
  } catch (err) {
    if (isAbortError(err)) throw err; // propagate cancel
    return err instanceof PlasmidError
      ? fail(err)
      : fail(new PlasmidError("LOAD_FAILED", String(id), { cause: err }));
  }
}
```

## Eval cases

- id: swallow-forbidden
  description: empty catch block must be flagged.
  input: "try { await f(); } catch {}"
  expectations:
    - not-contains:catch {}

- id: signal-propagated
  description: signal is passed down to the IO call.
  input: "await fetch(url, { signal });"
  expectations:
    - contains:signal
