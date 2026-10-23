CREATE TABLE "WhatsAppSendAttempt" (
  "id" TEXT PRIMARY KEY, "outboxId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'SENDING',
  "leaseUntil" TIMESTAMP(3) NOT NULL, "providerMessageId" TEXT UNIQUE, "providerErrorCode" INTEGER,
  "lastError" TEXT, "acceptedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppSendAttempt_outboxId_fkey" FOREIGN KEY("outboxId") REFERENCES "WhatsAppOutbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WhatsAppSendAttempt_outboxId_createdAt_idx" ON "WhatsAppSendAttempt"("outboxId", "createdAt");
CREATE TABLE "WhatsAppReviewEvent" (
  "id" TEXT PRIMARY KEY, "targetKind" TEXT NOT NULL, "targetId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "accountId" TEXT NOT NULL, "reason" TEXT NOT NULL, "previousState" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WhatsAppReviewEvent_targetKind_targetId_createdAt_idx" ON "WhatsAppReviewEvent"("targetKind", "targetId", "createdAt");
