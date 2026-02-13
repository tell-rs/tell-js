/**
 * Mock for next/navigation hooks used in tests.
 * Values can be changed between tests via setPathname / setSearchParams.
 */

let _pathname = "/";
let _searchParams = new URLSearchParams();

export function usePathname(): string {
  return _pathname;
}

export function useSearchParams(): URLSearchParams {
  return _searchParams;
}

export function setPathname(p: string): void {
  _pathname = p;
}

export function setSearchParams(s: URLSearchParams): void {
  _searchParams = s;
}

export function resetMock(): void {
  _pathname = "/";
  _searchParams = new URLSearchParams();
}

// Stubs for other next/navigation exports the module may reference
export function useRouter() {
  return { push() {}, replace() {}, back() {}, forward() {}, refresh() {}, prefetch() {} };
}
export function useSelectedLayoutSegment() { return null; }
export function useSelectedLayoutSegments() { return []; }
export function redirect() {}
export function permanentRedirect() {}
export function notFound() {}
