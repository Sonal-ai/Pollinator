import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const PARAMETERS = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LENGTH = 64;
const DUMMY_HASH = 'scrypt$131072$8$1$' + '00'.repeat(16) + '$' + '00'.repeat(KEY_LENGTH);
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, PARAMETERS, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 1024) {
    throw new Error('Use at least 12 characters and at most 1024 UTF-8 bytes.');
  }
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return 'scrypt$131072$8$1$' + salt.toString('hex') + '$' + key.toString('hex');
}
export async function verifyPassword(password: string, encoded?: string | null): Promise<boolean> {
  if (!password || Buffer.byteLength(password, 'utf8') > 1024) return false;
  const usable = typeof encoded === 'string' && /^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
  const parts = (usable ? encoded : DUMMY_HASH).split('$');
  const actual = await derive(password, Buffer.from(parts[4], 'hex'));
  const matches = timingSafeEqual(actual, Buffer.from(parts[5], 'hex'));
  return usable && matches;
}
