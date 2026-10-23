/** Server runtime origin. APP_ORIGIN stays configurable when a web image is reused across clusters. */
export function serverAppOrigin(fallback?: string): string {
  const url = new URL(process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || fallback || 'http://localhost:3000');
  if (url.username || url.password) throw new Error('Application origin must not contain credentials');
  return url.origin;
}
