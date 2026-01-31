import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["vue", "@tell-rs/browser"],
  platform: "browser",
  target: "es2022",
});
