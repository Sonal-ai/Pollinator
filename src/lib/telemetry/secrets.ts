import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { TelemetryError } from './protocol';

function key() {
  const value = process.env.IOT_CREDENTIAL_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new TelemetryError('Device credential encryption is not configured', 503);
  return Buffer.from(value, 'hex');
}
export function encryptDeviceSecret(secret: string, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.');
}
export function decryptDeviceSecret(value: string, context: string) {
  try {
    const parts = value.split('.');
    if (parts.length !== 3) throw new Error('Invalid ciphertext');
    const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, 'base64url'));
    const cipher = createDecipheriv('aes-256-gcm', key(), iv);
    cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8');
  } catch { throw new TelemetryError('Device credential is unavailable', 503); }
}
