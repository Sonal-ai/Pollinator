import { writeFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function heartbeat(service: string, ready: boolean, detail: string) {
  const file = process.env.WORKER_HEARTBEAT_FILE;
  if (!file) return;
  const temporary = join(dirname(file), `.heartbeat-${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify({ service, ready, detail, updatedAt: new Date().toISOString() }));
  await rename(temporary, file);
}
export function stopSignal() {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
  return controller.signal;
}
export function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms); signal.addEventListener('abort', finish, { once: true });
  });
}
