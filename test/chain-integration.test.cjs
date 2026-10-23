const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ path: path.resolve('.env.integration'), override: true, quiet: true });
const dbUrl = new URL(process.env.DATABASE_URL || '');
if (dbUrl.hostname !== '127.0.0.1' || dbUrl.port !== '55432' || dbUrl.pathname !== '/pollinator_integration') throw new Error('Refusing integration tests outside the dedicated local database.');
if (process.env.BLOCKCHAIN_NETWORK !== 'local' || process.env.LOCAL_RPC_URL !== 'http://127.0.0.1:8545') throw new Error('Integration tests require the local chain.');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { ethers } = require('ethers');
const { PrismaClient } = require('@prisma/client');
const { OperationService } = require('../src/lib/chain/operations.ts');
const { ChainWorker } = require('../src/lib/chain/worker.ts');
const { ChainTransport } = require('../src/lib/chain/transport.ts');
const { FORWARD_TYPES, requestFingerprint, registryInterface, operationCalldata } = require('../src/lib/chain/protocol.ts');
const { generateQRTokensForBatch } = require('../src/lib/qr.ts');
const db = new PrismaClient();
const chain = new ChainTransport();
const service = new OperationService(db, chain);
const worker = new ChainWorker(db, chain);
const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
const contentHash = ethers.sha256(ethers.toUtf8Bytes('integration metadata'));
const reportHash = ethers.sha256(ethers.toUtf8Bytes('%PDF integration report'));
const actors = {};
const runId = randomUUID().slice(0, 8);
let registry;
before(async () => {
  const context = await chain.context();
  assert.equal(context.chainId, 31337);
  const manifest = JSON.parse(fs.readFileSync('.local-data/integration-chain.json', 'utf8'));
  assert.equal(context.genesisHash, manifest.genesisHash);
  const adminSigner = await chain.provider.getSigner(0);
  registry = new ethers.Contract(context.registryAddress, require('../artifacts/contracts/HoneyChain.sol/HoneyChain.json').abi, adminSigner);
  for (const role of ['admin', 'beekeeper', 'processor', 'lab', 'distributor', 'retailer']) {
    const wallet = ethers.Wallet.createRandom();
    const address = wallet.address;
    const roleHash = role === 'admin' ? ethers.ZeroHash : ethers.id(role.toUpperCase() + '_ROLE');
    await (await registry.grantRole(roleHash, address)).wait();
    const beekeeper = role === 'beekeeper' ? await db.beekeeper.create({ data: { phone: '+91' + String(Date.now()).slice(-10), name: 'Integration producer ' + runId, region: 'Integration test', wallet: address } }) : null;
    const account = await db.dashboardAccount.create({ data: { identifier: 'integration-' + runId + '-' + role + '@example.test', passwordHash: 'not-a-login-fixture', role, walletAddress: address, beekeeperId: beekeeper?.id } });
    actors[role] = { wallet, session: { accountId: account.id, role, walletAddress: address, beekeeperId: beekeeper?.id ?? null } };
  }
});
after(async () => { await db.$disconnect(); chain.provider.destroy(); });
let serial = 0;
async function createPayload() {
  serial++;
  const block = await chain.provider.getBlock('latest');
  return { kind: 'CREATE_BATCH', batchCode: 'IT-' + runId + '-' + serial, beekeeperId: actors.beekeeper.session.beekeeperId,
    honeyType: 'Integration multiflora', quantityGrams: 25000, hivesHarvested: 4, harvestTimestamp: block.timestamp,
    region: 'Integration test', metadataCID: cid, metadataHash: contentHash };
}
async function prepare(role, payload, batchId, key = randomUUID()) {
  const record = batchId ? await db.honeyBatch.findUniqueOrThrow({ where: { id: batchId } }) : null;
  return service.enqueue({ initiatedBy: actors[role].session.accountId, actorAddress: actors[role].wallet.address, key,
    requestHash: requestFingerprint(payload.kind, payload), payload, batchId, expectedVersion: record?.version });
}
async function approve(role, op) {
  const auth = await service.authorization(op.id, actors[role].session);
  const signature = await actors[role].wallet.signTypedData(auth.domain, FORWARD_TYPES, auth.message);
  return service.approve(op.id, actors[role].session, signature);
}
async function finish(op) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const current = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
    if (current.state === 'CONFIRMED') return current;
    assert.ok(!['FAILED','NEEDS_REVIEW'].includes(current.state), current.lastError || current.state);
    await db.chainOperation.update({ where: { id: op.id }, data: { nextAttemptAt: new Date(0) } });
    await worker.runOnce();
  }
  const current = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
  throw new Error('Operation did not finish: ' + current.state + ' ' + current.lastError);
}
async function execute(role, payload, batchId) { const op = await prepare(role, payload, batchId); await approve(role, op); return finish(op); }
async function registered() {
  const payload = await createPayload();
  const op = await execute('beekeeper', payload);
  return { payload, batchId: op.batchId };
}
function transfer(payload, from, to, newStatus) { return { kind: 'TRANSFER_CUSTODY', batchCode: payload.batchCode, fromAddress: actors[from].wallet.address, toAddress: actors[to].wallet.address, newStatus }; }

