import { createHash } from 'node:crypto';
/** Pollinator JSON v1: recursively sorted object keys; JSON values only. */
export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Evidence numbers must be finite');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  if (typeof value === 'object' && value !== null &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).filter(key => object[key] !== undefined).sort()
      .map(key => JSON.stringify(key) + ':' + canonicalJSON(object[key])).join(',') + '}';
  }
  throw new Error('Evidence must contain plain JSON values');
}
export function hashEvidence(bytes: Uint8Array | string): string {
  return '0x' + createHash('sha256').update(bytes).digest('hex');
}
export function isEvidenceCID(value: string): boolean {
  return value.length <= 256 && (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(value) || /^b[a-z2-7]{20,}$/.test(value));
}
export type EvidenceState = 'MATCH' | 'MISMATCH' | 'UNAVAILABLE';
export interface EvidenceCheck { valid: boolean; status: EvidenceState; reason?: string; networkError?: boolean; }
export function checkEvidenceBytes(bytes: Uint8Array, expected: string): EvidenceCheck {
  if (!/^0x[0-9a-f]{64}$/i.test(expected)) return { valid: false, status: 'MISMATCH', reason: 'Invalid registered SHA-256 commitment.' };
  return hashEvidence(bytes).toLowerCase() === expected.toLowerCase()
    ? { valid: true, status: 'MATCH' }
    : { valid: false, status: 'MISMATCH', reason: 'Retrieved bytes do not match the registered hash.' };
}
