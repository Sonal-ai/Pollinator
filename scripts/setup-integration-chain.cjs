const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.integration');
const config = dotenv.parse(fs.readFileSync(envPath));
if (config.LOCAL_RPC_URL !== 'http://127.0.0.1:8545' || config.BLOCKCHAIN_NETWORK !== 'local') throw new Error('Integration chain must use the dedicated localhost node.');
const provider = new ethers.JsonRpcProvider(config.LOCAL_RPC_URL);
(async () => {
  try {
    if ((await provider.getNetwork()).chainId !== 31337n) throw new Error('Unexpected integration chain');
    const genesisHash = (await provider.getBlock(0)).hash;
    const manifestPath = path.join(root, '.local-data/integration-chain.json');
    let manifest;
    if (fs.existsSync(manifestPath)) {
      const stored = JSON.parse(fs.readFileSync(manifestPath));
      if (stored.genesisHash === genesisHash && await provider.getCode(stored.registryAddress) !== '0x') manifest = stored;
    }
    if (!manifest) {
      const admin = await provider.getSigner(0);
      const forwarderArtifact = require('../artifacts/contracts/HoneyChainForwarder.sol/HoneyChainForwarder.json');
      const registryArtifact = require('../artifacts/contracts/HoneyChain.sol/HoneyChain.json');
      const forwarder = await new ethers.ContractFactory(forwarderArtifact.abi, forwarderArtifact.bytecode, admin).deploy();
      await forwarder.waitForDeployment();
      const registry = await new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, admin).deploy(await forwarder.getAddress());
      await registry.waitForDeployment();
      const actors = {};
      for (const [index, name] of ['beekeeper','lab','processor','distributor','retailer'].entries()) {
        const actor = await provider.getSigner(index + 1);
        const address = await actor.getAddress(); actors[name] = address;
        await (await registry.grantRole(await registry[name.toUpperCase() + '_ROLE'](), address)).wait();
      }
      manifest = { registryAddress: await registry.getAddress(), forwarderAddress: await forwarder.getAddress(), chainId: 31337, genesisHash, actors, admin: await admin.getAddress(), relayer: await (await provider.getSigner(7)).getAddress() };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
    config.LOCAL_CONTRACT_ADDRESS = manifest.registryAddress;
    // Public Hardhat fixture mnemonic; never use these accounts on any public network.
    config.LOCAL_PRIVATE_KEY = ethers.HDNodeWallet.fromPhrase('test test test test test test test test test test test junk', undefined, "m/44'/60'/0'/0/7").privateKey;
    config.CHAIN_MAX_FEE_GWEI = '100';
    fs.writeFileSync(envPath, Object.entries(config).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n');
    console.log('Integration registry v2 and forwarder are ready. Distinct fixture actors are enrolled; the relayer has no operational role.');
  } finally { provider.destroy(); }
})().catch(() => { console.error('Integration chain setup failed. Check the local node and compiled artifacts.'); process.exitCode = 1; });
