import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/events.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    noExternal: ["@tell-rs/core"],
    platform: "browser",
    target: "es2022",
  },
  {
    entry: { tell: "src/index.ts" },
    format: ["iife"],
    globalName: "Tell",
    clean: false,
    sourcemap: true,
    minify: true,
    noExternal: ["@tell-rs/core"],
    platform: "browser",
    target: "es2022",
    footer: {
      js: `(function(){var s=document.currentScript;if(s&&s.dataset.apiKey){Tell.tell.configure(s.dataset.apiKey,{endpoint:s.dataset.endpoint})}})();`,
    },
  },
]);
