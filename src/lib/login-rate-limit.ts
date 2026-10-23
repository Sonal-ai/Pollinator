import Redis from 'ioredis';
import { createHash } from 'node:crypto';
const WINDOW_SECONDS = 15 * 60;
const LIMIT = 10;
let redis: Redis | undefined;
const attempts = new Map<string, { count: number; expiresAt: number }>();
/** Production requires a shared limiter. Missing/unavailable Redis fails closed. */
export async function consumeLoginAttempt(identifier: string): Promise<boolean> {
  const digest = createHash('sha256').update(identifier).digest('hex');
  if (process.env.NODE_ENV === 'production' || process.env.REDIS_URL) {
    if (!process.env.REDIS_URL) throw new Error('Login limiter is unavailable');
    if (!redis) {
      redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1, connectTimeout: 2000, enableOfflineQueue: true,
        retryStrategy: () => null,
      });
      redis.on('error', () => { /* Never log credential-bearing connection URLs. */ });
    }
    const client = redis;
    try {
      const count = await client.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
        1, 'login:' + digest, WINDOW_SECONDS,
      );
      return Number(count) <= LIMIT;
    } catch {
      if (redis === client) redis = undefined;
      client.disconnect();
      throw new Error('Login limiter is unavailable');
    }
  }
  // Isolated local development only.
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.expiresAt <= now) attempts.delete(key);
  const entry = attempts.get(digest) ?? { count: 0, expiresAt: now + WINDOW_SECONDS * 1000 };
  entry.count++;
  attempts.set(digest, entry);
  return entry.count <= LIMIT;
}
