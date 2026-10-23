// Next.js explicitly copies loaded .env files into standalone output. Ship runtime secrets separately.
const fs = require('node:fs');
const path = require('node:path');
const project = fs.realpathSync(path.resolve(__dirname, '..'));
const output = path.join(project, '.next', 'standalone');
if (!fs.existsSync(output)) throw new Error('Standalone build output is missing');
const resolved = fs.realpathSync(output);
if (!resolved.toLowerCase().startsWith((path.join(project, '.next') + path.sep).toLowerCase())) throw new Error('Standalone output resolved outside this project build directory');
let removed = 0;
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue; // Never follow junctions into source or another checkout.
    if (entry.isDirectory()) {
      if (['.local-data', '.local-tools', '.aws'].includes(entry.name)) throw new Error('Private development data was traced into the release output');
      visit(file);
    } else if (entry.isFile() && /^\.env(?:\.|$)/.test(entry.name)) {
      fs.unlinkSync(file); removed++;
    }
  }
}
visit(output);
console.log('Standalone release check passed; removed ' + removed + ' copied environment file(s). Supply secrets at runtime.');
