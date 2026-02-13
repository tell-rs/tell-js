import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/events.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  noExternal: ["@tell-rs/core"],
  platform: "browser",
  target: "es2022",
});
