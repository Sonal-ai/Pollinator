// Local preview of the same standalone bundle used by deployment images.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(root, '.next/standalone/server.js'))) throw new Error('Run npm run build -- --webpack first.');
for (const [source, target] of [['public', '.next/standalone/public'], ['.next/static', '.next/standalone/.next/static']]) {
  fs.cpSync(path.join(root, source), path.join(root, target), { recursive: true });
}
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
process.env.NODE_ENV = 'production';
process.env.HOSTNAME = '127.0.0.1';
process.env.PORT = process.env.PORT || '3100';
require(path.join(root, '.next/standalone/server.js'));
