/* Trusted operator CLI: never expose this script through a web endpoint. */
require('dotenv').config({ quiet: true });
require('ts-node').register({
  transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' },
});
const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');
const { hashPassword } = require('../src/lib/password.ts');
const { normalizeLoginIdentifier, normalizePhone } = require('../src/lib/identity.ts');
const { isRole } = require('../src/lib/access-policy.ts');
const { enrollBeekeeperAccount, BeekeeperEnrollmentError } = require('../src/lib/beekeeper-enrollment.ts');
const readline = require('node:readline');
const prisma = new PrismaClient();

class SetupError extends Error {}

function argumentsFrom(argv) {
  const flags = new Set(['--identifier', '--role', '--wallet', '--beekeeper-id']);
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--enroll-beekeeper') { result.enrollBeekeeper = true; continue; }
    if (flag === '--disable') { result.disable = true; continue; }
    if (!flags.has(flag) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new SetupError('Use --identifier, --role, --wallet, optional --beekeeper-id and --enroll-beekeeper, or --identifier with --disable.');
    }
    result[flag.slice(2)] = argv[++i];
  }
  return result;
}
function maskedPassword(prompt) {
  if (!process.stdin.isTTY) throw new SetupError('Use an interactive terminal or set POLLINATOR_ACCOUNT_PASSWORD in a protected environment.');
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    function done(error) {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    }
    function onKey(character, key = {}) {
      if (key.ctrl && key.name === 'c') return done(new SetupError('Cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return done();
      if (key.name === 'backspace') {
        if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
      } else if (character && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(character)) {
        value += character;
        process.stdout.write('*'.repeat(character.length));
      }
    }
    process.stdin.on('keypress', onKey);
    process.stdin.resume();
  });
}
async function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const identifier = normalizeLoginIdentifier(args.identifier || '');
  if (!identifier) throw new SetupError('Provide a valid email or international phone identifier.');
  if (args.enrollBeekeeper && (args.disable || args.role !== 'beekeeper')) throw new SetupError('--enroll-beekeeper requires the beekeeper role and cannot disable an account.');
  if (args.disable) {
    await prisma.dashboardAccount.update({
      where: { identifier }, data: { active: false, sessionVersion: { increment: 1 } },
    });
    console.log('Account disabled. Existing sessions are revoked.');
    return;
  }
  if (!isRole(args.role)) throw new SetupError('Provide a valid --role: admin, beekeeper, processor, lab, distributor, retailer.');
  if (!args.wallet || !ethers.isAddress(args.wallet) || args.wallet === ethers.ZeroAddress) {
    throw new SetupError('Provide the actor wallet using --wallet.');
  }
  const walletAddress = args.wallet.toLowerCase();
  const beekeeperId = args['beekeeper-id'] || null;
  if (args.role === 'beekeeper' && !beekeeperId) throw new SetupError('Beekeeper accounts require --beekeeper-id.');
  if (args.role !== 'beekeeper' && beekeeperId) throw new SetupError('Only beekeeper accounts can link a beekeeper record.');
  if (beekeeperId) {
    const beekeeper = await prisma.beekeeper.findUnique({ where: { id: beekeeperId } });
    if (!beekeeper || (!args.enrollBeekeeper && beekeeper.wallet?.toLowerCase() !== walletAddress)) {
      throw new SetupError('The beekeeper record must exist and have this wallet. Reconcile the record before provisioning.');
    }
    if (identifier.startsWith('+') && normalizePhone(beekeeper.phone) !== identifier) {
      throw new SetupError('The phone identifier must match the linked beekeeper.');
    }
  }
  let password = process.env.POLLINATOR_ACCOUNT_PASSWORD;
  delete process.env.POLLINATOR_ACCOUNT_PASSWORD;
  if (!password) {
    password = await maskedPassword('New password (at least 12 characters): ');
    const confirmation = await maskedPassword('Confirm password: ');
    if (password !== confirmation) throw new SetupError('Passwords do not match.');
  }
  let passwordHash;
  try { passwordHash = await hashPassword(password); }
  catch { throw new SetupError('Use a password of at least 12 characters and at most 1024 UTF-8 bytes.'); }
  password = undefined;
  if (args.enrollBeekeeper) {
    const { ChainTransport } = require('../src/lib/chain/transport.ts');
    const chain = new ChainTransport();
    try {
      const account = await enrollBeekeeperAccount(prisma, chain, { identifier, beekeeperId, walletAddress, passwordHash });
      console.log('Beekeeper wallet enrollment and account saved atomically: ' + account.id + '. Chain role verified; no transaction broadcast. Previous sessions revoked on reset.');
      return;
    } finally { chain.provider.destroy(); }
  }
  const data = { passwordHash, role: args.role, walletAddress, beekeeperId, active: true };
  const account = await prisma.dashboardAccount.upsert({
    where: { identifier },
    create: { identifier, ...data },
    update: { ...data, sessionVersion: { increment: 1 } },
    select: { id: true, role: true },
  });
  console.log('Account provisioned: ' + account.id + ' (' + account.role + '). Prior sessions have been invalidated on reset.');
}
main().catch((error) => {
  console.error(error instanceof SetupError || error instanceof BeekeeperEnrollmentError ? error.message : 'Account setup failed. Check the schema, database/registry connection, and unique account bindings.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
