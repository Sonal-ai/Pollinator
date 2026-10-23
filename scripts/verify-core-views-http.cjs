// Server-rendered view acceptance only. This does not execute client JavaScript or inspect layout.
const fs = require('node:fs');
const assert = require('node:assert/strict');
require('dotenv').config({ path: '.env.integration', override: true, quiet: true });
const database = new URL(process.env.DATABASE_URL || '');
assert.equal(database.hostname, '127.0.0.1');
assert.equal(database.port, '55432');
assert.equal(database.pathname, '/pollinator_integration');
const base = 'http://127.0.0.1:3100';
const accounts = JSON.parse(fs.readFileSync('.local-data/local-demo-accounts.json'));
const activeBatchCode = process.argv[2];
if (activeBatchCode) assert.match(activeBatchCode, /^[A-Za-z0-9-]{1,100}$/);
const record = { checkedAt: new Date().toISOString(), scope: 'Production localhost server-rendered core views and navigation authorization', browserInspected: false, clientJavaScriptExecuted: false, passed: false, checks: [] };
let current = 'startup';
async function request(path, cookie, body) {
  const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(30000),
    method: body ? 'POST' : 'GET', headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { response, html: await response.text() };
}
async function view(path, cookie, expected) {
  current = path;
  const { response, html } = await request(path, cookie);
  assert.equal(response.status, 200, current);
  assert.ok(html.includes(expected), 'Missing expected view text at ' + path);
  assert.ok(!html.includes('Application error: a server-side exception'), 'Server render failed at ' + path);
  record.checks.push(path);
}
(async () => {
  try {
    await view('/', undefined, 'Good honey.');
    await view('/dashboard/login', undefined, 'Pollinator Portal');
    await view('/verify', undefined, 'A valid batch code is required');
    await view('/verify?b=HC-DEMO&n=incomplete', undefined, 'Incomplete jar label');
    for (const role of ['beekeeper', 'processor', 'lab', 'distributor', 'retailer', 'admin']) {
      current = 'login ' + role;
      const { identifier, password } = accounts[role];
      const login = await request('/api/auth/login', undefined, { identifier, password });
      assert.equal(login.response.status, 200, current);
      const cookie = login.response.headers.get('set-cookie')?.split(';')[0];
      assert.ok(cookie);
      for (const [path, title] of [['/dashboard', 'Batch Registry'], ['/dashboard/operations', 'Operations'], ['/dashboard/custody', 'Custody Transfer Protocol']]) {
        await view(path, cookie, title);
      }
      if (activeBatchCode && ['admin', 'beekeeper'].includes(role)) {
        current = role + ' recall control without a scan alert';
        const dossier = await request('/dashboard/batch/' + activeBatchCode, cookie);
        assert.equal(dossier.response.status, 200);
        assert.ok(dossier.html.includes('Blockchain status') && dossier.html.includes('Hardhat Localhost'));
        assert.equal(dossier.html.includes('Prepare recall'), role === 'admin');
        record.checks.push(current);
      }
      const panels = [
        ['/dashboard/lab', 'QA Laboratory Portal', ['admin', 'lab']],
        ['/dashboard/processor', 'Packaging', ['admin', 'processor']],
        ['/dashboard/recall', 'Recall &amp; Anomaly Management', ['admin']],
        ['/dashboard/analytics', 'Scan', ['admin']],
      ];
      for (const [path, title, allowed] of panels) {
        if (allowed.includes(role)) { await view(path, cookie, title); continue; }
        current = role + ' denied ' + path;
        const denied = await request(path, cookie);
        // Next can stream the redirect instruction after beginning a 200 response.
        assert.ok(denied.response.status === 307 || (denied.response.status === 200 && denied.html.includes('NEXT_REDIRECT')), current);
        assert.ok((denied.response.headers.get('location') || denied.html).includes('/dashboard'), current);
        record.checks.push(current);
      }
      const logout = await request('/api/auth/logout', cookie, {});
      assert.ok([200, 303, 307].includes(logout.response.status));
    }
    record.passed = true;
  } catch (error) { record.failedAt = current; record.failure = error.message; process.exitCode = 1; }
  finally {
    fs.writeFileSync('docs/qa/core-views-http.json', JSON.stringify(record, null, 2) + '\n');
    console.log(JSON.stringify({ passed: record.passed, checks: record.checks.length, failedAt: record.failedAt, failure: record.failure }));
  }
})();
