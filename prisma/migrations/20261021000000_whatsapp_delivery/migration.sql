CREATE TABLE "WhatsAppConversation" (
  "waId" TEXT PRIMARY KEY, "state" TEXT NOT NULL, "data" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "WhatsAppInbox" (
  "id" TEXT PRIMARY KEY, "sequence" BIGSERIAL NOT NULL UNIQUE, "waId" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "payloadHash" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "lastError" TEXT, "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WhatsAppInbox_waId_sequence_idx" ON "WhatsAppInbox"("waId", "sequence");
CREATE INDEX "WhatsAppInbox_state_nextAttemptAt_idx" ON "WhatsAppInbox"("state", "nextAttemptAt");
CREATE TABLE "WhatsAppOutbox" (
  "id" TEXT PRIMARY KEY, "sequence" BIGSERIAL NOT NULL UNIQUE, "inboxId" TEXT NOT NULL, "waId" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "payloadHash" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "providerMessageId" TEXT UNIQUE, "providerErrorCode" INTEGER,
  "lastError" TEXT, "acceptedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "readAt" TIMESTAMP(3),
  "reviewedBy" TEXT, "reviewReason" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppOutbox_inboxId_fkey" FOREIGN KEY("inboxId") REFERENCES "WhatsAppInbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "WhatsAppOutbox_waId_sequence_idx" ON "WhatsAppOutbox"("waId", "sequence");
CREATE INDEX "WhatsAppOutbox_state_nextAttemptAt_idx" ON "WhatsAppOutbox"("state", "nextAttemptAt");
CREATE TABLE "WhatsAppDeliveryEvent" (
  "id" TEXT PRIMARY KEY, "providerMessageId" TEXT NOT NULL, "waId" TEXT NOT NULL, "status" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL, "payload" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WhatsAppDeliveryEvent_providerMessageId_waId_idx" ON "WhatsAppDeliveryEvent"("providerMessageId", "waId");
