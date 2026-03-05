import { type z } from "zod";
import { type configSchema } from "./schema.js";

/** Full configuration type inferred from Zod schema */
export type AppConfig = z.infer<typeof configSchema>;

/** Configuration source levels (highest priority first) */
export type ConfigSource = "cli-flags" | "environment" | "project" | "user" | "defaults";

/** Configuration with metadata about source */
export interface ResolvedConfig {
  readonly config: AppConfig;
  readonly sources: ReadonlyMap<string, ConfigSource>;
}
