ALTER TABLE "WhatsAppDeliveryEvent" ADD COLUMN "appliedAt" TIMESTAMP(3);
CREATE INDEX "WhatsAppDeliveryEvent_appliedAt_createdAt_idx" ON "WhatsAppDeliveryEvent"("appliedAt", "createdAt");
