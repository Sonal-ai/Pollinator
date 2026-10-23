-- CreateEnum
CREATE TYPE "ChainOperationState" AS ENUM ('AWAITING_SIGNATURE', 'READY', 'SIGNED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "DashboardAccount" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "beekeeperId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppUser" (
    "id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beekeeper" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "region" TEXT,
    "hivesCount" INTEGER,
    "practices" TEXT,
    "kvicId" TEXT,
    "wallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beekeeper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hive" (
    "id" TEXT NOT NULL,
    "beekeeperId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "region" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "hiveId" TEXT NOT NULL,
    "tempC" DOUBLE PRECISION,
    "humidityPct" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "pressureHPa" DOUBLE PRECISION,
    "batteryPct" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInference" (
    "id" TEXT NOT NULL,
    "hiveId" TEXT,
    "beekeeperId" TEXT,
    "modelVersion" TEXT NOT NULL,
    "inputImageHash" TEXT,
    "prediction" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rawOutput" TEXT,
    "inferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoneyBatch" (
    "id" TEXT NOT NULL,
    "batch_id_hash" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "beekeeperId" TEXT,
    "quantity_grams" INTEGER NOT NULL,
    "honey_type" TEXT NOT NULL,
    "hives_harvested" INTEGER NOT NULL,
    "harvest_timestamp" TIMESTAMP(3),
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'HARVESTED',
    "current_custodian" TEXT,
    "lab_verified" BOOLEAN NOT NULL DEFAULT false,
    "recalled" BOOLEAN NOT NULL DEFAULT false,
    "metadataCID" TEXT,
    "metadataHash" TEXT,
    "txHash" TEXT,
    "jarCount" INTEGER NOT NULL DEFAULT 0,
    "jarSizeGrams" INTEGER NOT NULL DEFAULT 0,
    "packagingTxHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "pendingOperationId" TEXT,
    "recallReason" TEXT,
    "recallTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoneyBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "labActorId" TEXT NOT NULL,
    "certificateHash" TEXT NOT NULL,
    "ipfsCID" TEXT NOT NULL,
    "txHash" TEXT,
    "chainOperationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "txHash" TEXT,
    "chainOperationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainOperation" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "actorAddress" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expectedVersion" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "registryAddress" TEXT NOT NULL,
    "forwarderAddress" TEXT NOT NULL,
    "genesisHash" TEXT NOT NULL,
    "calldata" TEXT NOT NULL,
    "state" "ChainOperationState" NOT NULL DEFAULT 'AWAITING_SIGNATURE',
    "actorLock" TEXT,
    "authorization" JSONB,
    "authorizationDeadline" TIMESTAMP(3),
    "actorNonce" TEXT,
    "signature" TEXT,
    "signedTransaction" TEXT,
    "signerNonce" INTEGER,
    "signerAddress" TEXT,
    "txHash" TEXT,
    "receiptBlock" INTEGER,
    "receiptBlockHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainWorkerLease" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "nextNonce" INTEGER,

    CONSTRAINT "ChainWorkerLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRToken" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "jarIndex" INTEGER,
    "jarSizeGrams" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QRScan" (
    "id" TEXT NOT NULL,
    "qrTokenId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "ipRegion" TEXT,
    "ipCity" TEXT,
    "ipCountry" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QRScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanAlert" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "qrTokenId" TEXT,
    "alertType" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardAccount_identifier_key" ON "DashboardAccount"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardAccount_walletAddress_key" ON "DashboardAccount"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppUser_wa_id_key" ON "WhatsAppUser"("wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "Beekeeper_phone_key" ON "Beekeeper"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Hive_deviceId_key" ON "Hive"("deviceId");

-- CreateIndex
CREATE INDEX "SensorReading_hiveId_timestamp_idx" ON "SensorReading"("hiveId", "timestamp");

-- CreateIndex
CREATE INDEX "AIInference_hiveId_inferredAt_idx" ON "AIInference"("hiveId", "inferredAt");

-- CreateIndex
CREATE UNIQUE INDEX "HoneyBatch_batch_id_hash_key" ON "HoneyBatch"("batch_id_hash");

-- CreateIndex
CREATE UNIQUE INDEX "HoneyBatch_batchCode_key" ON "HoneyBatch"("batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "HoneyBatch_pendingOperationId_key" ON "HoneyBatch"("pendingOperationId");

-- CreateIndex
CREATE INDEX "HoneyBatch_status_idx" ON "HoneyBatch"("status");

-- CreateIndex
CREATE INDEX "HoneyBatch_beekeeperId_idx" ON "HoneyBatch"("beekeeperId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_chainOperationId_key" ON "Certificate"("chainOperationId");

-- CreateIndex
CREATE INDEX "Certificate_batchId_idx" ON "Certificate"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyEvent_chainOperationId_key" ON "CustodyEvent"("chainOperationId");

-- CreateIndex
CREATE INDEX "CustodyEvent_batchId_createdAt_idx" ON "CustodyEvent"("batchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChainOperation_requestKey_key" ON "ChainOperation"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChainOperation_actorLock_key" ON "ChainOperation"("actorLock");

-- CreateIndex
CREATE UNIQUE INDEX "ChainOperation_txHash_key" ON "ChainOperation"("txHash");

-- CreateIndex
CREATE INDEX "ChainOperation_state_nextAttemptAt_idx" ON "ChainOperation"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ChainOperation_actorAddress_createdAt_idx" ON "ChainOperation"("actorAddress", "createdAt");

-- CreateIndex
CREATE INDEX "ChainOperation_batchId_createdAt_idx" ON "ChainOperation"("batchId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QRToken_nonce_key" ON "QRToken"("nonce");

-- CreateIndex
CREATE INDEX "QRToken_batchId_idx" ON "QRToken"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "QRToken_batchId_jarIndex_key" ON "QRToken"("batchId", "jarIndex");

-- CreateIndex
CREATE INDEX "QRScan_qrTokenId_timestamp_idx" ON "QRScan"("qrTokenId", "timestamp");

-- CreateIndex
CREATE INDEX "ScanAlert_resolved_createdAt_idx" ON "ScanAlert"("resolved", "createdAt");

-- CreateIndex
CREATE INDEX "ScanAlert_batchId_idx" ON "ScanAlert"("batchId");

-- AddForeignKey
ALTER TABLE "DashboardAccount" ADD CONSTRAINT "DashboardAccount_beekeeperId_fkey" FOREIGN KEY ("beekeeperId") REFERENCES "Beekeeper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hive" ADD CONSTRAINT "Hive_beekeeperId_fkey" FOREIGN KEY ("beekeeperId") REFERENCES "Beekeeper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_hiveId_fkey" FOREIGN KEY ("hiveId") REFERENCES "Hive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInference" ADD CONSTRAINT "AIInference_hiveId_fkey" FOREIGN KEY ("hiveId") REFERENCES "Hive"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInference" ADD CONSTRAINT "AIInference_beekeeperId_fkey" FOREIGN KEY ("beekeeperId") REFERENCES "Beekeeper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoneyBatch" ADD CONSTRAINT "HoneyBatch_beekeeperId_fkey" FOREIGN KEY ("beekeeperId") REFERENCES "Beekeeper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoneyBatch" ADD CONSTRAINT "HoneyBatch_pendingOperationId_fkey" FOREIGN KEY ("pendingOperationId") REFERENCES "ChainOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HoneyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEvent" ADD CONSTRAINT "CustodyEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HoneyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainOperation" ADD CONSTRAINT "ChainOperation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HoneyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRToken" ADD CONSTRAINT "QRToken_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HoneyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QRScan" ADD CONSTRAINT "QRScan_qrTokenId_fkey" FOREIGN KEY ("qrTokenId") REFERENCES "QRToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanAlert" ADD CONSTRAINT "ScanAlert_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HoneyBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
