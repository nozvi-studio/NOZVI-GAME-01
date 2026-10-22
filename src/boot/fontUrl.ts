/**
 * Resolves a font file or asset URL relative to the Vite/app base path.
 * Ensures non-root base URLs (like /mirror/ or ./ or Capacitor relative path)
 * work correctly without creating double slashes or dropping base segments.
 */
export function resolveFontUrl(baseUrl: string, relativePath: string): string {
  if (!baseUrl) {
    return relativePath;
  }
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${cleanBase}${cleanPath}`;
}
