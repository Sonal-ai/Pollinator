// Operator-only aid for browser QA without a wallet extension. Never imports a private key.
const fs = require('node:fs');
const assert = require('node:assert/strict');
require('dotenv').config({ path: '.env.integration', override: true, quiet: true });
const database = new URL(process.env.DATABASE_URL || '');
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.port, '55432');
assert.equal(database.pathname, '/pollinator_integration');
assert.equal(process.env.BLOCKCHAIN_NETWORK, 'local');
assert.equal(process.env.LOCAL_RPC_URL, 'http://127.0.0.1:8545');
const { PrismaClient } = require('@prisma/client');
const { ChainTransport } = require('../build/workers/lib/chain/transport.js');
const db = new PrismaClient(), chain = new ChainTransport();
const base = 'http://127.0.0.1:3100';
const accounts = Object.values(JSON.parse(fs.readFileSync('.local-data/local-demo-accounts.json')));
const id = process.argv[2];
assert.match(id || '', /^[a-zA-Z0-9_-]{10,100}$/);
async function post(path, body, cookie) {
  const response = await fetch(base + path, { method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
  assert.ok(response.ok, 'Local fixture API request failed: ' + response.status);
  return { response, data: await response.json() };
}
(async () => {
  try {
    const context = await chain.context();
    assert.equal(context.chainId, 31337);
    const op = await db.chainOperation.findUniqueOrThrow({ where: { id } });
    assert.equal(op.chainId, context.chainId);
    assert.equal(op.registryAddress.toLowerCase(), context.registryAddress.toLowerCase());
    assert.equal(op.forwarderAddress.toLowerCase(), context.forwarderAddress.toLowerCase());
    assert.equal(op.state, 'AWAITING_SIGNATURE');
    const actor = accounts.find(account => account.walletAddress.toLowerCase() === op.actorAddress.toLowerCase());
    assert.ok(actor?.identifier.startsWith('local-demo-'), 'Only named synthetic demo actors may use this helper');
    const login = await post('/api/auth/login', { identifier: actor.identifier, password: actor.password });
    const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);
    const { data: authorization } = await post('/api/operations/' + id + '/authorization', {}, cookie);
    assert.equal(authorization.domain.chainId, 31337);
    assert.equal(authorization.message.from.toLowerCase(), actor.walletAddress.toLowerCase());
    const signer = await chain.provider.getSigner(actor.walletAddress);
    const signature = await signer.signTypedData(authorization.domain, authorization.types, authorization.message);
    await post('/api/operations/' + id + '/approve', { signature }, cookie);
    for (let turn = 0; turn < 40; turn++) {
      const row = await db.chainOperation.findUniqueOrThrow({ where: { id } });
      if (row.state === 'CONFIRMED') {
        const file = 'docs/qa/final-ui-operations.json';
        const records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
        const evidence = { checkedAt: new Date().toISOString(), operationId: id, kind: row.kind, transactionHash: row.txHash, chainId:31337, state:row.state, syntheticFixtureSignatureViaApi:true, externalWalletUiTested:false };
        records.push(evidence); fs.writeFileSync(file, JSON.stringify(records, null, 2) + '\n');
        console.log(JSON.stringify(evidence)); return;
      }
      assert.ok(!['FAILED', 'NEEDS_REVIEW'].includes(row.state), 'Operation needs review');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Timed out waiting for the local chain worker; inspect saved operation before retrying');
  } finally { chain.provider.destroy(); await db.$disconnect(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