test('real PostgreSQL and EVM complete the actor-approved journey, labels and recall', async () => {
  const payload = await createPayload();
  const key = randomUUID();
  const op = await prepare('beekeeper', payload, undefined, key);
  const duplicate = await prepare('beekeeper', payload, undefined, key);
  assert.equal(duplicate.id, op.id);
  assert.equal((await db.honeyBatch.findUniqueOrThrow({ where: { id: op.batchId } })).status, 'PENDING_CHAIN');
  assert.equal(await registry.batchExists(ethers.id(payload.batchCode)), false);
  await assert.rejects(prepare('beekeeper', { ...payload, quantityGrams: 999 }, undefined, key), /different request/);
  await approve('beekeeper', op); await finish(op);
  await execute('beekeeper', transfer(payload, 'beekeeper', 'processor', 'HARVESTED'), op.batchId);
  await execute('processor', transfer(payload, 'processor', 'lab', 'PROCESSED'), op.batchId);
  await execute('lab', { kind: 'VERIFY_LAB', batchCode: payload.batchCode, labActorId: actors.lab.wallet.address, certificateHash: reportHash, ipfsCID: cid }, op.batchId);
  await execute('lab', transfer(payload, 'lab', 'processor', 'LAB_VERIFIED'), op.batchId);
  await execute('processor', { kind: 'PACKAGE_BATCH', batchCode: payload.batchCode, jarCount: 50, jarSizeGrams: 500, metadataCID: cid, metadataHash: contentHash }, op.batchId);
  const labels = await generateQRTokensForBatch({ batchId: op.batchId, batchCode: payload.batchCode, jarCount: 50, jarSizeGrams: 500 });
  const reprints = await generateQRTokensForBatch({ batchId: op.batchId, batchCode: payload.batchCode, jarCount: 50, jarSizeGrams: 500 });
  assert.deepEqual(labels, reprints);
  assert.equal(await db.qRToken.count({ where: { batchId: op.batchId } }), 50);
  await execute('processor', transfer(payload, 'processor', 'distributor', 'IN_DISTRIBUTION'), op.batchId);
  await execute('distributor', transfer(payload, 'distributor', 'retailer', 'AT_RETAIL'), op.batchId);
  await execute('retailer', transfer(payload, 'retailer', 'retailer', 'SOLD'), op.batchId);
  const recall = await prepare('admin', { kind: 'RECALL_BATCH', batchCode: payload.batchCode, reasonCID: cid, reason: 'Integration safety recall' }, op.batchId);
  assert.equal((await db.honeyBatch.findUniqueOrThrow({ where: { id: op.batchId } })).recalled, true);
  assert.equal(await db.qRToken.count({ where: { batchId: op.batchId, active: true } }), 0);
  await approve('admin', recall); await finish(recall);
  const row = await db.honeyBatch.findUniqueOrThrow({ where: { id: op.batchId } });
  assert.equal(row.status, 'RECALLED'); assert.ok(row.recallTxHash); assert.equal(row.pendingOperationId, null);
  assert.equal((await registry.getBatch(ethers.id(payload.batchCode))).recalled, true);
  assert.equal(await chain.provider.getBalance(actors.beekeeper.wallet.address), 0n);
});

