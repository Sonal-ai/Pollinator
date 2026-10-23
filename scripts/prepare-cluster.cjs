// Creates an isolated, private draft. It does not deploy, invent a registry address or overwrite a cluster.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
const clusterId = option('id'), appUrl = option('url');
if (!clusterId || !/^[a-z][a-z0-9-]{2,39}$/.test(clusterId) || !appUrl) throw new Error('Use --id cluster-slug --url https://your-application-origin');
const origin = new URL(appUrl);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Choose an HTTPS origin without credentials, path, query or fragment');
const project = path.resolve(__dirname, '..'), base = path.join(project, '.local-data', 'clusters');
fs.mkdirSync(base, { recursive: true });
const root = path.join(base, clusterId);
fs.mkdirSync(root); // Refuse existing directories; never rotate somebody's credentials implicitly.
const dir = path.join(root, 'secrets'); fs.mkdirSync(dir, { mode: 0o700 });
const secret = () => randomBytes(32).toString('hex');
const write = (name, value) => fs.writeFileSync(path.join(dir, name), value + '\n', { mode: 0o600, flag: 'wx' });
const admin = secret(), migration = secret(), app = secret(), redis = secret();
write('postgres_password', admin); write('redis_password', redis);
write('app_database_url', 'postgresql://honeychain_app:' + app + '@postgres:5432/honeychain?schema=public&connection_limit=10&pool_timeout=5');
write('migration_database_url', 'postgresql://honeychain_migrator:' + migration + '@postgres:5432/honeychain?schema=public');
write('redis_url', 'redis://:' + redis + '@redis:6379/0');
write('jwt_secret', secret()); write('qr_secret', secret()); write('device_encryption_key', secret()); write('backup_encryption_key', secret());
write('whatsapp_service_key', secret());
write('redis.conf', 'bind 0.0.0.0\nprotected-mode yes\nrequirepass ' + redis + '\nappendonly yes\ndir /data\n');
write('database_init.sql', `REVOKE ALL ON DATABASE honeychain FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE ROLE honeychain_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${migration}';
CREATE ROLE honeychain_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 60 PASSWORD '${app}';
GRANT CONNECT ON DATABASE honeychain TO honeychain_migrator, honeychain_app;
GRANT USAGE, CREATE ON SCHEMA public TO honeychain_migrator;
GRANT USAGE ON SCHEMA public TO honeychain_app;
ALTER DEFAULT PRIVILEGES FOR ROLE honeychain_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO honeychain_app;
ALTER DEFAULT PRIVILEGES FOR ROLE honeychain_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO honeychain_app;`);
const normalize = value => value.replaceAll('\\', '/');
const config = { CLUSTER_ID: clusterId, NEXT_PUBLIC_APP_URL: origin.origin, PROJECT_DIR: normalize(project), SECRET_DIR: normalize(dir),
  WEB_IMAGE: 'localhost/honeychain-web:local-review', WORKER_IMAGE: 'localhost/honeychain-worker:local-review', MIGRATOR_IMAGE: 'localhost/honeychain-migrator:local-review',
  CONTRACT_ADDRESS: '', REGISTRY_FORWARDER_ADDRESS: '', REGISTRY_GENESIS_HASH: '', POLYGON_RPC_URL: '', LISTEN_IP: '127.0.0.1', WEB_TLS_PORT: '8443', MQTT_TLS_PORT: '8883' };
fs.writeFileSync(path.join(root, 'stack.env'), Object.entries(config).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n', { mode: 0o600 });
fs.writeFileSync(path.join(root, 'PENDING.md'), '# Private cluster draft\n\nGenerated secrets are local only. Before startup, supply a verified registry v2/forwarder/genesis/RPC, a separate unprivileged relayer key, valid web TLS certificate/key, and MQTT CA/server/bridge certificates if enabling IoT. Pin image digests for release. No institution, beneficiary, partnership or pilot data was created.\n');
console.log('Private cluster draft created at .local-data/clusters/' + clusterId + '. Registry, relayer and TLS configuration remain pending. No service was started.');
