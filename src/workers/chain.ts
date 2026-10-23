import { ChainWorker } from '../lib/chain/worker';
import { prisma } from '../lib/db';
import { heartbeat, pause, stopSignal } from './lifecycle';

async function main() {
  const worker = new ChainWorker(), signal = stopSignal();
  let failures = 0, lastSuccess = false;
  try {
    do {
      try {
        const result = await worker.runOnce(); failures = 0; lastSuccess = true;
        await heartbeat('chain', true, result.busy ? 'lease_held_by_another_worker' : 'poll_succeeded');
        if (result.processed) console.log('Processed one stored chain operation.');
      } catch {
        failures++; lastSuccess = false;
        await heartbeat('chain', false, 'dependency_unavailable');
        console.error('Chain worker dependency unavailable; stored evidence was not replaced.');
      }
      if (process.argv.includes('--once')) break;
      await pause(failures ? Math.min(60000, 2000 * 2 ** Math.min(failures, 5)) : 2000, signal);
    } while (!signal.aborted);
    if (process.argv.includes('--once') && !lastSuccess) process.exitCode = 1;
  } finally {
    await heartbeat('chain', false, 'stopped');
    worker.chain.provider.destroy(); await prisma.$disconnect();
  }
}
void main().catch(async () => { console.error('Chain worker stopped after an unrecoverable runtime failure.'); process.exitCode = 1; await prisma.$disconnect(); });
