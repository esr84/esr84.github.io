/** Typed access to the URL flags documented in CLAUDE.md (?debug=1, ?text=1, ...). */
export function getParam(name: string, search: string = location.search): string | null {
  return new URLSearchParams(search).get(name);
}

/** True when the flag is present and not explicitly disabled (`?debug`, `?debug=1`). */
export function hasFlag(name: string, search: string = location.search): boolean {
  const value = getParam(name, search);
  return value !== null && value !== '0' && value !== 'false';
}
