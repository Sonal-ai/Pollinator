// Production images load mounted secrets before importing the application or worker.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadRuntimeSecrets, validateRuntimeService } = require('./runtime-config.cjs');
const root = path.resolve(__dirname, '..');
let deployment;
(async () => {
  loadRuntimeSecrets();
  const action = process.argv[2] || 'web';
  validateRuntimeService(action);
  if (action === 'migrate') {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd: root, env: process.env, stdio: 'inherit' });
    process.exitCode = result.status ?? 1; return;
  }
  deployment = require('../build/workers/workers/deployment.js');
  if (action === 'bind') { await deployment.initializeDeployment(); console.log('Live registry checked; database cluster identity bound without overwriting another deployment.'); return; }
  if (action === 'check') { await deployment.validateDeployment(); console.log('Database deployment identity matches the configured cluster.'); return; }
  if (!['web','chain','mqtt','whatsapp'].includes(action)) throw new Error('Unknown release service');
  await deployment.checkDeployment();
  if (action === 'web') { await deployment.disconnectDeployment(); require('../server.js'); }
  else require('../build/workers/workers/' + action + '.js');
})().catch(async () => { console.error('Release startup refused: configuration, mounted secret or database cluster identity is invalid.'); process.exitCode = 1; if (deployment) await deployment.disconnectDeployment(); });
