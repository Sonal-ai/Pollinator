/**
 * Pollinator Complete End-to-End Demo Seed Script
 * 
 * Sets up:
 * 1. Beekeeper Sonal (Phone: 8882218036)
 * 2. Smart Hive ESP32-001 with active telemetry
 * 3. Supply Chain Actors (Transporter, Lab, Processor)
 * 4. Batch 1: HC-2026-MH01-000101 (Packaged, Retail, QR Ready)
 * 5. Batch 2: HC-2026-MH01-000102 (In Distribution / Transporter)
 * 6. Batch 3: HC-2026-MH01-000103 (Harvested / Ready for live demo custody transfer)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const { ethers } = require('ethers');

// Helper to derive deterministic wallets
function deriveWallet(identifier) {
  const secret = process.env.WHATSAPP_APP_SECRET || process.env.JWT_SECRET || 'pollinator-fallback-secret';
  const privateKeyHex = '0x' + crypto.createHmac('sha256', secret).update(identifier.toLowerCase()).digest('hex');
  return new ethers.Wallet(privateKeyHex).address;
}

// Helper to generate HMAC signature for QRs
function generateQRSignature(batchCode, nonce) {
  const qrSecret = process.env.QR_HMAC_SECRET || 'c31874eb8969e60284c7a93cc1974e11400c580abb2712b8277daf9a104d1a80';
  return crypto.createHmac('sha256', qrSecret).update(`${batchCode}:${nonce}`).digest('hex');
}

async function main() {
  console.log('🧹 Clearing old demo records...');
  await prisma.scanAlert.deleteMany({});
  await prisma.qRScan.deleteMany({});
  await prisma.qRToken.deleteMany({});
  await prisma.custodyEvent.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.honeyBatch.deleteMany({});
  await prisma.sensorReading.deleteMany({});
  await prisma.hive.deleteMany({});
  await prisma.beekeeper.deleteMany({});

  console.log('👤 Seeding Beekeeper Sonal (Phone: 8882218036)...');
  const sonalWallet = deriveWallet('8882218036');
  const sonal = await prisma.beekeeper.create({
    data: {
      phone: '8882218036',
      name: 'Sonal',
      region: 'Wardha, Maharashtra',
      hivesCount: 15,
      practices: 'Apis cerana indica, 100% Organic Floral Nectar',
      kvicId: 'KVIC-MH-2026-888',
      wallet: sonalWallet,
    },
  });

  console.log('🐝 Seeding Smart Hive ESP32-001...');
  const hive = await prisma.hive.create({
    data: {
      deviceId: 'ESP32-001',
      beekeeperId: sonal.id,
      region: 'Wardha, Maharashtra',
      latitude: 20.7453,
      longitude: 78.6022,
    },
  });

  // Seed recent sensor telemetry readings
  const now = Date.now();
  await prisma.sensorReading.createMany({
    data: [
      {
        hiveId: hive.id,
        tempC: 34.9,
        humidityPct: 56.5,
        weightKg: 47.8,
        batteryPct: 96,
        timestamp: new Date(now - 120000), // 2 mins ago
      },
      {
        hiveId: hive.id,
        tempC: 35.1,
        humidityPct: 57.0,
        weightKg: 48.2,
        batteryPct: 95,
        timestamp: new Date(now - 60000), // 1 min ago
      },
      {
        hiveId: hive.id,
        tempC: 35.0,
        humidityPct: 56.8,
        weightKg: 48.5,
        batteryPct: 95,
        timestamp: new Date(now), // Just now
      },
    ],
  });

  // Define Actor Wallets
  const transporterWallet = deriveWallet('distributor@pollinator.com');
  const labWallet = deriveWallet('lab@pollinator.com');
  const processorWallet = deriveWallet('processor@pollinator.com');

  console.log('📦 Seeding Batch 1: HC-2026-MH01-000101 (Fully Packaged & QR Ready)...');
  const batch1Code = 'HC-2026-MH01-000101';
  const batch1 = await prisma.honeyBatch.create({
    data: {
      batchCode: batch1Code,
      batch_id_hash: ethers.id(batch1Code),
      beekeeperId: sonal.id,
      quantity_grams: 25000, // 25 kg
      honey_type: 'Raw Organic Multiflora Honey',
      hives_harvested: 8,
      harvest_timestamp: new Date(now - 86400000 * 3), // 3 days ago
      region: 'Wardha, Maharashtra',
      status: 'PACKAGED',
      current_custodian: processorWallet,
      lab_verified: true,
      recalled: false,
      metadataCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
      metadataHash: '0xabc123789fedcba4567890123456789012345678901234567890123456789012',
      txHash: '0x7b8c2d119ec845a7bb9104c4b650a3d926a8f777f96422d790b0e36eb29b47a',
    },
  });

  // Seed QA Lab Certificate for Batch 1
  await prisma.certificate.create({
    data: {
      batchId: batch1.id,
      labActorId: labWallet,
      certificateHash: '0x8f2d119ec845a7bb9104c4b650a3d926a8f777f96422d790b0e36eb29b47a',
      ipfsCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
      txHash: '0x321ab0e36eb29b47a98210ddb6ed7cc7e460712345678901234567890123456',
    },
  });

  // Seed Custody Handover Events for Batch 1
  await prisma.custodyEvent.createMany({
    data: [
      {
        batchId: batch1.id,
        from: sonalWallet,
        to: transporterWallet,
        stage: 'PROCESSED',
        txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        createdAt: new Date(now - 86400000 * 2),
      },
      {
        batchId: batch1.id,
        from: transporterWallet,
        to: labWallet,
        stage: 'LAB_VERIFIED',
        txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        createdAt: new Date(now - 86400000 * 1.5),
      },
      {
        batchId: batch1.id,
        from: labWallet,
        to: processorWallet,
        stage: 'PACKAGED',
        txHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        createdAt: new Date(now - 86400000 * 1),
      },
    ],
  });

  // Seed 5 QR Tokens for Batch 1 with valid HMAC signatures
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const qrTokensData = [];
  const primaryNonce = '1001-demo-jar-nonce-001';
  const primarySig = generateQRSignature(batch1Code, primaryNonce);

  const qrToken1 = await prisma.qRToken.create({
    data: {
      batchId: batch1.id,
      nonce: primaryNonce,
      signature: primarySig,
      jarIndex: 1,
      jarSizeGrams: 500,
      active: true,
    },
  });

  // Add initial scan history for Jar #1
  await prisma.qRScan.create({
    data: {
      qrTokenId: qrToken1.id,
      ipRegion: 'Maharashtra',
      ipCity: 'Wardha',
      ipCountry: 'IN',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      timestamp: new Date(now - 3600000), // 1 hr ago
    },
  });

  // Seed Remaining Jars 2 through 5
  for (let i = 2; i <= 5; i++) {
    const nonce = `100${i}-demo-jar-nonce-00${i}`;
    const sig = generateQRSignature(batch1Code, nonce);
    await prisma.qRToken.create({
      data: {
        batchId: batch1.id,
        nonce,
        signature: sig,
        jarIndex: i,
        jarSizeGrams: 500,
        active: true,
      },
    });
  }

  console.log('🚚 Seeding Batch 2: HC-2026-MH01-000102 (In Transit with Transporter)...');
  const batch2Code = 'HC-2026-MH01-000102';
  await prisma.honeyBatch.create({
    data: {
      batchCode: batch2Code,
      batch_id_hash: ethers.id(batch2Code),
      beekeeperId: sonal.id,
      quantity_grams: 40000, // 40 kg
      honey_type: 'Pure Mustard Blossom Honey',
      hives_harvested: 10,
      harvest_timestamp: new Date(now - 86400000), // Yesterday
      region: 'Wardha, Maharashtra',
      status: 'IN_DISTRIBUTION',
      current_custodian: transporterWallet,
      lab_verified: false,
      recalled: false,
    },
  });

  console.log('🌾 Seeding Batch 3: HC-2026-MH01-000103 (Fresh Harvest with Sonal)...');
  const batch3Code = 'HC-2026-MH01-000103';
  await prisma.honeyBatch.create({
    data: {
      batchCode: batch3Code,
      batch_id_hash: ethers.id(batch3Code),
      beekeeperId: sonal.id,
      quantity_grams: 50000, // 50 kg
      honey_type: 'Raw Forest Wildflower Honey',
      hives_harvested: 12,
      harvest_timestamp: new Date(now), // Today
      region: 'Wardha, Maharashtra',
      status: 'HARVESTED',
      current_custodian: sonalWallet,
      lab_verified: false,
      recalled: false,
    },
  });

  console.log('\n======================================================');
  console.log('🎉 SEED COMPLETE! DEMO READY');
  console.log('======================================================');
  console.log('👤 Beekeeper: Sonal (Phone: 8882218036)');
  console.log('🔑 Sonal Wallet:', sonalWallet);
  console.log('📦 Batch 1 (Packaged, Retail, QR Ready):', batch1Code);
  console.log(`🔗 Verified QR Link: ${appUrl}/verify?b=${batch1Code}&n=${primaryNonce}&sig=${primarySig}`);
  console.log('🚚 Batch 2 (In Transit with Transporter):', batch2Code);
  console.log('🌾 Batch 3 (Fresh Harvest with Sonal):', batch3Code);
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
