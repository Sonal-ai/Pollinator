const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const beekeeper = await prisma.beekeeper.create({
    data: {
      phone: '+1234567890',
      name: 'Alice Apiary',
      region: 'California',
      hivesCount: 50,
      wallet: '0x1234567890123456789012345678901234567890',
    },
  });

  const hive = await prisma.hive.create({
    data: {
      beekeeperId: beekeeper.id,
      deviceId: 'ESP32-001',
      region: 'California',
    },
  });

  await prisma.sensorReading.create({
    data: {
      hiveId: hive.id,
      tempC: 35.2,
      humidityPct: 60.1,
      weightKg: 45.3,
      batteryPct: 90,
    },
  });

  const batch = await prisma.honeyBatch.create({
    data: {
      batchCode: 'HC-2026-CA01-123456',
      batch_id_hash: 'dummyhash123',
      beekeeperId: beekeeper.id,
      quantity_grams: 50000,
      honey_type: 'Wildflower',
      hives_harvested: 10,
      region: 'California',
      status: 'HARVESTED',
      current_custodian: '0x1234567890123456789012345678901234567890',
    }
  });

  await prisma.scanAlert.create({
    data: {
      batchId: batch.id,
      alertType: 'GEOGRAPHIC_ANOMALY',
      details: JSON.stringify({ regions: ['California', 'New York'] }),
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
