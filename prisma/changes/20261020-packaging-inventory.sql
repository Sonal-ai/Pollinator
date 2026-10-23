-- Apply only after backing up the target database and reviewing legacy label inventory.
-- This transaction aborts if old duplicate serial indices need manual reconciliation.
BEGIN;
ALTER TABLE "HoneyBatch" ADD COLUMN IF NOT EXISTS "jarCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HoneyBatch" ADD COLUMN IF NOT EXISTS "jarSizeGrams" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HoneyBatch" ADD COLUMN IF NOT EXISTS "packagingTxHash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "QRToken_batchId_jarIndex_key" ON "QRToken"("batchId", "jarIndex");
COMMIT;
