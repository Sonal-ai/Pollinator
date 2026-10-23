'use client';
import { useRef } from 'react';
/** Retain the idempotency key when the same form is retried after a network failure. */
export function useOperationRequest() {
  const previous = useRef<{ fingerprint: string; key: string } | null>(null);
  return async (url: string, body: Record<string, unknown> | FormData, fingerprint?: string) => {
    const isForm = body instanceof FormData;
    if (isForm && !fingerprint) throw new Error('File submissions need a stable content fingerprint');
    const identity = url + ':' + (fingerprint ?? JSON.stringify(body));
    if (previous.current?.fingerprint !== identity) previous.current = { fingerprint: identity, key: crypto.randomUUID() };
    return fetch(url, { method: 'POST', headers: { 'Idempotency-Key': previous.current.key, ...(!isForm ? { 'Content-Type': 'application/json' } : {}) }, body: isForm ? body : JSON.stringify(body) });
  };
}
