export interface Config {
  host: string;
  port: number;
  debug: boolean;
}

// Type error: 'port' should be number, not string
export const defaultConfig: Config = {
  host: "localhost",
  port: "3000",
  debug: false,
};
