require('ts-node').register({
  transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node', jsx: 'react-jsx' },
});
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { SignJWT } = require('jose');
const { hashPassword, verifyPassword } = require('../src/lib/password.ts');
const identity = require('../src/lib/identity.ts');
const policy = require('../src/lib/access-policy.ts');
const accounts = require('../src/lib/account-auth.ts');
const tokens = require('../src/lib/session-token.ts');

const walletA = '0x' + 'a'.repeat(40);
const walletB = '0x' + 'b'.repeat(40);
const password = 'correct-horse-password-2026';
const sessionA = { accountId: 'account-a', role: 'beekeeper', walletAddress: walletA, beekeeperId: 'farmer-a' };
let accountA;
before(async () => {
  process.env.JWT_SECRET = 'unit-test-only-' + 'x'.repeat(48);
  accountA = {
    id: 'account-a', identifier: 'farmer@example.test', passwordHash: await hashPassword(password),
    role: 'beekeeper', walletAddress: walletA, beekeeperId: 'farmer-a', active: true, sessionVersion: 0,
  };
});
/** Load actual route/service code with isolated I/O; no real database, cloud calls or cookies. */
function load(file, mocks) {
  const filename = path.resolve(file);
  const unit = new Module(filename, module);
  unit.filename = filename;
  unit.paths = Module._nodeModulePaths(path.dirname(filename));
  unit.require = function (specifier) {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    if (specifier === '@/lib/request-origin') return require('../src/lib/request-origin.ts');
    if (specifier === '@/lib/app-origin') return require('../src/lib/app-origin.ts');
    if (specifier === '@/lib/chain/protocol') return require('../src/lib/chain/protocol.ts');
    if (specifier === '@/lib/chain/http') return require('../src/lib/chain/http.ts');
    // These ownership tests have no prior idempotent request and must never enqueue one.
    if (specifier === '@/lib/chain/operations') return { operationService: { existing: async () => null, enqueue: () => { throw new Error('Unexpected intent write'); } } };
    if (specifier === '@/lib/batch-workflow') return require('../src/lib/batch-workflow.ts');
    if (specifier === '@/lib/productivity') return require('../src/lib/productivity.ts');
    if (specifier.startsWith('@/')) throw new Error('Unmocked application I/O: ' + specifier);
    return Module.prototype.require.call(this, specifier);
  };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  unit._compile(compiled.outputText, filename);
  return unit.exports;
}
function request(body, url = 'https://pollinator.example/api/auth/login') {
  return new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://pollinator.example', 'Idempotency-Key': 'unit-test-request' },
    body: JSON.stringify(body),
  });
}
function loginRoute({ account = accountA, allowed = true, repositoryError = false } = {}) {
  const written = [];
  const route = load('src/app/api/auth/login/route.ts', {
    'next/headers': { cookies: async () => ({ set: (...args) => written.push(args), delete() {} }) },
    '@/lib/account-auth': accounts, '@/lib/identity': identity, '@/lib/session-token': tokens,
    '@/lib/login-rate-limit': { consumeLoginAttempt: async () => allowed },
    '@/lib/db': { prisma: { dashboardAccount: { findUnique: async ({ where }) => {
      if (repositoryError) throw new Error('offline');
      return account && where.identifier === account.identifier ? account : null;
    } } } },
  });
  return { ...route, written };
}
test('salted scrypt hashes verify only the exact password, including spaces', async () => {
  const a = await hashPassword(' a-long-password-with-spaces ');
  const b = await hashPassword(' a-long-password-with-spaces ');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(' a-long-password-with-spaces ', a), true);
  assert.equal(await verifyPassword('a-long-password-with-spaces', a), false);
  assert.equal(await verifyPassword(password, 'broken-hash'), false);
  await assert.rejects(hashPassword('short'));
});
test('phone normalization supports exact Indian variants and prevents foreign suffix matching', () => {
  assert.equal(identity.normalizePhone('98765 43210'), '+919876543210');
  assert.equal(identity.normalizePhone('+91 98765-43210'), '+919876543210');
  assert.deepEqual(identity.phoneLookupVariants('919876543210'), ['+919876543210', '919876543210', '9876543210']);
  assert.deepEqual(identity.phoneLookupVariants('+449876543210'), ['+449876543210', '449876543210']);
  assert.equal(identity.normalizeLoginIdentifier(' FARMER@Example.Test '), 'farmer@example.test');
  assert.equal(identity.normalizePhone('not-a-phone'), null);
});
test('arbitrary credentials and client-supplied admin role cannot mint a session', async () => {
  const route = loginRoute();
  const response = await route.POST(request({ identifier: 'unknown@example.test', password, role: 'admin' }));
  assert.equal(response.status, 401);
  assert.equal(route.written.length, 0);
});
test('wrong password is rejected without writing cookies', async () => {
  const route = loginRoute();
  assert.equal((await route.POST(request({ identifier: accountA.identifier, password: 'incorrect-password' }))).status, 401);
  assert.equal(route.written.length, 0);
});
test('valid password ignores the requested role and resolves the stored beekeeper role', async () => {
  const route = loginRoute();
  assert.equal((await route.POST(request({ identifier: ' FARMER@EXAMPLE.TEST ', password, role: 'admin' }))).status, 200);
  assert.equal(route.written.length, 1);
  const [, signedToken, options] = route.written[0];
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.maxAge, 8 * 3600);
  const token = await tokens.verifySessionToken(signedToken);
  const current = await accounts.resolveAccountSession(token, async () => accountA);
  assert.equal(current.role, 'beekeeper');
  assert.equal(current.beekeeperId, 'farmer-a');
});
test('phone login requires a provisioned account and matching password', async () => {
  const phoneAccount = { ...accountA, identifier: '+919876543210' };
  const route = loginRoute({ account: phoneAccount });
  assert.equal((await route.POST(request({ identifier: '9876543210', role: 'beekeeper' }))).status, 400);
  assert.equal((await route.POST(request({ identifier: '+91 9876543210', password: 'wrong-password' }))).status, 401);
  assert.equal((await route.POST(request({ identifier: '9876543210', password }))).status, 200);
});
test('disabled accounts and unlinked beekeeper accounts cannot sign in', async () => {
  for (const account of [{ ...accountA, active: false }, { ...accountA, beekeeperId: null }]) {
    const route = loginRoute({ account });
    assert.equal((await route.POST(request({ identifier: account.identifier, password }))).status, 401);
    assert.equal(route.written.length, 0);
  }
});
test('login rejects malformed bodies, large bodies and cross-site origins', async () => {
  const route = loginRoute();
  assert.equal((await route.POST(request(null))).status, 400);
  assert.equal((await route.POST(request({ identifier: 42, password }))).status, 400);
  assert.equal((await route.POST(request({ identifier: accountA.identifier, password: 'x'.repeat(5000) }))).status, 413);
  const crossSite = request({ identifier: accountA.identifier, password });
  crossSite.headers.set('origin', 'https://attacker.example');
  assert.equal((await route.POST(crossSite)).status, 403);
});
test('rate limits and unavailable database fail without issuing cookies', async () => {
  const limited = loginRoute({ allowed: false });
  assert.equal((await limited.POST(request({ identifier: accountA.identifier, password }))).status, 429);
  assert.equal(limited.written.length, 0);
  const offline = loginRoute({ repositoryError: true });
  assert.equal((await offline.POST(request({ identifier: accountA.identifier, password }))).status, 503);
  assert.equal(offline.written.length, 0);
});
test('missing, example and previous default JWT keys cannot sign a session', async () => {
  const previous = process.env.JWT_SECRET;
  try {
    for (const key of [undefined, 'short', 'change_me_' + 'x'.repeat(40), 'pollinator_super_secure_jwt_secret_min_32_chars!']) {
      if (key === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = key;
      await assert.rejects(tokens.createSessionToken(accountA));
    }
  } finally { process.env.JWT_SECRET = previous; }
});
test('JWT rejects prototype cookies, wrong audience, expired tokens and tampering', async () => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const prototype = await new SignJWT({ walletAddress: walletA, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(secret);
  assert.equal(await tokens.verifySessionToken(prototype), null);
  for (const [audience, expiry] of [['wrong-app', '1h'], ['pollinator-dashboard', 1]]) {
    const token = await new SignJWT({ version: 2, sessionVersion: 0 }).setProtectedHeader({ alg: 'HS256' })
      .setIssuer('pollinator').setAudience(audience).setSubject('account-a').setExpirationTime(expiry).sign(secret);
    assert.equal(await tokens.verifySessionToken(token), null);
  }
  const valid = await tokens.createSessionToken(accountA);
  assert.equal(await tokens.verifySessionToken(valid.slice(0, -5) + 'xxxxx'), null);
});
test('account disable, password reset and role changes take effect on existing tokens', async () => {
  const token = await tokens.verifySessionToken(await tokens.createSessionToken(accountA));
  assert.equal(await accounts.resolveAccountSession(token, async () => ({ ...accountA, active: false })), null);
  assert.equal(await accounts.resolveAccountSession(token, async () => ({ ...accountA, sessionVersion: 1 })), null);
  assert.equal(await accounts.resolveAccountSession(token, async () => null), null);
  const changed = await accounts.resolveAccountSession(token, async () => ({ ...accountA, role: 'processor', beekeeperId: null }));
  assert.equal(changed.role, 'processor');
});
test('actual session loader reloads account and direct page role guard rejects unauthorized access', async () => {
  let currentAccount = { ...accountA };
  const token = await tokens.createSessionToken(accountA);
  const service = load('src/lib/auth.ts', {
    './session-token': tokens, './account-auth': accounts,
    './db': { prisma: { dashboardAccount: { findUnique: async () => currentAccount } } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
    'next/navigation': { redirect: (url) => { throw new Error('redirect:' + url); } },
  });
  assert.equal((await service.getSession()).role, 'beekeeper');
  await assert.rejects(service.requireSession(['admin']), /redirect:\/dashboard$/);
  currentAccount = { ...accountA, active: false };
  assert.equal(await service.getSession(), null);
  await assert.rejects(service.requireSession(), /redirect:\/dashboard\/login/);
});
test('ownership denies cross-farmer writes; administration does not impersonate operational actors', () => {
  const other = { beekeeperId: 'farmer-b', current_custodian: walletB, status: 'HARVESTED' };
  assert.equal(policy.canTransferBatch(sessionA, other), false);
  assert.equal(policy.canViewBatch(sessionA, other), false);
  assert.equal(policy.canManagePackaging({ ...sessionA, role: 'processor' }, other), false);
  assert.equal(policy.canAttestBatch({ ...sessionA, role: 'lab' }, other), false);
  assert.equal(policy.canTransferBatch(sessionA, { ...other, beekeeperId: 'farmer-a', current_custodian: null }), true);
  assert.equal(policy.canTransferBatch(sessionA, { ...other, current_custodian: null }), false);
  assert.equal(policy.canManagePackaging({ ...sessionA, role: 'admin' }, other), false);
  assert.equal(policy.canAttestBatch({ ...sessionA, role: 'admin' }, other), false);
  assert.equal(policy.canTransferBatch({ ...sessionA, role: 'admin' }, other), false);
  assert.equal(policy.canViewBatch({ ...sessionA, role: 'admin' }, other), true);
  assert.equal(policy.canAttestBatch({ ...sessionA, role: 'lab' }, { ...other, current_custodian: walletA.toUpperCase() }), true);
});
test('missing beekeeper links never become unrestricted hive or beekeeper queries', () => {
  const unlinked = { ...sessionA, beekeeperId: null };
  assert.deepEqual(policy.hiveScope(unlinked), { beekeeperId: { in: [] } });
  assert.deepEqual(policy.beekeeperScope(unlinked), { id: { in: [] } });
  assert.notDeepEqual(policy.batchScope(unlinked), {});
});
test('batch creation rejects another farmer before storage or chain calls', async () => {
  const route = load('src/app/api/batch/route.ts', {
    '@/lib/db': { prisma: {} }, '@/lib/auth': { getSession: async () => sessionA },
    '@/lib/access-policy': policy, '@/lib/env': { env: {} },
    '@/lib/ipfs': { uploadBatchMetadata: () => { throw new Error('Unexpected external write'); } },
    '@/lib/blockchain': {},
  });
  const response = await route.POST(request({
    beekeeperId: 'farmer-b', honeyType: 'Multiflora', quantityGrams: 25000,
    hivesHarvested: 1, harvestDate: '2026-10-20T00:00:00.000Z', region: 'Delhi',
  }));
  assert.equal(response.status, 403);
});
test('custody API rejects another owner before submitting a transaction', async () => {
  const route = load('src/app/api/custody/route.ts', {
    '@/lib/db': { prisma: { honeyBatch: { findUnique: async () => ({
      id: 'batch-b', beekeeperId: 'farmer-b', current_custodian: walletB, status: 'HARVESTED', recalled: false,
    }) } } },
    '@/lib/auth': { getSession: async () => sessionA }, '@/lib/access-policy': policy,
    '@/lib/blockchain': { transferCustodyOnChain: () => { throw new Error('Unexpected chain write'); } },
  });
  assert.equal((await route.POST(request({ batchId: 'batch-b', toAddress: walletA, newStatus: 'PROCESSED' }))).status, 403);
});
test('packaging API rejects another processor before evidence or chain writes', async () => {
  const route = load('src/app/api/batch/[batchCode]/package/route.ts', {
    '@/lib/db': { prisma: { honeyBatch: { findUnique: async () => ({
      id: 'batch-b', beekeeperId: 'farmer-b', current_custodian: walletB, recalled: false,
    }) } } },
    '@/lib/auth': { getSession: async () => ({ ...sessionA, role: 'processor' }) },
    '@/lib/access-policy': policy, '@/lib/blockchain': {}, '@/lib/ipfs': {},
  });
  assert.equal((await route.POST(request({ jarCount: 50, jarSizeGrams: 500 }), {
    params: Promise.resolve({ batchCode: 'BATCH-B' }),
  })).status, 403);
});
test('private label export refuses anonymous requests and another processor', async () => {
  let session = null;
  const route = load('src/app/api/qr/route.ts', {
    '@/lib/auth': { getSession: async () => session }, '@/lib/access-policy': policy,
    '@/lib/qr': {}, '@/lib/db': { prisma: { honeyBatch: { findUnique: async () => ({
      beekeeperId: 'farmer-b', current_custodian: walletB, qrTokens: [{ nonce: 'private', signature: 'private' }],
    }) } } },
  });
  const req = { nextUrl: new URL('https://pollinator.example/api/qr?batchCode=BATCH-B') };
  assert.equal((await route.GET(req)).status, 401);
  session = { ...sessionA, role: 'processor' };
  const denied = await route.GET(req);
  assert.equal(denied.status, 403);
  assert.equal((await denied.text()).includes('signature'), false);
});
test('local login limiter counts normalized identities; production without Redis fails closed', async () => {
  const previousMode = process.env.NODE_ENV;
  const previousRedis = process.env.REDIS_URL;
  const limiter = require('../src/lib/login-rate-limit.ts');
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_URL;
    for (let i = 0; i < 10; i++) assert.equal(await limiter.consumeLoginAttempt('bounded@example.test'), true);
    assert.equal(await limiter.consumeLoginAttempt('bounded@example.test'), false);
    process.env.NODE_ENV = 'production';
    await assert.rejects(limiter.consumeLoginAttempt('bounded@example.test'), /unavailable/);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousMode;
    if (previousRedis === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = previousRedis;
  }
});

function matches(row, where = {}) {
  return Object.entries(where).every(([field, value]) => {
    if (field === 'AND') return value.every((part) => matches(row, part));
    if (field === 'OR') return value.some((part) => matches(row, part));
    if (value === null || typeof value !== 'object') return row[field] === value;
    if (value.in) return value.in.includes(row[field]);
    if (Object.hasOwn(value, 'equals')) return value.mode === 'insensitive'
      ? String(row[field]).toLowerCase() === value.equals.toLowerCase() : row[field] === value.equals;
    throw new Error('Unsupported test query: ' + field);
  });
}
test('private batch detail cannot return another owner through a direct API URL', async () => {
  const row = { id: 'batch-b', batchCode: 'BATCH-B', beekeeperId: 'farmer-b', current_custodian: walletB };
  const route = load('src/app/api/batch/[batchCode]/route.ts', {
    '@/lib/auth': { getSession: async () => sessionA }, '@/lib/access-policy': policy,
    '@/lib/db': { prisma: { honeyBatch: { findFirst: async ({ where }) => matches(row, where) ? row : null } } },
    '@/lib/blockchain': { getBatchFromChain: async () => null, getExplorerTxUrl: () => null },
  });
  assert.equal((await route.GET({}, { params: Promise.resolve({ batchCode: 'BATCH-B' }) })).status, 404);
});
test('private batch listing applies account scope to the rows and pagination count', async () => {
  const rows = [
    { id: 'batch-a', beekeeperId: 'farmer-a', current_custodian: walletA },
    { id: 'batch-b', beekeeperId: 'farmer-b', current_custodian: walletB },
  ];
  const route = load('src/app/api/batch/route.ts', {
    '@/lib/auth': { getSession: async () => sessionA }, '@/lib/access-policy': policy,
    '@/lib/db': { prisma: { honeyBatch: {
      findMany: async ({ where }) => rows.filter((row) => matches(row, where)),
      count: async ({ where }) => rows.filter((row) => matches(row, where)).length,
    } } },
    '@/lib/ipfs': { computeFileHash: () => '0x' + 'a'.repeat(64) }, '@/lib/blockchain': {},
  });
  const response = await route.GET({ nextUrl: new URL('https://pollinator.example/api/batch') });
  const result = await response.json();
  assert.deepEqual(result.batches.map((row) => row.id), ['batch-a']);
  assert.equal(result.pagination.total, 1);
});
test('telemetry API denies another farmer and returns only the linked farmer device', async () => {
  const row = { id: 'hive-b', deviceId: 'DEVICE-B', beekeeperId: 'farmer-b' };
  let session = sessionA;
  const route = load('src/app/api/iot/[hiveId]/route.ts', {
    '@/lib/auth': { getSession: async () => session }, '@/lib/access-policy': policy,
    '@/lib/db': { prisma: {
      hive: { findFirst: async ({ where }) => matches(row, where) ? row : null },
      sensorReading: { findMany: async () => [] },
    } },
  });
  const req = { nextUrl: new URL('https://pollinator.example/api/iot/DEVICE-B') };
  const context = { params: Promise.resolve({ hiveId: 'DEVICE-B' }) };
  assert.equal((await route.GET(req, context)).status, 404);
  session = { ...sessionA, beekeeperId: 'farmer-b', walletAddress: walletB };
  assert.equal((await route.GET(req, context)).status, 200);
  session = null;
  assert.equal((await route.GET(req, context)).status, 401);
});
test('laboratory upload cannot attest a batch held by another lab', async () => {
  const route = load('src/app/api/certificate/route.ts', {
    '@/lib/auth': { getSession: async () => ({ ...sessionA, role: 'lab' }) },
    '@/lib/access-policy': policy, '@/lib/env': { env: {} },
    '@/lib/db': { prisma: { honeyBatch: { findUnique: async () => ({
      id: 'batch-b', beekeeperId: 'farmer-b', current_custodian: walletB, recalled: false,
    }) } } },
    '@/lib/ipfs': { computeFileHash: () => '0x' + 'a'.repeat(64) }, '@/lib/blockchain': {},
  });
  const body = new FormData();
  body.set('batchId', 'batch-b');
  body.set('file', new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), 'sample.pdf');
  assert.equal((await route.POST(new Request('https://pollinator.example/api/certificate', { method: 'POST', headers: { 'Idempotency-Key': 'unit-test-request' }, body }))).status, 403);
});
function whatsappFixture({ sender = '919876543210', state = 'MAIN_MENU', registered = true } = {}) {
  const sent = [];
  const hiveQueries = [];
  const farmer = { id: 'farmer-a', phone: '+919876543210', name: 'Farmer A', hives: [] };
  const fsm = {
    isDuplicateMessage: async () => false,
    getSession: async () => ({ state, data: { language: 'en', beekeeper_id: 'farmer-b' } }),
    setSession: async () => {}, updateSessionData: async () => {},
  };
  const route = load('src/lib/whatsapp/handler.ts', {
    '../identity': identity,
    '../db': { prisma: {
      beekeeper: { findMany: async ({ where }) =>
        registered && where.phone.in.includes(farmer.phone) ? [farmer] : [] },
      hive: {
        findMany: async ({ where }) => { hiveQueries.push(where); return []; },
        findUnique: async () => ({ id: 'hive-b', beekeeperId: 'farmer-b' }),
        upsert: async () => { throw new Error('Unexpected device reassignment'); },
        create: async () => { throw new Error('Unexpected device creation'); },
      },
    } },
    './fsm': { fsm, ConversationState: new Proxy({}, { get: (_, key) => key }) },
    './gemini': {
      analyzeIncomingText: async () => ({ detected_language: 'en', intent: state === 'REGISTER_HIVE' ? 'UNKNOWN' : 'HIVE_STATUS' }),
      generateOnboardingResponse: async () => ({ response: 'Please register', ready_to_register: false }),
    },
    './client': { whatsapp: {
      markAsRead: async () => {},
      sendText: async (...args) => sent.push(args),
      sendButtons: async (...args) => sent.push(args),
      sendList: async (...args) => sent.push(args),
      downloadMedia: async () => { throw new Error('Unexpected paid/remote inference'); },
    } },
    '../blockchain': {}, '../varroa-detector': {},
  });
  return {
    sent, hiveQueries,
    run: (type = 'text') => route.handleIncomingMessage({
      entry: [{ changes: [{ value: { messages: [{
        id: 'message-a', from: sender, type,
        text: { body: state === 'REGISTER_HIVE' ? 'DEVICE-B' : 'hive status' },
        image: type === 'image' ? { id: 'image-a' } : undefined,
      }] } }] }],
    }),
  };
}
test('WhatsApp hive status ignores stale FSM identity and scopes to the authenticated sender', async () => {
  const fixture = whatsappFixture();
  await fixture.run();
  assert.deepEqual(fixture.hiveQueries, [{ beekeeperId: { in: ['farmer-a'] } }]);
  assert.ok(fixture.sent.some(([, text]) => text.includes('No hives are assigned')));
  assert.ok(!fixture.sent.some(([, text]) => text.includes('100% OPTIMAL')));
});
test('unregistered and foreign WhatsApp senders cannot inherit a local demo farmer', async () => {
  for (const options of [{ registered: false }, { sender: '449876543210' }]) {
    const fixture = whatsappFixture(options);
    await fixture.run();
    assert.deepEqual(fixture.hiveQueries, []);
    assert.ok(fixture.sent.some(([, text]) => text.includes('Please register')));
  }
});
test('unknown WhatsApp image sender is asked to register before downloading or invoking inference', async () => {
  const fixture = whatsappFixture({ registered: false });
  await fixture.run('image');
  assert.ok(fixture.sent.some(([, text]) => text.includes('register your own')));
});
test('WhatsApp device pairing refuses to reassign another beekeeper device', async () => {
  const fixture = whatsappFixture({ state: 'REGISTER_HIVE' });
  await fixture.run();
  assert.ok(fixture.sent.some(([, text]) => text.includes('belongs to another beekeeper')));
});

test('sign-out requires same-origin POST and ignores untrusted forwarded-host redirects', async () => {
  const route = load('src/app/api/auth/logout/route.ts', {});
  const get = await route.GET();
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  const bad = request({}, 'https://pollinator.example/api/auth/logout');
  bad.headers.set('origin', 'https://attacker.example');
  assert.equal((await route.POST(bad)).status, 403);
  const good = request({}, 'https://pollinator.example/api/auth/logout');
  good.headers.set('x-forwarded-host', 'attacker.example');
  const response = await route.POST(good);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://pollinator.example/dashboard/login');
  assert.match(response.headers.get('set-cookie'), /pollinator_session=/);
});
test('unauthenticated custody request is rejected before querying a private batch', async () => {
  const route = load('src/app/api/custody/route.ts', {
    '@/lib/db': { prisma: {} }, '@/lib/auth': { getSession: async () => null },
    '@/lib/access-policy': policy, '@/lib/blockchain': {},
  });
  assert.equal((await route.POST(request({ batchId: 'private', toAddress: walletA, newStatus: 'PROCESSED' }))).status, 401);
});
