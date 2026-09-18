const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HoneyChain", function () {
  let honeyChain;
  let owner, beekeeper, lab, processor, distributor, other;

  // A sample batch ID hash for tests
  const testBatchCode = "HC-2026-TEST-000001";
  const testBatchIdHash = ethers.id(testBatchCode); // keccak256
  const testMetadataCID = "QmTestCIDaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const testMetadataHash = ethers.encodeBytes32String("testhash12345678901234567890123"); // 32 bytes
  const testLabReportHash = ethers.encodeBytes32String("labreport1234567890123456789012"); // 32 bytes
  const harvestTimestamp = Math.floor(Date.now() / 1000);
  const quantityGrams = 25000; // 25 kg

  beforeEach(async function () {
    [owner, beekeeper, lab, processor, distributor, other] = await ethers.getSigners();

    const HoneyChain = await ethers.getContractFactory("HoneyChain");
    honeyChain = await HoneyChain.deploy();
    await honeyChain.waitForDeployment();

    // Grant roles
    await honeyChain.grantBeekeeperRole(beekeeper.address);
    await honeyChain.grantLabRole(lab.address);
    await honeyChain.grantProcessorRole(processor.address);
    await honeyChain.grantDistributorRole(distributor.address);
  });

  // ============================================================
  // Deployment
  // ============================================================
  describe("Deployment", function () {
    it("Should deploy and grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const adminRole = await honeyChain.DEFAULT_ADMIN_ROLE();
      expect(await honeyChain.hasRole(adminRole, owner.address)).to.be.true;
    });

    it("Should correctly assign roles via convenience functions", async function () {
      const BEEKEEPER_ROLE = await honeyChain.BEEKEEPER_ROLE();
      const LAB_ROLE = await honeyChain.LAB_ROLE();
      const PROCESSOR_ROLE = await honeyChain.PROCESSOR_ROLE();

      expect(await honeyChain.hasRole(BEEKEEPER_ROLE, beekeeper.address)).to.be.true;
      expect(await honeyChain.hasRole(LAB_ROLE, lab.address)).to.be.true;
      expect(await honeyChain.hasRole(PROCESSOR_ROLE, processor.address)).to.be.true;
    });
  });

  // ============================================================
  // createBatch
  // ============================================================
  describe("createBatch", function () {
    it("Should allow BEEKEEPER_ROLE to create a batch and emit BatchCreated", async function () {
      const tx = await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );

      await expect(tx)
        .to.emit(honeyChain, "BatchCreated")
        .withArgs(testBatchIdHash, beekeeper.address, testMetadataCID, testMetadataHash, quantityGrams);
    });

    it("Should store the batch with correct initial values", async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );

      const batch = await honeyChain.getBatch(testBatchIdHash);
      expect(batch.beekeeper).to.equal(beekeeper.address);
      expect(batch.currentCustodian).to.equal(beekeeper.address);
      expect(batch.quantityGrams).to.equal(quantityGrams);
      expect(batch.labVerified).to.be.false;
      expect(batch.recalled).to.be.false;
      expect(Number(batch.status)).to.equal(0); // Created
    });

    it("Should REVERT if a non-beekeeper tries to create a batch", async function () {
      await expect(
        honeyChain.connect(other).createBatch(
          testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
        )
      ).to.be.revertedWithCustomError(honeyChain, "AccessControlUnauthorizedAccount");
    });

    it("Should REVERT if the same batch hash is registered twice", async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
      await expect(
        honeyChain.connect(beekeeper).createBatch(
          testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
        )
      ).to.be.revertedWith("HoneyChain: Batch already exists");
    });

    it("Should REVERT if quantity is zero", async function () {
      await expect(
        honeyChain.connect(beekeeper).createBatch(
          testBatchIdHash, harvestTimestamp, 0, testMetadataCID, testMetadataHash
        )
      ).to.be.revertedWith("HoneyChain: Quantity must be greater than zero");
    });
  });

  // ============================================================
  // verifyLab
  // ============================================================
  describe("verifyLab", function () {
    beforeEach(async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
    });

    it("Should allow LAB_ROLE to verify and emit LabVerified", async function () {
      const tx = await honeyChain.connect(lab).verifyLab(testBatchIdHash, testLabReportHash);
      await expect(tx)
        .to.emit(honeyChain, "LabVerified")
        .withArgs(testBatchIdHash, lab.address, testLabReportHash);

      const batch = await honeyChain.getBatch(testBatchIdHash);
      expect(batch.labVerified).to.be.true;
      expect(Number(batch.status)).to.equal(3); // LabVerified
    });

    it("Should REVERT if non-lab tries to verify", async function () {
      await expect(
        honeyChain.connect(other).verifyLab(testBatchIdHash, testLabReportHash)
      ).to.be.revertedWithCustomError(honeyChain, "AccessControlUnauthorizedAccount");
    });

    it("Should REVERT if batch doesn't exist", async function () {
      const fakeBatchHash = ethers.id("FAKE-BATCH");
      await expect(
        honeyChain.connect(lab).verifyLab(fakeBatchHash, testLabReportHash)
      ).to.be.revertedWith("HoneyChain: Batch does not exist");
    });

    it("Should REVERT if batch already verified", async function () {
      await honeyChain.connect(lab).verifyLab(testBatchIdHash, testLabReportHash);
      await expect(
        honeyChain.connect(lab).verifyLab(testBatchIdHash, testLabReportHash)
      ).to.be.revertedWith("HoneyChain: Already lab verified");
    });
  });

  // ============================================================
  // transferCustody
  // ============================================================
  describe("transferCustody", function () {
    beforeEach(async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
    });

    it("Should allow current custodian to transfer and emit CustodyTransferred", async function () {
      const ProcessedStatus = 2;
      const tx = await honeyChain.connect(beekeeper).transferCustody(
        testBatchIdHash, processor.address, ProcessedStatus
      );

      await expect(tx)
        .to.emit(honeyChain, "CustodyTransferred")
        .withArgs(testBatchIdHash, beekeeper.address, processor.address, ProcessedStatus);

      const batch = await honeyChain.getBatch(testBatchIdHash);
      expect(batch.currentCustodian).to.equal(processor.address);
      expect(Number(batch.status)).to.equal(ProcessedStatus);
    });

    it("Should REVERT if non-custodian tries to transfer", async function () {
      await expect(
        honeyChain.connect(other).transferCustody(testBatchIdHash, distributor.address, 5)
      ).to.be.revertedWith("HoneyChain: Not the current custodian");
    });

    it("Should REVERT on transfer to zero address", async function () {
      await expect(
        honeyChain.connect(beekeeper).transferCustody(testBatchIdHash, ethers.ZeroAddress, 2)
      ).to.be.revertedWith("HoneyChain: Cannot transfer to zero address");
    });
  });

  // ============================================================
  // packageBatch
  // ============================================================
  describe("packageBatch", function () {
    beforeEach(async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
      // Transfer to processor
      await honeyChain.connect(beekeeper).transferCustody(testBatchIdHash, processor.address, 2);
    });

    it("Should allow PROCESSOR_ROLE (and custodian) to package", async function () {
      const jarCount = 50;
      const jarSizeGrams = 500; // 50 * 500 = 25000g = matches quantityGrams
      const newCID = "QmNewPackagingCID";
      const newHash = ethers.encodeBytes32String("newpackaginghash1234567890123");

      const tx = await honeyChain.connect(processor).packageBatch(
        testBatchIdHash, jarCount, jarSizeGrams, newCID, newHash
      );

      await expect(tx)
        .to.emit(honeyChain, "BatchPackaged")
        .withArgs(testBatchIdHash, newCID, newHash, jarCount, jarSizeGrams);

      const batch = await honeyChain.getBatch(testBatchIdHash);
      expect(Number(batch.status)).to.equal(4); // Packaged
    });

    it("Should REVERT if packaged quantity exceeds harvested quantity (fraud check)", async function () {
      const jarCount = 100;
      const jarSizeGrams = 500; // 100 * 500 = 50000g > 25000g = FRAUD
      await expect(
        honeyChain.connect(processor).packageBatch(
          testBatchIdHash, jarCount, jarSizeGrams, "QmFraud", testMetadataHash
        )
      ).to.be.revertedWith("HoneyChain: Fraud - Packaged quantity exceeds harvested quantity");
    });
  });

  // ============================================================
  // recallBatch
  // ============================================================
  describe("recallBatch", function () {
    beforeEach(async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
    });

    it("Should allow DEFAULT_ADMIN_ROLE to recall and emit BatchRecalled", async function () {
      const reasonCID = "QmRecallReasonCID";
      const tx = await honeyChain.connect(owner).recallBatch(testBatchIdHash, reasonCID);

      await expect(tx)
        .to.emit(honeyChain, "BatchRecalled")
        .withArgs(testBatchIdHash, owner.address, reasonCID);

      const batch = await honeyChain.getBatch(testBatchIdHash);
      expect(batch.recalled).to.be.true;
      expect(Number(batch.status)).to.equal(8); // Recalled
    });

    it("Should REVERT if non-admin tries to recall", async function () {
      await expect(
        honeyChain.connect(other).recallBatch(testBatchIdHash, "QmFakeReason")
      ).to.be.revertedWithCustomError(honeyChain, "AccessControlUnauthorizedAccount");
    });

    it("Should REVERT if batch already recalled", async function () {
      await honeyChain.connect(owner).recallBatch(testBatchIdHash, "QmReason");
      await expect(
        honeyChain.connect(owner).recallBatch(testBatchIdHash, "QmReason2")
      ).to.be.revertedWith("HoneyChain: Batch already recalled");
    });

    it("Should REVERT verifyLab on recalled batch", async function () {
      await honeyChain.connect(owner).recallBatch(testBatchIdHash, "QmReason");
      await expect(
        honeyChain.connect(lab).verifyLab(testBatchIdHash, testLabReportHash)
      ).to.be.revertedWith("HoneyChain: Batch is recalled");
    });
  });

  // ============================================================
  // getBatchStatus (lightweight read)
  // ============================================================
  describe("getBatchStatus", function () {
    it("Should return correct status, recalled, and labVerified", async function () {
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
      await honeyChain.connect(lab).verifyLab(testBatchIdHash, testLabReportHash);

      const [status, recalled, labVerified] = await honeyChain.getBatchStatus(testBatchIdHash);
      expect(Number(status)).to.equal(3); // LabVerified
      expect(recalled).to.be.false;
      expect(labVerified).to.be.true;
    });
  });

  // ============================================================
  // Pause / Unpause
  // ============================================================
  describe("Pause", function () {
    it("Should prevent createBatch when paused", async function () {
      await honeyChain.connect(owner).pause();
      await expect(
        honeyChain.connect(beekeeper).createBatch(
          testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
        )
      ).to.be.revertedWithCustomError(honeyChain, "EnforcedPause");
    });

    it("Should resume after unpause", async function () {
      await honeyChain.connect(owner).pause();
      await honeyChain.connect(owner).unpause();
      // Should succeed now
      await honeyChain.connect(beekeeper).createBatch(
        testBatchIdHash, harvestTimestamp, quantityGrams, testMetadataCID, testMetadataHash
      );
      const batch = await honeyChain.getBatch(testBatchIdHash);
      expect(batch.createdAt).to.be.gt(0);
    });
  });
});
