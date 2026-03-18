import { Config } from "./file-a.js";
import { formatConfig } from "./file-b.js";

// Type error: missing required property 'debug'
export function createConfig(host: string, port: number): Config {
  const config: Config = { host, port };
  return formatConfig(config);
}
