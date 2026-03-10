import { z } from "zod";

/** Zod schema for validating network policy configuration */
export const networkPolicySchema = z.object({
  defaultAction: z.enum(["allow", "deny"]).default("allow"),
  allowlist: z.array(z.string()).default([]),
  denylist: z.array(z.string()).default([]),
});

/** Inferred type from the schema (matches NetworkPolicy interface) */
export type NetworkPolicyConfig = z.infer<typeof networkPolicySchema>;
