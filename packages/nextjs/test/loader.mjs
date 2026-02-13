/**
 * Custom Node.js ESM loader that redirects `next/navigation` to our mock.
 * Used with: node --import tsx --loader ./test/loader.mjs --test ...
 */

import { pathToFileURL } from "node:url";
import { resolve as pathResolve } from "node:path";

const mockPath = pathToFileURL(
  pathResolve("test", "next-navigation-mock.ts")
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/navigation") {
    return { shortCircuit: true, url: mockPath };
  }
  return nextResolve(specifier, context);
}
