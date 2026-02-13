#!/usr/bin/env node
// Prints minified + gzipped sizes for browser and node bundles.

import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  { label: "@tell-rs/browser", path: "packages/browser/dist/index.js" },
  { label: "@tell-rs/browser (cjs)", path: "packages/browser/dist/index.cjs" },
  { label: "@tell-rs/browser/events", path: "packages/browser/dist/events.js" },
  { label: "@tell-rs/node", path: "packages/node/dist/index.js" },
  { label: "@tell-rs/node (cjs)", path: "packages/node/dist/index.cjs" },
  { label: "@tell-rs/node/events", path: "packages/node/dist/events.js" },
];

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}

console.log("");
console.log("  Bundle sizes");
console.log("  ─────────────────────────────────────────────────────");
console.log(
  "  " +
    "Package".padEnd(32) +
    "Raw".padStart(10) +
    "Gzip".padStart(10)
);
console.log("  ─────────────────────────────────────────────────────");

for (const { label, path } of files) {
  const fullPath = join(root, path);
  let raw;
  try {
    raw = readFileSync(fullPath);
  } catch {
    console.log(`  ${label.padEnd(32)}${"(not found)".padStart(10)}`);
    continue;
  }
  const gzipped = gzipSync(raw);
  console.log(
    "  " +
      label.padEnd(32) +
      fmt(raw.length).padStart(10) +
      fmt(gzipped.length).padStart(10)
  );
}

console.log("  ─────────────────────────────────────────────────────");
console.log("");
