/**
 * A function that transforms or drops an item before it is queued.
 * Return the (possibly modified) item, or null to drop it.
 */
export type BeforeSendFn<T> = (item: T) => T | null;

/**
 * Run an item through a pipeline of beforeSend functions.
 * Returns the transformed item, or null if any function in the chain drops it.
 */
export function runBeforeSend<T>(
  item: T,
  fns: BeforeSendFn<T> | BeforeSendFn<T>[]
): T | null {
  const pipeline = Array.isArray(fns) ? fns : [fns];
  let current: T | null = item;

  for (const fn of pipeline) {
    if (current === null) return null;
    current = fn(current);
  }

  return current;
}
