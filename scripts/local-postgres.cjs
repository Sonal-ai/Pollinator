// Isolated PostgreSQL for development/integration tests; never changes a system service.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const base = path.join(root, '.local-data');
const data = path.join(base, 'postgres-integration');
const bin = path.join(root, '.local-tools/postgresql-17.11/pgsql/bin');
if (!data.startsWith(root + path.sep)) throw new Error('Unexpected database path');
if (!fs.existsSync(path.join(bin, 'pg_ctl.exe'))) throw new Error('The official PostgreSQL Windows archive must be extracted into .local-tools/postgresql-17.11 first. See the local integration documentation.');
fs.mkdirSync(base, { recursive: true });
const envFile = path.join(root, '.env.integration');
let config = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : null;
if (!config) {
  const inherited = dotenv.parse(fs.readFileSync(path.join(root, '.env')));
  const password = crypto.randomBytes(32).toString('hex');
  config = { ...inherited, DATABASE_URL: `postgresql://pollinator_test:${password}@127.0.0.1:55432/pollinator_integration?schema=public`,
    BLOCKCHAIN_NETWORK: 'local', LOCAL_RPC_URL: 'http://127.0.0.1:8545', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100' };
  delete config.LOCAL_CONTRACT_ADDRESS;
  fs.writeFileSync(envFile, Object.entries(config).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n');
}
const url = new URL(config.DATABASE_URL);
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/pollinator_integration') throw new Error('The integration database configuration must stay on its dedicated localhost port and name.');
const childEnv = { ...process.env, PGPASSWORD: decodeURIComponent(url.password) };
function run(name, args, allowFailure = false) {
  const result = spawnSync(path.join(bin, name + '.exe'), args, { cwd: root, env: childEnv, encoding: 'utf8', windowsHide: true,
    ...(name === 'pg_ctl' && args.includes('start') ? { stdio: 'ignore' } : {}) });
  if (result.status !== 0 && !allowFailure) throw new Error((result.stderr || result.stdout || 'PostgreSQL command failed').trim());
  return result;
}
const command = process.argv[2] || 'start';
if (command === 'stop') {
  run('pg_ctl', ['-D', data, 'stop', '-m', 'fast']); console.log('Stopped the project integration PostgreSQL instance.');
} else if (command === 'status') {
  const result = run('pg_ctl', ['-D', data, 'status'], true); console.log(result.status === 0 ? 'Project PostgreSQL is running.' : 'Project PostgreSQL is stopped.');
} else if (command === 'start') {
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(base, 'postgres-init-password');
    fs.writeFileSync(passwordFile, decodeURIComponent(url.password) + '\n');
    try { run('initdb', ['-D', data, '-U', 'pollinator_test', '--encoding=UTF8', '--locale=C', '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--pwfile=' + passwordFile]); }
    finally { fs.unlinkSync(passwordFile); }
  }
  if (run('pg_ctl', ['-D', data, 'status'], true).status !== 0) run('pg_ctl', ['-D', data, '-l', path.join(base, 'postgres-integration.log'), '-o', '-h 127.0.0.1 -p 55432 -c max_connections=30 -c shared_buffers=64MB', 'start', '-w']);
  const exists = run('psql', ['-h', '127.0.0.1', '-p', '55432', '-U', 'pollinator_test', '-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname='pollinator_integration'"]);
  if (exists.stdout.trim() !== '1') run('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'pollinator_test', 'pollinator_integration']);
  console.log('Project PostgreSQL is ready on 127.0.0.1:55432. Private credentials are in the ignored .env.integration file.');
} else throw new Error('Use start, status or stop.');
