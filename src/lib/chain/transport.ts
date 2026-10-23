import { ethers } from 'ethers';
import { getActiveContractAddress, getActiveRpcUrl, getActivePrivateKey, isLocalChain } from './config';
import { REGISTRY_ABI, FORWARDER_ABI, forwardRequest, forwarderInterface, registryInterface,
  OperationError, type ChainContext, type ForwardAuthorization, type OperationPayload, STAGE_INDEX } from './protocol';

export class ChainTransport {
  readonly provider: ethers.JsonRpcProvider;
  constructor(rpcUrl = getActiveRpcUrl(), private readonly configuredAddress = getActiveContractAddress()) {
    const connection = new ethers.FetchRequest(rpcUrl);
    connection.timeout = 10_000;
    this.provider = new ethers.JsonRpcProvider(connection, undefined, { batchMaxCount: 1, cacheTimeout: -1 });
  }
  async context(): Promise<ChainContext> {
    if (!this.configuredAddress || !ethers.isAddress(this.configuredAddress)) throw new OperationError('Registry v2 is not configured', 503);
    const network = await this.provider.getNetwork();
    const expected = isLocalChain() ? 31337 : 80002;
    if (network.chainId !== BigInt(expected)) throw new OperationError('The RPC chain does not match the configured network', 503);
    const registry = new ethers.Contract(this.configuredAddress, REGISTRY_ABI, this.provider);
    if (await registry.registryVersion() !== BigInt(2)) throw new OperationError('Registry v2 deployment is required', 503);
    const forwarderAddress: string = await registry.trustedForwarder();
    if (forwarderAddress === ethers.ZeroAddress || (await this.provider.getCode(forwarderAddress)) === '0x') throw new OperationError('The registry needs a deployed trusted forwarder', 503);
    const genesis = await this.provider.getBlock(0);
    if (!genesis?.hash) throw new OperationError('Cannot establish chain identity', 503);
    if (process.env.REGISTRY_FORWARDER_ADDRESS && forwarderAddress.toLowerCase() !== process.env.REGISTRY_FORWARDER_ADDRESS.toLowerCase()) throw new OperationError('The trusted forwarder differs from the deployment configuration', 503);
    if (process.env.REGISTRY_GENESIS_HASH && genesis.hash.toLowerCase() !== process.env.REGISTRY_GENESIS_HASH.toLowerCase()) throw new OperationError('The RPC genesis differs from the deployment configuration', 503);
    return { chainId: Number(network.chainId), registryAddress: ethers.getAddress(this.configuredAddress), forwarderAddress: ethers.getAddress(forwarderAddress), genesisHash: genesis.hash };
  }
  async assertContext(stored: ChainContext) {
    const current = await this.context();
    if (current.chainId !== stored.chainId || current.registryAddress.toLowerCase() !== stored.registryAddress.toLowerCase() ||
      current.forwarderAddress.toLowerCase() !== stored.forwarderAddress.toLowerCase() || current.genesisHash !== stored.genesisHash) {
      throw new OperationError('Chain configuration changed. This operation requires review.');
    }
    return current;
  }
  registry(context: ChainContext) { return new ethers.Contract(context.registryAddress, REGISTRY_ABI, this.provider); }
  forwarder(context: ChainContext) { return new ethers.Contract(context.forwarderAddress, FORWARDER_ABI, this.provider); }
  async nonce(context: ChainContext, actor: string): Promise<string> { return (await this.forwarder(context).nonces(actor)).toString(); }
  async verify(context: ChainContext, auth: ForwardAuthorization, signature: string): Promise<boolean> { return this.forwarder(context).verify(forwardRequest(auth, signature)); }
  relayer(): ethers.Wallet {
    const key = getActivePrivateKey();
    if (!key) throw new OperationError('The gas relayer is not configured', 503);
    return new ethers.Wallet(key, this.provider);
  }
  async prepareOuterTransaction(context: ChainContext, auth: ForwardAuthorization, signature: string, nonce: number) {
    const signer = this.relayer();
    const roleHashes = [ethers.ZeroHash, ...['BEEKEEPER','LAB','PROCESSOR','DISTRIBUTOR','RETAILER'].map(role => ethers.id(role + '_ROLE'))];
    if ((await Promise.all(roleHashes.map(role => this.registry(context).hasRole(role, signer.address)))).some(Boolean)) {
      throw new OperationError('Configure a separate gas relayer with no administrator or operational roles.', 422);
    }
    const data = forwarderInterface.encodeFunctionData('execute', [forwardRequest(auth, signature)]);
    const fees = await this.provider.getFeeData();
    const cap = ethers.parseUnits(process.env.CHAIN_MAX_FEE_GWEI || '100', 'gwei');
    const gasPrice = fees.maxFeePerGas ?? fees.gasPrice;
    if (!gasPrice || gasPrice > cap) throw new OperationError('Gas fees exceed the configured relayer budget', 503);
    // Estimate the exact approved call; do not allocate funds for arbitrary targets/selectors.
    const estimate = await this.provider.estimateGas({ from: signer.address, to: context.forwarderAddress, data, value: 0 });
    const gasLimit = estimate * BigInt(120) / BigInt(100) + BigInt(20_000);
    if (gasLimit > BigInt(1_500_000)) throw new OperationError('Approved operation exceeds the relayer gas limit', 422);
    const transaction: ethers.TransactionRequest = { chainId: context.chainId, nonce, to: context.forwarderAddress, value: 0, data, gasLimit,
      ...(fees.maxFeePerGas ? { type: 2, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? 0 } : { gasPrice }) };
    const raw = await signer.signTransaction(transaction);
    return { raw, hash: ethers.keccak256(raw), signerAddress: signer.address, nonce };
  }
  async broadcast(raw: string) { return this.provider.broadcastTransaction(raw); }
  async matchingHead(context: ChainContext, p: OperationPayload, actor: string): Promise<boolean> {
    const b = await this.registry(context).getBatch(ethers.id(p.batchCode));
    if (!b.createdAt) return false;
    if (p.kind === 'RECALL_BATCH') return b.recalled;
    if (b.recalled) return false;
    if (p.kind === 'CREATE_BATCH') return b.beekeeper.toLowerCase() === actor.toLowerCase() && Number(b.status) === 1 && Number(b.quantityGrams) === p.quantityGrams && b.harvestMetadataHash.toLowerCase() === p.metadataHash.toLowerCase();
    if (p.kind === 'TRANSFER_CUSTODY') return b.currentCustodian.toLowerCase() === p.toAddress.toLowerCase() && Number(b.status) === STAGE_INDEX[p.newStatus];
    if (p.kind === 'VERIFY_LAB') return b.labVerified && Number(b.status) === 3 && b.labVerifier.toLowerCase() === actor.toLowerCase() && b.labReportHash.toLowerCase() === p.certificateHash.toLowerCase();
    return Number(b.status) === 4 && Number(b.jarCount) === p.jarCount && Number(b.jarSizeGrams) === p.jarSizeGrams && b.metadataHash.toLowerCase() === p.metadataHash.toLowerCase();
  }
  receiptHasApproval(receipt: ethers.TransactionReceipt, context: ChainContext, auth: ForwardAuthorization): boolean {
    return receipt.logs.some(log => {
      if (log.address.toLowerCase() !== context.forwarderAddress.toLowerCase()) return false;
      try { const event = forwarderInterface.parseLog(log); return event?.name === 'ExecutedForwardRequest' && event.args.signer.toLowerCase() === auth.message.from.toLowerCase() && event.args.nonce.toString() === auth.message.nonce && event.args.success === true; }
      catch { return false; }
    });
  }
  receiptHasAction(receipt: ethers.TransactionReceipt, context: ChainContext, p: OperationPayload, actor: string): boolean {
    return receipt.logs.some(log => {
      if (log.address.toLowerCase() !== context.registryAddress.toLowerCase()) return false;
      try {
        const e = registryInterface.parseLog(log);
        if (!e || e.args.batchIdHash !== ethers.id(p.batchCode)) return false;
        if (p.kind === 'CREATE_BATCH') return e.name === 'BatchCreated' && e.args.beekeeper.toLowerCase() === actor.toLowerCase() && e.args.metadataCID === p.metadataCID && e.args.metadataHash.toLowerCase() === p.metadataHash.toLowerCase() && Number(e.args.quantityGrams) === p.quantityGrams;
        if (p.kind === 'TRANSFER_CUSTODY') return e.name === 'CustodyTransferred' && e.args.from.toLowerCase() === actor.toLowerCase() && e.args.to.toLowerCase() === p.toAddress.toLowerCase() && Number(e.args.status) === STAGE_INDEX[p.newStatus];
        if (p.kind === 'VERIFY_LAB') return e.name === 'LabVerified' && e.args.lab.toLowerCase() === actor.toLowerCase() && e.args.labReportHash.toLowerCase() === p.certificateHash.toLowerCase();
        if (p.kind === 'PACKAGE_BATCH') return e.name === 'BatchPackaged' && e.args.newMetadataCID === p.metadataCID && e.args.newMetadataHash.toLowerCase() === p.metadataHash.toLowerCase() && Number(e.args.jarCount) === p.jarCount && Number(e.args.jarSizeGrams) === p.jarSizeGrams;
        return e.name === 'BatchRecalled' && e.args.by.toLowerCase() === actor.toLowerCase() && e.args.reasonCID === p.reasonCID;
      } catch { return false; }
    });
  }
}
