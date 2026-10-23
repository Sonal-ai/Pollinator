const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('HoneyChain v2 — provenance invariants', function () {
  let registry, forwarder, admin, beekeeper, lab, processor, distributor, retailer, outsider, relayer;
  const id = ethers.id('HC-2026-TEST-000001');
  const cid = 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku';
  const contentHash = ethers.sha256(ethers.toUtf8Bytes('exact harvest bytes'));
  const reportHash = ethers.sha256(ethers.toUtf8Bytes('%PDF lab report bytes'));
  const packageHash = ethers.sha256(ethers.toUtf8Bytes('exact packaging bytes'));
  const types = { ForwardRequest: [
    { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' }, { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint48' }, { name: 'data', type: 'bytes' },
  ] };
  async function timestamp() { return (await ethers.provider.getBlock('latest')).timestamp; }
  async function harvest() {
    return registry.connect(beekeeper).createBatch(id, await timestamp(), 25000, cid, contentHash);
  }
  async function processBatch() {
    await harvest();
    await registry.connect(beekeeper).transferCustody(id, processor.address, 1);
    await registry.connect(processor).transferCustody(id, lab.address, 2);
  }
  async function attest() {
    await processBatch();
    await registry.connect(lab).verifyLab(id, reportHash);
    await registry.connect(lab).transferCustody(id, processor.address, 3);
  }
  async function packageBatch() {
    await attest();
    await registry.connect(processor).packageBatch(id, 50, 500, cid, packageHash);
  }
  async function signedRequest(signer, functionName, args, domainOverride = {}) {
    const network = await ethers.provider.getNetwork();
    const domain = { name: 'HoneyChainForwarder', version: '1', chainId: network.chainId, verifyingContract: await forwarder.getAddress(), ...domainOverride };
    const message = {
      from: signer.address, to: await registry.getAddress(), value: 0, gas: 900000,
      nonce: await forwarder.nonces(signer.address), deadline: (await timestamp()) + 600,
      data: registry.interface.encodeFunctionData(functionName, args),
    };
    return { ...message, signature: await signer.signTypedData(domain, types, message) };
  }
  beforeEach(async function () {
    [admin, beekeeper, lab, processor, distributor, retailer, outsider, relayer] = await ethers.getSigners();
    forwarder = await (await ethers.getContractFactory('HoneyChainForwarder')).deploy();
    await forwarder.waitForDeployment();
    registry = await (await ethers.getContractFactory('HoneyChain')).deploy(await forwarder.getAddress());
    await registry.waitForDeployment();
    await registry.grantBeekeeperRole(beekeeper.address);
    await registry.grantLabRole(lab.address);
    await registry.grantProcessorRole(processor.address);
    await registry.grantDistributorRole(distributor.address);
    await registry.grantRetailerRole(retailer.address);
  });
  it('keeps administration separate from the gas payer', async function () {
    expect(await registry.registryVersion()).to.equal(2);
    expect(await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    for (const role of ['DEFAULT_ADMIN_ROLE', 'BEEKEEPER_ROLE', 'LAB_ROLE', 'PROCESSOR_ROLE']) {
      expect(await registry.hasRole(await registry[role](), relayer.address)).to.equal(false);
    }
  });
  it('rejects an EOA as the trusted forwarder', async function () {
    await expect((await ethers.getContractFactory('HoneyChain')).deploy(outsider.address))
      .to.be.revertedWith('HoneyChain: Forwarder must be a contract');
  });
  it('registers the actor, harvest mass and immutable original commitment', async function () {
    await expect(harvest()).to.emit(registry, 'BatchCreated').withArgs(id, beekeeper.address, cid, contentHash, 25000);
    const b = await registry.getBatch(id);
    expect(b.status).to.equal(1);
    expect(b.beekeeper).to.equal(beekeeper.address);
    expect(b.currentCustodian).to.equal(beekeeper.address);
    expect(b.harvestMetadataHash).to.equal(contentHash);
    expect(b.jarCount).to.equal(0);
  });
  it('rejects duplicate registrations', async function () {
    await harvest();
    await expect(harvest()).to.be.revertedWith('HoneyChain: Batch already exists');
  });
  it('rejects a non-beekeeper', async function () {
    await expect(registry.connect(outsider).createBatch(id, await timestamp(), 25000, cid, contentHash))
      .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
  });
  it('rejects zero mass, empty identity, future dates and missing commitments', async function () {
    const t = await timestamp();
    for (const [args, reason] of [
      [[id, t, 0, cid, contentHash], 'Quantity must be greater than zero'],
      [[ethers.ZeroHash, t, 1, cid, contentHash], 'Empty batch ID'],
      [[id, t + 10000, 1, cid, contentHash], 'Invalid harvest timestamp'],
      [[id, 0, 1, cid, contentHash], 'Invalid harvest timestamp'],
      [[id, t, 1, '', contentHash], 'Evidence commitment required'],
      [[id, t, 1, cid, ethers.ZeroHash], 'Evidence commitment required'],
    ]) await expect(registry.connect(beekeeper).createBatch(...args)).to.be.revertedWith('HoneyChain: ' + reason);
  });
  it('does not treat a missing batch as Created', async function () {
    expect(await registry.batchExists(id)).to.equal(false);
    await expect(registry.getBatchStatus(id)).to.be.revertedWith('HoneyChain: Batch does not exist');
  });
  it('preserves the stage when the farmer hands the harvest to a processor', async function () {
    await harvest();
    await expect(registry.connect(beekeeper).transferCustody(id, processor.address, 1))
      .to.emit(registry, 'CustodyTransferred').withArgs(id, beekeeper.address, processor.address, 1);
  });
  it('blocks outsider and admin custody overrides', async function () {
    await harvest();
    for (const signer of [outsider, admin]) await expect(registry.connect(signer).transferCustody(id, processor.address, 1))
      .to.be.revertedWith('HoneyChain: Not current custodian');
  });
  it('rejects zero addresses, unknown recipients and empty handovers', async function () {
    await harvest();
    await expect(registry.connect(beekeeper).transferCustody(id, ethers.ZeroAddress, 1)).to.be.revertedWith('HoneyChain: Cannot transfer to zero address');
    await expect(registry.connect(beekeeper).transferCustody(id, outsider.address, 1)).to.be.revertedWith('HoneyChain: Recipient role does not match stage');
    await expect(registry.connect(beekeeper).transferCustody(id, beekeeper.address, 1)).to.be.revertedWith('HoneyChain: Empty handover');
  });
  it('cannot skip processing, lab approval or packaging through generic custody', async function () {
    await harvest();
    for (const stage of [2, 3, 4, 5, 6, 7, 8]) await expect(registry.connect(beekeeper).transferCustody(id, processor.address, stage))
      .to.be.revertedWith('HoneyChain: Invalid stage transition');
  });
  it('requires a processor to declare processing and a lab to attest', async function () {
    await processBatch();
    await expect(registry.connect(lab).verifyLab(id, reportHash)).to.emit(registry, 'LabVerified').withArgs(id, lab.address, reportHash);
    const b = await registry.getBatch(id);
    expect(b.labVerifier).to.equal(lab.address);
    expect(b.status).to.equal(3);
  });
  it('cannot attest a harvest before processing', async function () {
    await harvest();
    await expect(registry.connect(lab).verifyLab(id, reportHash)).to.be.revertedWith('HoneyChain: Processed stage required');
  });
  it('cannot attest from an unassigned lab, a non-lab, or with an empty report', async function () {
    await processBatch();
    await registry.grantLabRole(outsider.address);
    await expect(registry.connect(outsider).verifyLab(id, reportHash)).to.be.revertedWith('HoneyChain: Not current custodian');
    await expect(registry.connect(processor).verifyLab(id, reportHash)).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    await expect(registry.connect(lab).verifyLab(id, ethers.ZeroHash)).to.be.revertedWith('HoneyChain: Empty report hash');
  });
  it('does not allow a producer to act as its own independent lab', async function () {
    await registry.grantLabRole(beekeeper.address);
    await registry.grantProcessorRole(beekeeper.address);
    await harvest();
    await registry.connect(beekeeper).transferCustody(id, beekeeper.address, 2);
    await expect(registry.connect(beekeeper).verifyLab(id, reportHash)).to.be.revertedWith('HoneyChain: Independent lab required');
  });
  it('does not overwrite a laboratory commitment', async function () {
    await processBatch();
    await registry.connect(lab).verifyLab(id, reportHash);
    await expect(registry.connect(lab).verifyLab(id, packageHash)).to.be.revertedWith('HoneyChain: Already lab verified');
  });
  it('requires lab approval before packaging', async function () {
    await harvest();
    await registry.connect(beekeeper).transferCustody(id, processor.address, 1);
    await expect(registry.connect(processor).packageBatch(id, 50, 500, cid, packageHash)).to.be.revertedWith('HoneyChain: Lab verification required');
  });
  it('records jar inventory while preserving the original harvest commitment', async function () {
    await attest();
    await expect(registry.connect(processor).packageBatch(id, 50, 500, cid, packageHash))
      .to.emit(registry, 'BatchPackaged').withArgs(id, cid, packageHash, 50, 500);
    const b = await registry.getBatch(id);
    expect(b.jarCount).to.equal(50);
    expect(b.jarSizeGrams).to.equal(500);
    expect(b.packagedGrams).to.equal(25000);
    expect(b.harvestMetadataHash).to.equal(contentHash);
    expect(b.metadataHash).to.equal(packageHash);
  });
  it('rejects zero jars, zero jar size, excess mass and integer overflow attempts', async function () {
    await attest();
    for (const [count, size, reason] of [
      [0, 500, 'Empty packaging'], [50, 0, 'Empty packaging'],
      [51, 500, 'Fraud - Packaged quantity exceeds harvested quantity'],
      [4294967295, 4294967295, 'Fraud - Packaged quantity exceeds harvested quantity'],
    ]) await expect(registry.connect(processor).packageBatch(id, count, size, cid, packageHash)).to.be.revertedWith('HoneyChain: ' + reason);
  });
  it('cannot package twice even after the status moves into distribution', async function () {
    await packageBatch();
    await registry.grantDistributorRole(processor.address);
    await registry.connect(processor).transferCustody(id, processor.address, 5);
    await expect(registry.connect(processor).packageBatch(id, 50, 500, cid, packageHash)).to.be.revertedWith('HoneyChain: Batch already packaged');
  });
  it('requires an appropriate recipient role at each downstream stage', async function () {
    await packageBatch();
    await expect(registry.connect(processor).transferCustody(id, retailer.address, 5)).to.be.revertedWith('HoneyChain: Recipient role does not match stage');
    await registry.connect(processor).transferCustody(id, distributor.address, 5);
    await expect(registry.connect(distributor).transferCustody(id, retailer.address, 4)).to.be.revertedWith('HoneyChain: Invalid stage transition');
    await registry.connect(distributor).transferCustody(id, retailer.address, 6);
    await registry.connect(retailer).transferCustody(id, retailer.address, 7);
    await expect(registry.connect(retailer).transferCustody(id, processor.address, 7)).to.be.revertedWith('HoneyChain: Sold batch is terminal');
  });
  it('makes recall terminal and available during an emergency pause', async function () {
    await harvest();
    await registry.pause();
    await expect(registry.recallBatch(id, cid)).to.emit(registry, 'BatchRecalled').withArgs(id, admin.address, cid);
    await registry.unpause();
    await expect(registry.connect(beekeeper).transferCustody(id, processor.address, 1)).to.be.revertedWith('HoneyChain: Batch is recalled');
    await expect(registry.connect(lab).verifyLab(id, reportHash)).to.be.revertedWith('HoneyChain: Batch is recalled');
    await expect(registry.connect(processor).packageBatch(id, 1, 1, cid, packageHash)).to.be.revertedWith('HoneyChain: Batch is recalled');
    await expect(registry.recallBatch(id, cid)).to.be.revertedWith('HoneyChain: Batch already recalled');
  });
  it('restricts recall to administrators and requires a reason', async function () {
    await harvest();
    await expect(registry.connect(outsider).recallBatch(id, cid)).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    await expect(registry.recallBatch(id, '')).to.be.revertedWith('HoneyChain: Recall reason required');
  });
  it('halts operational writes during pause and resumes after unpause', async function () {
    await registry.pause();
    await expect(harvest()).to.be.revertedWithCustomError(registry, 'EnforcedPause');
    await registry.unpause();
    await harvest();
    await registry.pause();
    await expect(registry.connect(beekeeper).transferCustody(id, processor.address, 1)).to.be.revertedWithCustomError(registry, 'EnforcedPause');
  });
  it('relays a signed harvest while attributing custody to the actual signer', async function () {
    const request = await signedRequest(beekeeper, 'createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    expect(await forwarder.verify(request)).to.equal(true);
    await expect(forwarder.connect(relayer).execute(request)).to.emit(registry, 'BatchCreated').withArgs(id, beekeeper.address, cid, contentHash, 25000);
    expect((await registry.getBatch(id)).currentCustodian).to.equal(beekeeper.address);
  });
  it('blocks a replayed signature', async function () {
    const request = await signedRequest(beekeeper, 'createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    await forwarder.connect(relayer).execute(request);
    expect(await forwarder.verify(request)).to.equal(false);
    await expect(forwarder.connect(relayer).execute(request)).to.be.reverted;
  });
  it('blocks modified calldata, signer, value and deadlines', async function () {
    const request = await signedRequest(beekeeper, 'createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    for (const patch of [
      { data: registry.interface.encodeFunctionData('createBatch', [id, await timestamp(), 250000, cid, contentHash]) },
      { from: outsider.address }, { value: 1 }, { deadline: request.deadline + 1 },
    ]) expect(await forwarder.verify({ ...request, ...patch })).to.equal(false);
  });
  it('blocks cross-chain and cross-forwarder signature reuse', async function () {
    for (const domain of [{ chainId: 80002 }, { verifyingContract: await registry.getAddress() }]) {
      const request = await signedRequest(beekeeper, 'createBatch', [id, await timestamp(), 25000, cid, contentHash], domain);
      expect(await forwarder.verify(request)).to.equal(false);
    }
  });
  it('rejects expired requests', async function () {
    const request = await signedRequest(beekeeper, 'createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    await ethers.provider.send('evm_setNextBlockTimestamp', [request.deadline + 1]);
    await ethers.provider.send('evm_mine', []);
    expect(await forwarder.verify(request)).to.equal(false);
    await expect(forwarder.execute(request)).to.be.revertedWithCustomError(forwarder, 'ERC2771ForwarderExpiredRequest');
  });
  it('does not turn an authenticated non-role signer into a beekeeper', async function () {
    const request = await signedRequest(outsider, 'createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    await expect(forwarder.connect(relayer).execute(request)).to.be.reverted;
    expect(await forwarder.nonces(outsider.address)).to.equal(0);
    expect(await registry.batchExists(id)).to.equal(false);
  });
  it('does not accept a spoofed actor suffix from an untrusted sender', async function () {
    const data = registry.interface.encodeFunctionData('createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    await expect(outsider.sendTransaction({ to: await registry.getAddress(), data: ethers.concat([data, beekeeper.address]) }))
      .to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
  });
  it('completes harvest, lab, packaging, retail and recall through an unprivileged relayer', async function () {
    const balanceBefore = await ethers.provider.getBalance(beekeeper.address);
    async function relay(actor, method, args) {
      const request = await signedRequest(actor, method, args);
      await (await forwarder.connect(relayer).execute(request)).wait();
    }
    await relay(beekeeper, 'createBatch', [id, await timestamp(), 25000, cid, contentHash]);
    await relay(beekeeper, 'transferCustody', [id, processor.address, 1]);
    await relay(processor, 'transferCustody', [id, lab.address, 2]);
    await relay(lab, 'verifyLab', [id, reportHash]);
    await relay(lab, 'transferCustody', [id, processor.address, 3]);
    await relay(processor, 'packageBatch', [id, 50, 500, cid, packageHash]);
    await relay(processor, 'transferCustody', [id, distributor.address, 5]);
    await relay(distributor, 'transferCustody', [id, retailer.address, 6]);
    await relay(retailer, 'transferCustody', [id, retailer.address, 7]);
    const sold = await registry.getBatch(id);
    expect(sold.status).to.equal(7);
    expect(sold.labVerifier).to.equal(lab.address);
    expect(sold.jarCount).to.equal(50);
    expect(await ethers.provider.getBalance(beekeeper.address)).to.equal(balanceBefore);
    await relay(admin, 'recallBatch', [id, cid]);
    expect((await registry.getBatch(id)).recalled).to.equal(true);
  });
});
