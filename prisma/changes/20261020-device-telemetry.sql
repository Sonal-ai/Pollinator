-- Existing databases: apply after chain operations, after backup and schema review.
BEGIN;
-- CreateEnum
CREATE TYPE "TelemetrySource" AS ENUM ('DEVICE', 'SIMULATED', 'LEGACY');

-- AlterTable
ALTER TABLE "SensorReading" ADD COLUMN     "credentialId" TEXT,
ADD COLUMN     "epoch" TEXT,
ADD COLUMN     "packetHash" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sequence" INTEGER,
ADD COLUMN     "source" "TelemetrySource" NOT NULL DEFAULT 'LEGACY';

-- CreateTable
CREATE TABLE "DeviceCredential" (
    "id" TEXT NOT NULL,
    "hiveId" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "epoch" TEXT NOT NULL,
    "source" "TelemetrySource" NOT NULL DEFAULT 'SIMULATED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCredential_hiveId_key" ON "DeviceCredential"("hiveId");

-- CreateIndex
CREATE UNIQUE INDEX "SensorReading_credentialId_epoch_sequence_key" ON "SensorReading"("credentialId", "epoch", "sequence");

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "DeviceCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCredential" ADD CONSTRAINT "DeviceCredential_hiveId_fkey" FOREIGN KEY ("hiveId") REFERENCES "Hive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
