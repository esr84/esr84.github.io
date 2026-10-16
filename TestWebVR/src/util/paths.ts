/**
 * Resolves a path inside `public/` against the app base URL.
 * Never use absolute paths like '/models/...': on GitHub Pages the app lives under /<repo>/.
 */
export function asset(path: string, base: string = import.meta.env.BASE_URL): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return prefix + path.replace(/^\/+/, '');
}
