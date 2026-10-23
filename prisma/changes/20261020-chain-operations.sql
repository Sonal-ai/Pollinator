-- Existing deployments: apply after the account and packaging changes. Back up first.
-- Fresh deployments: use prisma migrate deploy instead.
BEGIN;
-- CreateEnum
CREATE TYPE "ChainOperationState" AS ENUM ('AWAITING_SIGNATURE', 'READY', 'SIGNED', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'NEEDS_REVIEW');

-- AlterTable
ALTER TABLE "HoneyBatch" ADD COLUMN     "pendingOperationId" TEXT,
ADD COLUMN     "recallReason" TEXT,
ADD COLUMN     "recallTxHash" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "chainOperationId" TEXT;

-- AlterTable
ALTER TABLE "CustodyEvent" ADD COLUMN     "chainOperationId" TEXT;

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
CREATE UNIQUE INDEX "HoneyBatch_pendingOperationId_key" ON "HoneyBatch"("pendingOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_chainOperationId_key" ON "Certificate"("chainOperationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustodyEvent_chainOperationId_key" ON "CustodyEvent"("chainOperationId");

-- AddForeignKey
ALTER TABLE "HoneyBatch" ADD CONSTRAINT "HoneyBatch_pendingOperationId_fkey" FOREIGN KEY ("pendingOperationId") REFERENCES "ChainOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainOperation" ADD CONSTRAINT "ChainOperation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "HoneyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


COMMIT;
