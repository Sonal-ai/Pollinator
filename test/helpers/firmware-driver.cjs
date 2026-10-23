const path = require('node:path');
const { spawn } = require('node:child_process');

// A process-level harness for the shared C++ journal, never a USB connection.
class FirmwareDriver {
  constructor() {
    this.waiters = [];
    this.buffer = '';
    this.closed = false;
    const binary = path.resolve('.local-data/firmware-host', process.platform === 'win32' ? 'core-driver.exe' : 'core-driver');
    this.child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      if (this.buffer.length > 65536) return this.fail();
      let newline;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline);
        this.buffer = this.buffer.slice(newline + 1);
        const waiter = this.waiters.shift();
        if (!waiter) return this.fail();
        clearTimeout(waiter.timer);
        try { waiter.resolve(JSON.parse(line)); }
        catch { waiter.reject(new Error('Invalid host firmware response')); this.fail(); return; }
      }
    });
    this.child.on('error', () => this.fail());
    this.child.stdin.on('error', () => this.fail());
    this.child.on('close', () => this.fail());
  }
  fail() {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Host firmware driver failed or timed out'));
    }
    if (this.child.exitCode === null) this.child.kill();
  }
  call(op, extra = {}) {
    if (this.closed) return Promise.reject(new Error('Host firmware driver is closed'));
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, timer: setTimeout(() => this.fail(), 15000) };
      this.waiters.push(waiter);
      this.child.stdin.write(JSON.stringify({ op, ...extra }) + '\n');
    });
  }
  async close() {
    if (this.child.exitCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => this.child.kill(), 3000);
      this.child.once('close', () => { clearTimeout(timer); resolve(); });
      this.child.stdin.end();
    });
  }
}
module.exports = { FirmwareDriver };
