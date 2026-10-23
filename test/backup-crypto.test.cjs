const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{Readable}=require('node:stream'),{randomUUID,randomBytes}=require('node:crypto');
const {encryptBackup,decryptBackup,backupHeader}=require('../scripts/backup-crypto.cjs');
const identity={clusterId:'unit-cooperative',chainId:80002,registryAddress:'0x'+'1'.repeat(40),forwarderAddress:'0x'+'2'.repeat(40),genesisHash:'0x'+'3'.repeat(64)};
function folder(){const base=path.resolve('.local-data'),dir=path.join(base,'backup-unit-'+randomUUID());fs.mkdirSync(dir,{recursive:true,mode:0o700});return{dir,clean(){if(!dir.startsWith(base+path.sep))throw Error('Unexpected test cleanup target');fs.rmSync(dir,{recursive:true});}};}
test('encrypted backups round-trip binary archives without storing plaintext in the encrypted file',async()=>{
  const f=folder(),secret=randomBytes(32).toString('hex'),raw=Buffer.concat([Buffer.from('PGDMP'),randomBytes(64000)]),file=path.join(f.dir,'backup'),output=path.join(f.dir,'restored');
  try{await encryptBackup(Readable.from([raw.subarray(0,100),raw.subarray(100)]),file,secret,identity);assert.equal(fs.readFileSync(file).includes(raw),false);await decryptBackup(file,output,secret,identity);assert.deepEqual(fs.readFileSync(output),raw);assert.equal(backupHeader(file).clusterId,identity.clusterId);}finally{f.clean();}
});
test('modified ciphertext or authentication tags fail before plaintext is made available for restore',async()=>{
  const f=folder(),secret=randomBytes(32).toString('hex'),file=path.join(f.dir,'backup');
  try{await encryptBackup(Readable.from([Buffer.from('PGDMP synthetic database contents')]),file,secret,identity);const original=fs.readFileSync(file);
    for(const position of [original.length-1,original.length-20]){const corrupt=Buffer.from(original);corrupt[position]^=1;const input=path.join(f.dir,'corrupt-'+position),output=input+'.plain';fs.writeFileSync(input,corrupt);await assert.rejects(decryptBackup(input,output,secret,identity));assert.equal(fs.existsSync(output),false);}
  }finally{f.clean();}
});
test('a wrong key or another cooperative cannot restore the archive',async()=>{
  const f=folder(),secret=randomBytes(32).toString('hex'),file=path.join(f.dir,'backup');
  try{await encryptBackup(Readable.from([Buffer.from('PGDMP unit')]),file,secret,identity);await assert.rejects(decryptBackup(file,path.join(f.dir,'wrong-key'),randomBytes(32).toString('hex'),identity));await assert.rejects(decryptBackup(file,path.join(f.dir,'wrong-cluster'),secret,{...identity,clusterId:'another-cooperative'}),/different cluster/);assert.equal(fs.existsSync(path.join(f.dir,'wrong-cluster')),false);}finally{f.clean();}
});
test('restore never overwrites an existing output file and refuses malformed envelopes',async()=>{
  const f=folder(),secret=randomBytes(32).toString('hex'),file=path.join(f.dir,'backup'),output=path.join(f.dir,'existing');
  try{await encryptBackup(Readable.from([Buffer.from('PGDMP unit')]),file,secret,identity);fs.writeFileSync(output,'preserve-existing-data');await assert.rejects(decryptBackup(file,output,secret,identity));assert.equal(fs.readFileSync(output,'utf8'),'preserve-existing-data');fs.writeFileSync(path.join(f.dir,'bad'),'bad');assert.throws(()=>backupHeader(path.join(f.dir,'bad')));}finally{f.clean();}
});
