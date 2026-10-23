const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) {
    process.exit(result.status || 1);
  }
}
run(process.execPath, ['scripts/build-firmware-host.cjs']);
run(process.execPath, ['--test', 'test/firmware-core.test.cjs']);
run(process.env.HONEYCHAIN_PYTHON || 'python', ['-m', 'unittest', 'discover', '-s', 'firmware/test', '-p', 'test_*.py', '-v']);
