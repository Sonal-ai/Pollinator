require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const policy = require('../src/lib/access-policy.ts');
const workflow = require('../src/lib/batch-workflow.ts');
const wallet = '0x' + 'a'.repeat(40);
const recipient = '0x' + 'b'.repeat(40);
const CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
const session = role => ({ role, accountId: 'account-a', walletAddress: wallet, beekeeperId: 'farmer-a' });
const batch = { id: 'batch-a', batchCode: 'HC-TEST', beekeeperId: 'farmer-a', current_custodian: wallet, status: 'HARVESTED', recalled: false, quantity_grams: 25000, lab_verified: false, metadataCID: CID, metadataHash: '0x' + 'a'.repeat(64) };
function load(file, mocks) {
  const filename = path.resolve(file);
  const unit = new Module(filename, module);
  unit.filename = filename; unit.paths = Module._nodeModulePaths(path.dirname(filename));
  unit.require = function (key) {
    if (Object.hasOwn(mocks, key)) return mocks[key];
    if (key === '@/lib/chain/protocol') return require('../src/lib/chain/protocol.ts');
    if (key === '@/lib/chain/http') return require('../src/lib/chain/http.ts');
    if (key === '@/lib/chain/operations') return { operationService: { existing: async () => null, enqueue: queue } };
    if (key === '@/lib/access-policy') return policy;
    if (key === '@/lib/batch-workflow') return workflow;
    if (key.startsWith('@/')) throw new Error('Unmocked I/O: ' + key);
    return Module.prototype.require.call(this, key);
  };
  unit._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  return unit.exports;
}
const unexpected = () => { throw new Error('Unexpected state mutation'); };
function db(record) { return { honeyBatch: { findUnique: async () => record, update: unexpected }, certificate: { create: unexpected }, custodyEvent: { create: unexpected } }; }
function request(body) { return new Request('https://pollinator.example/api/custody', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'unit-test-request' }, body: JSON.stringify(body) }); }
let queued = [];
async function queue(input) {
  queued.push(input);
  return { id: 'operation-a', batchId: batch.id, kind: input.payload.kind, actorAddress: wallet, state: 'AWAITING_SIGNATURE', payload: input.payload,
    chainId: 31337, registryAddress: recipient, forwarderAddress: recipient, txHash: null, receiptBlock: null, lastError: null, authorizationDeadline: null, createdAt: new Date(), updatedAt: new Date() };
}
test('pending and terminal batches have no handover path; lab and packaging cannot be skipped', () => {
  for (const current of ['PENDING_CHAIN', 'SOLD', 'RECALLED', 'unknown']) for (const role of policy.ROLES) assert.deepEqual(workflow.custodyStageOptions(current, role), []);
  assert.deepEqual(workflow.custodyStageOptions('HARVESTED', 'beekeeper'), ['HARVESTED']);
  assert.deepEqual(workflow.custodyStageOptions('HARVESTED', 'processor'), ['HARVESTED', 'PROCESSED']);
  assert.deepEqual(workflow.custodyStageOptions('PROCESSED', 'lab'), ['PROCESSED']);
});
test('custody is stored for actor approval without creating an event or changing its owner', async () => {
  const route = load('src/app/api/custody/route.ts', { '@/lib/db': { prisma: db(batch) }, '@/lib/auth': { getSession: async () => session('beekeeper') }, '@/lib/blockchain': { transferCustodyOnChain: unexpected } });
  assert.equal((await route.POST(request({ batchId: batch.id, toAddress: recipient, newStatus: 'HARVESTED' }))).status, 202);
});
test('a forged lab-approved status fails before a transaction is sent', async () => {
  const route = load('src/app/api/custody/route.ts', { '@/lib/db': { prisma: db(batch) }, '@/lib/auth': { getSession: async () => session('beekeeper') }, '@/lib/blockchain': { transferCustodyOnChain: unexpected } });
  assert.equal((await route.POST(request({ batchId: batch.id, toAddress: recipient, newStatus: 'LAB_VERIFIED' }))).status, 409);
});
function packaging(record, integrity, send = unexpected) {
  return load('src/app/api/batch/[batchCode]/package/route.ts', {
    '@/lib/db': { prisma: db(record) }, '@/lib/auth': { getSession: async () => session('processor') },
    '@/lib/blockchain': { packageBatchOnChain: send },
    '@/lib/ipfs': { verifyMetadataIntegrity: async () => integrity, uploadBatchMetadata: async () => ({ cid: CID, hash: batch.metadataHash }) },
  });
}
test('packaging is stored for actor approval without marking the batch packaged', async () => {
  const record = { ...batch, status: 'LAB_VERIFIED', lab_verified: true };
  const route = packaging(record, { valid: true, metadata: { batchCode: batch.batchCode, quantityGrams: 25000 } });
  assert.equal((await route.POST(request({ jarCount: 50, jarSizeGrams: 500 }), { params: Promise.resolve({ batchCode: batch.batchCode }) })).status, 202);
});
test('packaging cannot replace missing or mismatched original evidence with invented metadata', async () => {
  for (const integrity of [{ valid: false }, { valid: true, metadata: { batchCode: 'OTHER', quantityGrams: 25000 } }]) {
    const route = packaging({ ...batch, status: 'LAB_VERIFIED', lab_verified: true }, integrity, unexpected);
    assert.equal((await route.POST(request({ jarCount: 50, jarSizeGrams: 500 }), { params: Promise.resolve({ batchCode: batch.batchCode }) })).status, 409);
  }
});
test('packaging without confirmed lab approval is rejected before uploads or chain writes', async () => {
  const route = packaging(batch, null, unexpected);
  assert.equal((await route.POST(request({ jarCount: 50, jarSizeGrams: 500 }), { params: Promise.resolve({ batchCode: batch.batchCode }) })).status, 409);
});
function certificateRoute(record) {
  return load('src/app/api/certificate/route.ts', {
    '@/lib/db': { prisma: db(record) }, '@/lib/auth': { getSession: async () => session('lab') }, '@/lib/env': { env: {} },
    '@/lib/blockchain': { verifyLabOnChain: unexpected },
    '@/lib/ipfs': { computeFileHash: () => batch.metadataHash, uploadFileToPinata: async () => ({ cid: CID }) },
  });
}
function pdfRequest(bytes) {
  const form = new FormData(); form.set('batchId', batch.id);
  form.set('file', new Blob([bytes], { type: 'application/pdf' }), 'report.pdf');
  return new Request('https://pollinator.example/api/certificate', { method: 'POST', headers: { 'Idempotency-Key': 'unit-test-request' }, body: form });
}
test('laboratory evidence is stored for actor approval without a verified flag', async () => {
  assert.equal((await certificateRoute({ ...batch, status: 'PROCESSED' }).POST(pdfRequest('%PDF-1.4 test'))).status, 202);
});
test('renaming a non-PDF file cannot produce a laboratory approval', async () => {
  assert.equal((await certificateRoute({ ...batch, status: 'PROCESSED' }).POST(pdfRequest('<html>not a report</html>'))).status, 415);
});
test('retired client location synchronization cannot mutate another visitor scan', async () => {
  const route = load('src/app/api/qr/sync-geo/route.ts', {});
  assert.equal((await route.POST()).status, 410);
});
test('prepared API intents bind the actor, batch and exact domain action', async () => {
  queued = [];
  const route = load('src/app/api/custody/route.ts', { '@/lib/db': { prisma: db(batch) }, '@/lib/auth': { getSession: async () => session('beekeeper') } });
  const response = await route.POST(request({ batchId: batch.id, toAddress: recipient, newStatus: 'HARVESTED' }));
  const body = await response.json();
  assert.equal(body.operationId, 'operation-a');
  assert.equal(body.operation.state, 'AWAITING_SIGNATURE');
  assert.equal(queued[0].actorAddress, wallet);
  assert.equal(queued[0].payload.toAddress, recipient);
  assert.equal(queued[0].payload.kind, 'TRANSFER_CUSTODY');
});
test('WhatsApp gram and kilogram input is confirmed without silently stripping units or decimal points', () => {
  const { parseHarvestQuantity: parse } = require('../src/lib/whatsapp/harvest-quantity.ts');
  for (const [text, grams] of [['25 kg',25000],['2.5kg',2500],['25000',25000],['25,000 g',25000],['२५ किलो',25000],['०.०२५ kg',25],['1,00,000 ग्राम',100000]]) assert.equal(parse(text), grams, text);
  for (const text of ['-5kg','25kg or 30kg','1.5g','2,5kg','abc123','Infinity','10001 kg']) assert.equal(parse(text), null, text);
});
test('loopback aliases are accepted only in development, with matching protocol and port', () => {
  const { allowedRequestOrigin } = require('../src/lib/request-origin.ts');
  const previousMode = process.env.NODE_ENV, previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  try {
    process.env.NODE_ENV = 'development';
    const origin = value => allowedRequestOrigin(new Request('http://localhost:3100/api/auth/login', { headers: { Origin: value } }));
    assert.equal(origin('http://127.0.0.1:3100'), true);
    for (const value of ['https://127.0.0.1:3100','http://127.0.0.1:3101','http://evil.test:3100','null']) assert.equal(origin(value), false);
    process.env.NODE_ENV = 'production'; process.env.NEXT_PUBLIC_APP_URL = 'https://pollinator.example';
    assert.equal(origin('http://127.0.0.1:3100'), false);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});
test('local fixture signing is unavailable in production and while its explicit flag is off', async () => {
  const previousMode = process.env.NODE_ENV, previousFlag = process.env.LOCAL_TEST_SIGNING;
  const route = load('src/app/api/operations/[operationId]/approve-fixture/route.ts', {
    '@/lib/auth': { getSession: unexpected }, '@/lib/db': { prisma: {} }, '@/lib/blockchain': {},
  });
  try {
    process.env.NODE_ENV = 'production'; process.env.LOCAL_TEST_SIGNING = 'true';
    assert.equal((await route.POST(request({}), { params: Promise.resolve({ operationId: 'never-used' }) })).status, 404);
    process.env.NODE_ENV = 'development'; process.env.LOCAL_TEST_SIGNING = 'false';
    assert.equal((await route.POST(request({}), { params: Promise.resolve({ operationId: 'never-used' }) })).status, 404);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousFlag === undefined) delete process.env.LOCAL_TEST_SIGNING; else process.env.LOCAL_TEST_SIGNING = previousFlag;
  }
});
test('operation JSON bodies reject malformed and oversized input before state changes', async () => {
  const { readOperationJSON } = require('../src/lib/chain/http.ts');
  await assert.rejects(readOperationJSON(new Request('https://pollinator.example', { method: 'POST', body: '{' })), error => error.status === 400);
  await assert.rejects(readOperationJSON(new Request('https://pollinator.example', { method: 'POST', body: JSON.stringify({ junk: 'x'.repeat(9000) }) })), error => error.status === 413);
});
test('certificate multipart parsing is bounded even when content-length is absent', async () => {
  const { readCertificateForm } = require('../src/lib/chain/http.ts');
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(11 * 1024 * 1024)); controller.close(); } });
  const req = new Request('https://pollinator.example', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=bounded-test' }, body, duplex: 'half' });
  await assert.rejects(readCertificateForm(req), error => error.status === 413);
});
