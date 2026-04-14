import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: true,
  external: ["ink", "react"],
  define: {
    "process.env.__DHELIX_VERSION__": JSON.stringify(pkg.version),
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.jsxImportSource = "react";
  },
});
