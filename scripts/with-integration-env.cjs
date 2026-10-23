// All integration commands are confined to the project's dedicated localhost database.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env.integration'), override: true, quiet: true });
const url = new URL(process.env.DATABASE_URL || '');
if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/pollinator_integration') throw new Error('Integration commands require the dedicated local database.');
const [target, ...args] = process.argv.slice(2);
const file = target === 'prisma' ? require.resolve('prisma/build/index.js') : path.resolve(root, target || '');
if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) throw new Error('Choose a project-local script.');
const result = spawnSync(process.execPath, [file, ...args], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
process.exitCode = result.status ?? 1;
