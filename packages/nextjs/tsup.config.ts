import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["react", "next", "next/navigation", "@tell-rs/browser"],
  platform: "browser",
  target: "es2022",
});
