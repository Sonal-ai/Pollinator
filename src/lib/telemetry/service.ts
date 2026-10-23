import type { PrismaClient, SensorReading } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { checkPacketTime, packetHash, parsePacket, TelemetryError, verifyPacket } from './protocol';
import { decryptDeviceSecret } from './secrets';
import { createStoredReceipt, type StoredReceipt } from './acknowledgement';

export class TelemetryService {
  constructor(private db: PrismaClient) {}
  private async authenticate(bytes: Buffer, signature: string) {
    const packet = parsePacket(bytes);
    const enrolled = await this.db.deviceCredential.findFirst({ where: { hive: { deviceId: packet.deviceId } }, include: { hive: true } });
    if (!enrolled || !enrolled.active || enrolled.epoch !== packet.epoch) throw new TelemetryError('Device credential is invalid or revoked', 401);
    const context = `${packet.deviceId}:${enrolled.epoch}`;
    const secret = decryptDeviceSecret(enrolled.encryptedSecret, context);
    if (!verifyPacket(bytes, signature, secret)) throw new TelemetryError('Device signature is invalid', 401);
    return { packet, enrolled, secret };
  }
  /** Read-only lookup: a phone relay can never bypass MQTT ingestion to manufacture a stored row. */
  async deliveryStatus(bytes: Buffer, signature: string, now = new Date()) {
    const { packet, enrolled, secret } = await this.authenticate(bytes, signature);
    const reading = await this.db.sensorReading.findUnique({ where: { credentialId_epoch_sequence:
      { credentialId: enrolled.id, epoch: packet.epoch, sequence: packet.sequence } } });
    if (reading) {
      if (reading.packetHash !== packetHash(bytes)) throw new TelemetryError('This device sequence was already used for different content', 409);
      return { source: reading.source, receipt: createStoredReceipt(bytes, reading, secret) };
    }
    checkPacketTime(packet, now);
    return { source: enrolled.source, receipt: null };
  }
  async ingest(bytes: Buffer, signature: string, now = new Date()): Promise<{ reading: SensorReading; duplicate: boolean; receipt: StoredReceipt }> {
    const { packet, enrolled, secret } = await this.authenticate(bytes, signature);
    const identity = { credentialId: enrolled.id, epoch: packet.epoch, sequence: packet.sequence };
    const hash = packetHash(bytes);
    const existing = () => this.db.sensorReading.findUnique({ where: { credentialId_epoch_sequence: identity } });
    const duplicate = (reading: SensorReading) => {
      if (reading.packetHash !== hash) throw new TelemetryError('This device sequence was already used for different content', 409);
      return { reading, duplicate: true, receipt: createStoredReceipt(bytes, reading, secret) };
    };
    const saved = await existing();
    if (saved) return duplicate(saved);
    checkPacketTime(packet, now);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const reading = await this.db.$transaction(async tx => {
          const credential = await tx.deviceCredential.findFirst({ where: { id: enrolled.id, active: true, epoch: packet.epoch, encryptedSecret: enrolled.encryptedSecret, updatedAt: enrolled.updatedAt } });
          if (!credential) throw new TelemetryError('Device credential changed before ingestion', 401);
          return tx.sensorReading.create({ data: { ...identity, hiveId: enrolled.hiveId, source: credential.source,
            ...packet.metrics, timestamp: new Date(packet.observedAt), receivedAt: now, packetHash: hash } });
        }, { isolationLevel: 'Serializable' });
        return { reading, duplicate: false, receipt: createStoredReceipt(bytes, reading, secret) };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') { const row = await existing(); if (row) return duplicate(row); }
          if (error.code === 'P2034' && attempt < 2) continue;
        }
        throw error;
      }
    }
    throw new TelemetryError('Telemetry storage is busy; retry the same signed packet', 503);
  }
}