test('a worker restart after signing resumes the identical stored bytes and nonce', async () => {
  const { payload, batchId } = await registered();
  const op = await prepare('beekeeper', transfer(payload, 'beekeeper', 'processor', 'HARVESTED'), batchId);
  await approve('beekeeper', op);
  await worker.runOnce();
  const signed = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
  assert.equal(signed.state, 'SIGNED'); assert.ok(signed.signedTransaction);
  await new ChainWorker(db, chain).runOnce();
  await finish(op);
  const confirmed = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
  assert.equal(confirmed.signedTransaction, signed.signedTransaction); assert.equal(confirmed.txHash, signed.txHash); assert.equal(confirmed.signerNonce, signed.signerNonce);
  assert.equal(await db.custodyEvent.count({ where: { chainOperationId: op.id } }), 1);
});

test('lost RPC acknowledgement does not sign or broadcast a different transaction', async () => {
  const { payload, batchId } = await registered();
  const op = await prepare('beekeeper', transfer(payload, 'beekeeper', 'processor', 'HARVESTED'), batchId);
  await approve('beekeeper', op); await worker.runOnce();
  const signed = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
  const original = chain.broadcast.bind(chain);
  chain.broadcast = async raw => { await original(raw); throw new Error('Injected lost acknowledgement'); };
  try { await worker.runOnce(); } finally { chain.broadcast = original; }
  await finish(op);
  const confirmed = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
  assert.equal(confirmed.txHash, signed.txHash); assert.equal(confirmed.signerNonce, signed.signerNonce);
  assert.equal(await db.custodyEvent.count({ where: { chainOperationId: op.id } }), 1);
});

test('database projection failure rolls back and recovers from the existing receipt exactly once', async () => {
  const { payload, batchId } = await registered();
  const op = await prepare('beekeeper', transfer(payload, 'beekeeper', 'processor', 'HARVESTED'), batchId);
  await approve('beekeeper', op); await worker.runOnce(); await worker.runOnce();
  const broken = new Proxy(db, { get(target, key) {
    if (key === '$transaction') return (callback, options) => target.$transaction(tx => callback(new Proxy(tx, { get(inner, field) {
      if (field === 'custodyEvent') return new Proxy(inner.custodyEvent, { get(model, method) {
        if (method === 'upsert') return async args => { await model.upsert(args); throw new Error('Injected crash before DB commit'); };
        const value = Reflect.get(model, method); return typeof value === 'function' ? value.bind(model) : value;
      } });
      const value = Reflect.get(inner, field); return typeof value === 'function' ? value.bind(inner) : value;
    } })), options);
    const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
  } });
  await new ChainWorker(broken, chain).runOnce();
  assert.equal((await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } })).state, 'SUBMITTED');
  assert.equal(await db.custodyEvent.count({ where: { chainOperationId: op.id } }), 0);
  assert.equal((await db.honeyBatch.findUniqueOrThrow({ where: { id: batchId } })).current_custodian.toLowerCase(), actors.beekeeper.wallet.address.toLowerCase());
  await finish(op); await worker.runOnce();
  assert.equal(await db.custodyEvent.count({ where: { chainOperationId: op.id } }), 1);
});

test('wrong actor signatures and attempts to approve another actor operation are rejected', async () => {
  const payload = await createPayload();
  const op = await prepare('beekeeper', payload);
  await assert.rejects(service.authorization(op.id, actors.processor.session), /not found|enrolled actor/);
  const auth = await service.authorization(op.id, actors.beekeeper.session);
  const signature = await actors.lab.wallet.signTypedData(auth.domain, FORWARD_TYPES, auth.message);
  await assert.rejects(service.approve(op.id, actors.beekeeper.session, signature), /does not match/);
  assert.equal((await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } })).state, 'AWAITING_SIGNATURE');
  await approve('beekeeper', op); await finish(op);
});

