
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node', jsx: 'react-jsx' } });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const evidence = require('../src/lib/evidence.ts');
const ipfs = require('../src/lib/ipfs.ts');
const CID = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
const metadata = { batchCode: 'HC-TEST-01', beekeeperPublicName: 'Test producer', region: 'Test', honeyType: 'Multiflora', harvestDate: '2026-10-20', quantityGrams: 25000, version: '2.0', packagingDetails: { jarCount: 50, jarSizeGrams: 500, packagedAt: '2026-10-20' } };
function load(file, mocks) {
  const filename = path.resolve(file);
  const unit = new Module(filename, module);
  unit.filename = filename;
  unit.paths = Module._nodeModulePaths(path.dirname(filename));
  unit.require = function (key) {
    if (Object.hasOwn(mocks, key)) return mocks[key];
    if (key.startsWith('@/')) throw new Error('Unmocked application I/O: ' + key);
    return Module.prototype.require.call(this, key);
  };
  unit._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
  return unit.exports;
}
async function withFetch(handler, run) {
  const original = global.fetch;
  global.fetch = handler;
  try { return await run(); } finally { global.fetch = original; }
}
test('canonical JSON recursively orders keys and preserves nested packaging fields', () => {
  const a = { z: [{ beta: 2, alpha: 1 }], a: 'शहद' };
  const b = { a: 'शहद', z: [{ alpha: 1, beta: 2 }] };
  assert.equal(evidence.canonicalJSON(a), evidence.canonicalJSON(b));
  assert.notEqual(ipfs.computeMetadataHash(metadata), ipfs.computeMetadataHash({
    ...metadata, packagingDetails: { ...metadata.packagingDetails, jarCount: 50000 },
  }));
  for (const value of [NaN, Infinity, new Date(), BigInt(1)]) assert.throws(() => evidence.canonicalJSON(value));
});
test('upload sends exactly the bytes whose hash is returned, including nested and Unicode content', async () => {
  const previous = process.env.PINATA_JWT;
  process.env.PINATA_JWT = 'test-only-storage-key';
  try {
    await withFetch(async (url, options) => {
      assert.match(url, /pinFileToIPFS$/);
      const file = options.body.get('file');
      assert.equal(await file.text(), evidence.canonicalJSON(metadata));
      assert.equal(file.type, 'application/json');
      return Response.json({ IpfsHash: CID });
    }, async () => {
      const result = await ipfs.uploadBatchMetadata(metadata);
      assert.equal(result.cid, CID);
      assert.equal(result.hash, evidence.hashEvidence(Buffer.from(evidence.canonicalJSON(metadata))));
    });
  } finally { if (previous === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = previous; }
});
test('storage rejection or malformed receipt never fabricates a CID', async () => {
  const previous = process.env.PINATA_JWT;
  process.env.PINATA_JWT = 'test-only-storage-key';
  try {
    await withFetch(async () => new Response('denied', { status: 401 }),
      () => assert.rejects(ipfs.uploadBatchMetadata(metadata), /rejected/));
    await withFetch(async () => Response.json({ IpfsHash: 'QmDemoFake' }),
      () => assert.rejects(ipfs.uploadBatchMetadata(metadata), /invalid CID/));
  } finally { if (previous === undefined) delete process.env.PINATA_JWT; else process.env.PINATA_JWT = previous; }
});
test('retrieved exact metadata bytes match while nested tampering fails', async () => {
  const bytes = Buffer.from(evidence.canonicalJSON(metadata));
  const hash = evidence.hashEvidence(bytes);
  await withFetch(async () => new Response(bytes), async () => {
    const result = await ipfs.verifyMetadataIntegrity(CID, hash);
    assert.equal(result.status, 'MATCH');
    assert.equal(result.metadata.packagingDetails.jarCount, 50);
  });
  await withFetch(async () => new Response(evidence.canonicalJSON({
    ...metadata, packagingDetails: { ...metadata.packagingDetails, jarSizeGrams: 1000 },
  })), async () => assert.equal((await ipfs.verifyMetadataIntegrity(CID, hash)).status, 'MISMATCH'));
});
test('IPFS outage and demo/invalid CIDs stay unavailable and never valid', async () => {
  await withFetch(async () => { throw new Error('offline'); }, async () => {
    for (const cid of [CID, 'QmDemoFake', '', '../../private']) {
      const result = await ipfs.verifyMetadataIntegrity(cid, evidence.hashEvidence('anything'));
      assert.equal(result.valid, false);
      assert.equal(result.status, 'UNAVAILABLE');
    }
  });
});
test('raw PDF bytes must match the registered report commitment', async () => {
  const pdf = Buffer.from('%PDF-1.4 test report');
  const hash = evidence.hashEvidence(pdf);
  await withFetch(async () => new Response(pdf), async () =>
    assert.equal((await ipfs.verifyFileIntegrity(CID, hash)).status, 'MATCH'));
  await withFetch(async () => new Response('%PDF changed'), async () =>
    assert.equal((await ipfs.verifyFileIntegrity(CID, hash)).status, 'MISMATCH'));
});
test('QR validation binds a signed nonce to its own batch record', async () => {
  const qr = load('src/lib/qr.ts', {
    './env': { env: { QR_HMAC_SECRET: 'test-only-hmac-' + 'x'.repeat(40) } },
    './db': { prisma: { qRToken: { findUnique: async () => ({ batch: { batchCode: 'OTHER-BATCH', recalled: false }, active: true }) } } },
    './anti-clone': {},
  });
  const nonce = '11111111-1111-4111-8111-111111111111';
  const signature = qr.signQRPayload('HC-TEST-01', nonce);
  assert.equal(qr.verifyQRSignature('HC-TEST-01', nonce, signature + 'invalid'), false);
  const result = await qr.processQRScan({ batchCode: 'HC-TEST-01', nonce, signature, ipAddress: null, userAgent: null });
  assert.equal(result.valid, false);
  assert.equal(result.status, 'NOT_FOUND');
});
function labelFixture() {
  const tokens = [];
  let creations = 0;
  const batch = { batchCode: 'HC-TEST-01', status: 'PACKAGED', recalled: false, packagingTxHash: '0xreceipt', jarCount: 50, jarSizeGrams: 500, quantity_grams: 25000 };
  const tx = { honeyBatch: { findUnique: async () => batch }, qRToken: {
    findMany: async () => tokens, createMany: async ({ data }) => { creations++; tokens.push(...data); },
  } };
  const qr = load('src/lib/qr.ts', {
    './env': { env: { QR_HMAC_SECRET: 'test-only-hmac-' + 'x'.repeat(40), NEXT_PUBLIC_APP_URL: 'https://pollinator.example' } },
    './db': { prisma: { $transaction: async (run, options) => {
      assert.equal(options.isolationLevel, 'Serializable'); return run(tx);
    } } }, './anti-clone': {},
  });
  return { qr, batch, tokens, creations: () => creations, params: { batchId: 'batch-a', batchCode: batch.batchCode, jarCount: 50, jarSizeGrams: 500 } };
}
test('label retries and reprints reuse the exact serialized jar inventory', async () => {
  const f = labelFixture();
  const first = await f.qr.generateQRTokensForBatch(f.params);
  const second = await f.qr.generateQRTokensForBatch(f.params);
  assert.equal(first.length, 50);
  assert.deepEqual(second, first);
  assert.equal(f.creations(), 1);
});
test('label quantity, jar size and batch identity must match confirmed packaging', async () => {
  const f = labelFixture();
  for (const patch of [{ jarCount: 51 }, { jarSizeGrams: 1000 }, { batchCode: 'OTHER' }]) {
    await assert.rejects(f.qr.generateQRTokensForBatch({ ...f.params, ...patch }), /confirmed packaging/);
  }
  f.batch.packagingTxHash = null;
  await assert.rejects(f.qr.generateQRTokensForBatch(f.params), /confirmed packaging/);
  assert.equal(f.creations(), 0);
});
test('recalled and deactivated inventory cannot silently produce replacement labels', async () => {
  const f = labelFixture();
  await f.qr.generateQRTokensForBatch(f.params);
  f.tokens[0].active = false;
  await assert.rejects(f.qr.generateQRTokensForBatch(f.params), /reconciliation/);
  f.batch.recalled = true;
  await assert.rejects(f.qr.generateQRTokensForBatch(f.params), /confirmed packaging/);
  assert.equal(f.creations(), 1);
});
function verificationPage({ row = true, recalled = false, dbOffline = false, qrValid = true, matches = true, declaredMass = 25000 } = {}) {
  const batch = { ...metadata, honey_type: 'Multiflora', quantity_grams: declaredMass, metadataCID: CID,
    metadataHash: evidence.hashEvidence('metadata'), txHash: null, recalled, beekeeper: { name: 'Test farmer' },
    certificates: [], custodyEvents: [], batchCode: 'HC-TEST-01', region: 'Test',
  };
  return load('src/app/verify/page.tsx', {
    'next/link': { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) },
    'next/image': { __esModule: true, default: ({ src, alt }) => React.createElement('img', { src, alt }) },
    'next/headers': { headers: async () => new Headers() },
    '@/components/ui/theme-toggle': { ThemeToggle: () => null },
    '@/lib/db': { prisma: { honeyBatch: { findUnique: async () => {
      if (dbOffline) throw new Error('offline');
      return row ? batch : null;
    } } } },
    '@/lib/qr': { processQRScan: async () => qrValid ? { valid: true, status: 'OK' } : { valid: false, status: 'INVALID_SIGNATURE' } },
    '@/lib/blockchain': {
      getBatchFromChain: async () => matches ? { metadataCID: CID, metadataHash: batch.metadataHash, labVerified: false, recalled, quantityGrams: 25000, jarCount: 50, jarSizeGrams: 500 } : null,
      getExplorerTxUrl: () => null, getExplorerAddressUrl: () => null, getActiveContractAddress: () => null,
      getActiveNetworkName: () => 'Test network',
    },
    '@/lib/ipfs': {
      verifyMetadataIntegrity: async () => ({ valid: matches, status: matches ? 'MATCH' : 'UNAVAILABLE', metadata }),
      verifyFileIntegrity: async () => ({ valid: false, status: 'UNAVAILABLE' }),
    },
  }).default;
}
test('missing batch does not substitute a prebuilt successful demonstration', async () => {
  const Page = verificationPage({ row: false });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ b: 'HC-2026-MH01-000123' }) }));
  assert.match(html, /Batch not found/);
  assert.doesNotMatch(html, /The recorded evidence matches/);
});
test('partial QR and invalid special demo signature do not authenticate a jar', async () => {
  const Page = verificationPage({ qrValid: false });
  const partial = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ b: 'HC-TEST-01', n: 'nonce' }) }));
  assert.match(partial, /Incomplete jar label/);
  const demo = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ b: 'HC-TEST-01', n: 'nonce', sig: 'demo-hmac-signature' }) }));
  assert.match(demo, /Label could not be verified/);
});
test('batch-only lookup remains information, not serialized jar authentication', async () => {
  const Page = verificationPage();
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ b: 'HC-TEST-01' }) }));
  assert.match(html, /Batch information/);
  assert.match(html, /NOT CHECKED/);
  assert.doesNotMatch(html, /The recorded evidence matches/);
});
test('recall overrides unavailable evidence and offline database never yields success', async () => {
  const Page = verificationPage({ recalled: true, matches: false });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ b: 'HC-TEST-01' }) }));
  assert.match(html, /This batch has been recalled/);
  assert.match(html, /UNAVAILABLE/);
  const Offline = verificationPage({ dbOffline: true });
  assert.match(renderToStaticMarkup(await Offline({ searchParams: Promise.resolve({ b: 'HC-TEST-01' }) })), /temporarily unavailable/);
});
test('matching file bytes cannot validate a database mass that disagrees with the chain', async () => {
  const Page = verificationPage({ declaredMass: 250000 });
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ b: 'HC-TEST-01' }) }));
  assert.match(html, /MISMATCH/);
  assert.match(html, /do not agree/);
  assert.doesNotMatch(html, /The recorded evidence matches/);
});
