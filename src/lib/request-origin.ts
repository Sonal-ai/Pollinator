import { serverAppOrigin } from './app-origin';
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
export function allowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Machine clients still require their normal authentication.
  try {
    const incoming = new URL(origin);
    const expected = new URL(process.env.NODE_ENV === 'development' ? request.url : serverAppOrigin(request.url));
    if (incoming.origin === expected.origin) return true;
    // NextURL normalizes loopback IPs to localhost. Keep local development working
    // without trusting forwarded-host or allowing arbitrary origins in production.
    return process.env.NODE_ENV === 'development' && loopback.has(incoming.hostname) && loopback.has(expected.hostname) && incoming.protocol === expected.protocol && incoming.port === expected.port;
  } catch { return false; }
}