test('only one pending operation can hold a batch across concurrent request keys', async () => {
  const { payload, batchId } = await registered();
  const p = transfer(payload, 'beekeeper', 'processor', 'HARVESTED');
  const results = await Promise.allSettled([prepare('beekeeper', p, batchId), prepare('beekeeper', p, batchId)]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  const op = results.find(item => item.status === 'fulfilled').value;
  await approve('beekeeper', op); await finish(op);
});

test('parallel workers share a relayer lease and cannot allocate the same nonce twice', async () => {
  const p1 = await createPayload(); const p2 = await createPayload();
  // Distinct actors can approve concurrently; each actor intentionally holds only one approval at a time.
  const op1 = await prepare('beekeeper', p1); await approve('beekeeper', op1);
  const wallet2 = ethers.Wallet.createRandom();
  await (await registry.grantRole(ethers.id('BEEKEEPER_ROLE'), wallet2.address)).wait();
  const b2 = await db.beekeeper.create({ data: { phone: '+1888' + String(Date.now()).slice(-7), wallet: wallet2.address } });
  const a2 = await db.dashboardAccount.create({ data: { identifier: 'integration-' + runId + '-second@example.test', passwordHash: 'not-a-login-fixture', role: 'beekeeper', walletAddress: wallet2.address, beekeeperId: b2.id } });
  const session2 = { accountId: a2.id, role: 'beekeeper', walletAddress: wallet2.address, beekeeperId: b2.id };
  p2.beekeeperId = b2.id;
  const op2 = await service.enqueue({ initiatedBy: a2.id, key: randomUUID(), requestHash: requestFingerprint(p2.kind, p2), actorAddress: wallet2.address, payload: p2 });
  const auth = await service.authorization(op2.id, session2);
  await service.approve(op2.id, session2, await wallet2.signTypedData(auth.domain, FORWARD_TYPES, auth.message));
  for (let i = 0; i < 10; i++) await Promise.all([worker.runOnce(), new ChainWorker(db, chain).runOnce()]);
  const one = await finish(op1); const two = await finish(op2);
  assert.notEqual(one.signerNonce, two.signerNonce); assert.notEqual(one.txHash, two.txHash);
});

test('protocol ABI encodes the deployed contract methods, including every bound packaging field', async () => {
  const payload = await createPayload();
  assert.equal(operationCalldata(payload), registry.interface.encodeFunctionData('createBatch', [ethers.id(payload.batchCode), payload.harvestTimestamp, payload.quantityGrams, payload.metadataCID, payload.metadataHash]));
  assert.equal(registryInterface.getFunction('packageBatch').selector, registry.interface.getFunction('packageBatch').selector);
});
test('an externally submitted matching approval can recover a missing submission acknowledgement', async () => {
  const payload = await createPayload();
  const op = await prepare('beekeeper', payload);
  const auth = await service.authorization(op.id, actors.beekeeper.session);
  const signature = await actors.beekeeper.wallet.signTypedData(auth.domain, FORWARD_TYPES, auth.message);
  const forwarder = new ethers.Contract(op.forwarderAddress, require('../src/lib/chain/protocol.ts').FORWARDER_ABI, chain.relayer());
  const tx = await forwarder.execute(require('../src/lib/chain/protocol.ts').forwardRequest(auth, signature));
  await tx.wait();
  assert.equal((await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } })).state, 'AWAITING_SIGNATURE');
  await service.reconcile(op.id, actors.beekeeper.session, tx.hash);
  const confirmed = await finish(op);
  assert.equal(confirmed.txHash, tx.hash);
  assert.equal((await db.honeyBatch.findUniqueOrThrow({ where: { id: op.batchId } })).txHash, tx.hash);
});
test('tampered stored payload is held for review before signing or broadcasting', async () => {
  const payload = await createPayload();
  const op = await prepare('beekeeper', payload);
  await approve('beekeeper', op);
  await db.chainOperation.update({ where: { id: op.id }, data: { payload: { ...payload, quantityGrams: 999999 } } });
  await worker.runOnce();
  const held = await db.chainOperation.findUniqueOrThrow({ where: { id: op.id } });
  assert.equal(held.state, 'NEEDS_REVIEW'); assert.equal(held.signedTransaction, null); assert.equal(held.txHash, null);
  assert.equal(await registry.batchExists(ethers.id(payload.batchCode)), false);
});
