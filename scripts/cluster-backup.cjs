// Explicit operator command. Backup is encrypted; restore refuses a nonempty or foreign target.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');
const { encryptBackup, decryptBackup, backupHeader } = require('./backup-crypto.cjs');
const args = process.argv.slice(2), action = args[0];
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? undefined : args[index + 1]; };
const id = option('id'), engine = option('engine') || 'podman';
if (!['backup','restore'].includes(action) || !id || !/^[a-z][a-z0-9-]{2,39}$/.test(id) || !['podman','docker'].includes(engine)) throw new Error('Use backup|restore --id cluster-slug [--engine podman|docker]; restore also needs --file and --project honeychain-restore-...');
const root = path.resolve(__dirname, '..'), configFile = path.join(root, '.local-data/clusters', id, 'stack.env');
const config = require('dotenv').parse(fs.readFileSync(configFile));
if (config.CLUSTER_ID !== id) throw new Error('Cluster configuration does not match its folder');
const expected = { clusterId: id, chainId: Number(config.REGISTRY_CHAIN_ID || 80002), registryAddress: config.CONTRACT_ADDRESS, forwarderAddress: config.REGISTRY_FORWARDER_ADDRESS, genesisHash: config.REGISTRY_GENESIS_HASH };
if (!expected.registryAddress || !expected.forwarderAddress || !expected.genesisHash) throw new Error('A verified deployment configuration is required before backup');
const project = option('project') || 'honeychain-' + id;
if (!/^[a-z][a-z0-9_-]{2,100}$/.test(project)) throw new Error('Invalid project name');
if (action === 'restore' && !project.startsWith('honeychain-restore-')) throw new Error('Restore requires an explicitly separate honeychain-restore-... project');
const secret = fs.readFileSync(option('key-file') || path.join(config.SECRET_DIR, 'backup_encryption_key'), 'utf8').trim();
const childEnvironment = { ...process.env }; for (const key of Object.keys(config)) delete childEnvironment[key];
const projectLabel = engine === 'podman' ? 'io.podman.compose.project' : 'com.docker.compose.project';
const discovery = spawnSync(engine,['ps','--filter','label='+projectLabel+'='+project,'--filter','label=com.docker.compose.service=postgres','--format','{{.ID}}'],{cwd:root,env:childEnvironment,encoding:'utf8',windowsHide:true});
const containerId = (discovery.stdout || '').trim();
if (discovery.status !== 0 || !/^[a-f0-9]{12,64}$/.test(containerId)) throw new Error('Exactly one running PostgreSQL container in the named project is required');
function command(parameters, settings = {}) {
  const result = spawnSync(engine,['exec','-i',containerId,...parameters],{cwd:root,env:childEnvironment,encoding:'utf8',windowsHide:true,...settings});
  if (result.status !== 0) throw new Error('Container backup/restore command failed. Inspect the operator service status; credentials were not printed.');
  return result.stdout.trim();
}
const sql = query => command(['psql','-U','cluster_admin','-d','honeychain','-tAc',query]);
const folder = path.join(root,'.local-data/backups',id); fs.mkdirSync(folder,{recursive:true,mode:0o700});
let temporary;
(async()=>{
  try {
    if (action === 'backup') {
      const binding = JSON.parse(sql('SELECT row_to_json(d)::text FROM "DeploymentIdentity" d WHERE id=\'primary\''));
      if (binding.clusterId !== expected.clusterId || binding.chainId !== expected.chainId || ['registryAddress','forwarderAddress','genesisHash'].some(key=>binding[key].toLowerCase()!==expected[key].toLowerCase())) throw new Error('Source database is not bound to this cluster');
      const file = path.join(folder,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8)+'.hcbackup'); temporary=file+'.partial';
      const child = spawn(engine,['exec',containerId,'pg_dump','-U','cluster_admin','-Fc','--no-owner','--no-acl','honeychain'],{cwd:root,env:childEnvironment,stdio:['ignore','pipe','pipe'],windowsHide:true});
      child.stderr.on('data',()=>{}); // Provider diagnostics never enter the backup stream or expose secrets.
      const closed = new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>code===0?resolve():reject(new Error('Database dump failed')));});
      try { await Promise.all([encryptBackup(child.stdout,temporary,secret,expected),closed]); } catch(error) { child.kill(); throw error; }
      fs.renameSync(temporary,file); temporary=undefined;
      const checksum = createHash('sha256'); for await(const chunk of createReadStream(file))checksum.update(chunk);
      fs.writeFileSync(file+'.json',JSON.stringify({...backupHeader(file),sha256:checksum.digest('hex')},null,2)+'\n',{mode:0o600,flag:'wx'});
      console.log(JSON.stringify({status:'encrypted_backup_created',file}));
    } else {
      const file = path.resolve(option('file') || ''); if (!option('file'))throw new Error('Provide --file');
      if (sql("SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public') + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')") !== '0') throw new Error('Restore target schema already contains objects. Refusing to overwrite it.');
      temporary=path.join(folder,'restore-'+randomUUID()+'.partial');
      await decryptBackup(file,temporary,secret,expected); // Authentication completes BEFORE any pg_restore process exists.
      const descriptor=fs.openSync(temporary,'r');
      try {
        const magic=Buffer.alloc(5);fs.readSync(descriptor,magic,0,5,0);
        if(magic.toString()!=='PGDMP')throw new Error('Authenticated backup is not a PostgreSQL custom archive');
        command(['pg_restore','-U','cluster_admin','--role=honeychain_migrator','--no-owner','--no-acl','--exit-on-error','-d','honeychain'],{stdio:[descriptor,'pipe','pipe']});
      }
      finally { fs.closeSync(descriptor); }
      sql('REVOKE INSERT, UPDATE, DELETE ON "DeploymentIdentity" FROM honeychain_app; REVOKE ALL ON "_prisma_migrations" FROM honeychain_app;');
      console.log(JSON.stringify({status:'restored_to_separate_project',project,clusterId:id}));
    }
  } finally {
    if (temporary && fs.existsSync(temporary)) {
      if (!path.resolve(temporary).startsWith(path.resolve(folder)+path.sep)) throw new Error('Unexpected temporary cleanup target');
      fs.unlinkSync(temporary);
    }
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
