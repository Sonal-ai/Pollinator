// Authenticated backup envelope. Plaintext is never returned until GCM authentication succeeds.
const fs = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const MAGIC = Buffer.from('HCDB1\n');
function key(value) { if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('A 32-byte backup encryption key is required'); return Buffer.from(value, 'hex'); }
function sameIdentity(actual, expected) {
  return actual.clusterId === expected.clusterId && actual.chainId === expected.chainId
    && ['registryAddress','forwarderAddress','genesisHash'].every(name => typeof actual[name] === 'string' && actual[name].toLowerCase() === expected[name].toLowerCase());
}
function header(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const start = Buffer.alloc(10);
    if (fs.readSync(descriptor, start, 0, 10, 0) !== 10 || !start.subarray(0,6).equals(MAGIC)) throw new Error('Invalid backup format');
    const length = start.readUInt32BE(6), size = fs.fstatSync(descriptor).size;
    if (length < 2 || length > 16384 || size < 10 + length + 16) throw new Error('Invalid backup envelope length');
    const metadata = Buffer.alloc(length); if (fs.readSync(descriptor, metadata, 0, length, 10) !== length) throw new Error('Truncated backup metadata');
    const parsed = JSON.parse(metadata.toString('utf8'));
    if (parsed.version !== 1 || !/^[a-f0-9]{24}$/.test(parsed.iv || '')) throw new Error('Invalid backup metadata');
    const tag = Buffer.alloc(16); fs.readSync(descriptor, tag, 0, 16, size - 16);
    return { metadata: parsed, aad: Buffer.concat([start, metadata]), start: 10 + length, end: size - 17, tag };
  } finally { fs.closeSync(descriptor); }
}
async function encryptBackup(input, file, secret, identity) {
  const iv = randomBytes(12), metadata = { version: 1, ...identity, createdAt: new Date().toISOString(), iv: iv.toString('hex') };
  const body = Buffer.from(JSON.stringify(metadata)), prefix = Buffer.alloc(10); MAGIC.copy(prefix); prefix.writeUInt32BE(body.length, 6);
  const aad = Buffer.concat([prefix, body]), cipher = createCipheriv('aes-256-gcm', key(secret), iv); cipher.setAAD(aad);
  const output = fs.createWriteStream(file, { flags: 'wx', mode: 0o600 }); output.write(aad);
  await pipeline(input, cipher, output);
  fs.appendFileSync(file, cipher.getAuthTag());
  return metadata;
}
async function decryptBackup(file, output, secret, expected) {
  const envelope = header(file);
  if (!sameIdentity(envelope.metadata, expected)) throw new Error('Backup belongs to a different cluster, registry or chain');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(envelope.metadata.iv, 'hex'));
  decipher.setAAD(envelope.aad); decipher.setAuthTag(envelope.tag);
  let created = false;
  try {
    const target = fs.createWriteStream(output, { flags: 'wx', mode: 0o600 });
    target.once('open', () => { created = true; });
    await pipeline(fs.createReadStream(file, { start: envelope.start, end: envelope.end }), decipher, target);
    return envelope.metadata;
  } catch (error) { if (created && fs.existsSync(output)) fs.unlinkSync(output); throw error; }
}
module.exports = { encryptBackup, decryptBackup, backupHeader: file => header(file).metadata };
