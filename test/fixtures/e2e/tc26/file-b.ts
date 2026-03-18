import { Config } from "./file-a.js";

// Type error: function signature expects Config but returns string
export function formatConfig(config: Config): Config {
  return `${config.host}:${config.port}`;
}
