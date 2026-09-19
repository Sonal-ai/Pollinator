/**
 * Pollinator Complete End-to-End Demo Seed Script
 * 
 * Sets up:
 * 1. Flushes Redis session & dedup keys
 * 2. Beekeeper Sonal (Phone: 8882218036, Wallet: 0x2739d8...)
 * 3. Smart Hive ESP32-001 with active telemetry
 * 4. Supply Chain Actors (Transporter, Lab, Processor, Retailer, Admin)
 * 5. Multi-Stage Pipeline Batches:
 *    - Batch 1: HC-2026-MH01-000101 (Packaged, Retail, HMAC QR Ready)
 *    - Batch 2: HC-2026-MH01-000102 (In Transit with Transporter / Ready to hand over to Lab)
 *    - Batch 3: HC-2026-MH01-000103 (Fresh Harvest with Sonal / Ready for live custody transfer)
 *    - Batch 4: HC-2026-MH01-000104 (At QA Lab / Ready for purity certificate upload)
 *    - Batch 5: HC-2026-MH01-000123 (User's Exact Bookmarked QR Link: nonce af44726f...)
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const { ethers } = require('ethers');

// Helper to derive deterministic wallets matching login & whatsapp
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

async function flushRedis() {
  try {
    const Redis = require('ioredis');
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1500 });
    await redis.connect();
    await redis.flushall();
    console.log('⚡ Redis cache & sessions flushed successfully (FLUSHALL)');
    redis.disconnect();
  } catch (err) {
    console.warn('⚠️  Redis flush skipped (running in memory-fallback mode):', err.message);
  }
}

async function main() {
  await flushRedis();

  console.log('🧹 Clearing old demo database records...');
  await prisma.scanAlert.deleteMany({});
  await prisma.qRScan.deleteMany({});
  await prisma.qRToken.deleteMany({});
  await prisma.custodyEvent.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.honeyBatch.deleteMany({});
  await prisma.sensorReading.deleteMany({});
  await prisma.hive.deleteMany({});
  await prisma.beekeeper.deleteMany({});
  await prisma.whatsAppUser.deleteMany({});

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

  // Supply Chain Actor Wallets
  const transporterWallet = deriveWallet('distributor@pollinator.com');
  const labWallet = deriveWallet('lab@pollinator.com');
  const processorWallet = deriveWallet('processor@pollinator.com');
  const retailerWallet = deriveWallet('retailer@pollinator.com');
  const adminWallet = deriveWallet('admin@pollinator.com');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // -------------------------------------------------------------
  // Batch 1: Packaged & Retail Ready (Multiflora Honey, 25 kg)
  // -------------------------------------------------------------
  console.log('📦 Seeding Batch 1: HC-2026-MH01-000101 (Packaged, Retail Ready)...');
  const batch1Code = 'HC-2026-MH01-000101';
  const batch1 = await prisma.honeyBatch.create({
    data: {
      batchCode: batch1Code,
      batch_id_hash: ethers.id(batch1Code),
      beekeeperId: sonal.id,
      quantity_grams: 25000,
      honey_type: 'Raw Organic Multiflora Honey',
      hives_harvested: 8,
      harvest_timestamp: new Date(now - 86400000 * 3),
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

  await prisma.certificate.create({
    data: {
      batchId: batch1.id,
      labActorId: labWallet,
      certificateHash: '0x8f2d119ec845a7bb9104c4b650a3d926a8f777f96422d790b0e36eb29b47a',
      ipfsCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
      txHash: '0x321ab0e36eb29b47a98210ddb6ed7cc7e460712345678901234567890123456',
    },
  });

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

  // Seed initial scans
  await prisma.qRScan.createMany({
    data: [
      {
        qrTokenId: qrToken1.id,
        ipAddress: '127.0.0.1',
        ipRegion: 'Maharashtra',
        ipCity: 'Wardha',
        ipCountry: 'IN',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        timestamp: new Date(now - 3600000),
      },
      {
        qrTokenId: qrToken1.id,
        ipAddress: '127.0.0.1',
        ipRegion: 'India (Live Node)',
        ipCity: 'Mumbai',
        ipCountry: 'IN',
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        timestamp: new Date(now - 1800000),
      },
    ],
  });

  for (let i = 2; i <= 5; i++) {
    const nonce = `1001-demo-jar-nonce-00${i}`;
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

  // -------------------------------------------------------------
  // Batch 2: In Transit with Transporter (Acacia Honey, 40 kg)
  // -------------------------------------------------------------
  console.log('🚚 Seeding Batch 2: HC-2026-MH01-000102 (In Transit with Transporter)...');
  const batch2Code = 'HC-2026-MH01-000102';
  await prisma.honeyBatch.create({
    data: {
      batchCode: batch2Code,
      batch_id_hash: ethers.id(batch2Code),
      beekeeperId: sonal.id,
      quantity_grams: 40000,
      honey_type: 'Pure Mustard Blossom Honey',
      hives_harvested: 10,
      harvest_timestamp: new Date(now - 86400000),
      region: 'Wardha, Maharashtra',
      status: 'PROCESSED',
      current_custodian: transporterWallet,
      lab_verified: false,
      recalled: false,
    },
  });

  // -------------------------------------------------------------
  // Batch 3: Fresh Harvest with Beekeeper Sonal (Wildflower Honey, 50 kg)
  // -------------------------------------------------------------
  console.log('🌾 Seeding Batch 3: HC-2026-MH01-000103 (Fresh Harvest with Sonal)...');
  const batch3Code = 'HC-2026-MH01-000103';
  await prisma.honeyBatch.create({
    data: {
      batchCode: batch3Code,
      batch_id_hash: ethers.id(batch3Code),
      beekeeperId: sonal.id,
      quantity_grams: 50000,
      honey_type: 'Raw Forest Wildflower Honey',
      hives_harvested: 12,
      harvest_timestamp: new Date(now),
      region: 'Wardha, Maharashtra',
      status: 'HARVESTED',
      current_custodian: sonalWallet,
      lab_verified: false,
      recalled: false,
    },
  });

  // -------------------------------------------------------------
  // Batch 4: At QA Testing Laboratory (Eucalyptus Honey, 35 kg)
  // -------------------------------------------------------------
  console.log('🧪 Seeding Batch 4: HC-2026-MH01-000104 (Awaiting Lab Certification)...');
  const batch4Code = 'HC-2026-MH01-000104';
  await prisma.honeyBatch.create({
    data: {
      batchCode: batch4Code,
      batch_id_hash: ethers.id(batch4Code),
      beekeeperId: sonal.id,
      quantity_grams: 35000,
      honey_type: 'Raw Organic Eucalyptus Honey',
      hives_harvested: 7,
      harvest_timestamp: new Date(now - 86400000 * 2),
      region: 'Wardha, Maharashtra',
      status: 'PROCESSED',
      current_custodian: labWallet,
      lab_verified: false,
      recalled: false,
    },
  });

  // -------------------------------------------------------------
  // Batch 5: User Bookmark Match (HC-2026-MH01-000123)
  // -------------------------------------------------------------
  console.log('🔖 Seeding Batch 5: HC-2026-MH01-000123 (User Bookmarked QR Link)...');
  const batch5Code = 'HC-2026-MH01-000123';
  const batch5Nonce = 'af44726f-27cd-480b-ac60-1a8576f7a6e0';
  const batch5Sig = '20eeb79f8961ccf0fa998cff8abba7d41ec42d3293ead319abf30234d0db0910';

  const batch5 = await prisma.honeyBatch.create({
    data: {
      batchCode: batch5Code,
      batch_id_hash: ethers.id(batch5Code),
      beekeeperId: sonal.id,
      quantity_grams: 25000,
      honey_type: 'Raw Multiflora Blossom Honey',
      hives_harvested: 6,
      harvest_timestamp: new Date(now - 86400000 * 4),
      region: 'Wardha, Maharashtra',
      status: 'PACKAGED',
      current_custodian: processorWallet,
      lab_verified: true,
      recalled: false,
      metadataCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
      metadataHash: '0xabc123789fedcba4567890123456789012345678901234567890123456789012',
      txHash: '0x9b4ae1c0788d44e5fa68d9047ca87fa13c3b0e36eB29b47a',
    },
  });

  await prisma.certificate.create({
    data: {
      batchId: batch5.id,
      labActorId: labWallet,
      certificateHash: '0x8f2d119ec845a7bb9104c4b650a3d926a8f777f96422d790b0e36eb29b47a',
      ipfsCID: 'QmZ4tDuPp599Zghq43a41zH2X8cK9xP145yW5N7tQ',
      txHash: '0x321ab0e36eb29b47a98210ddb6ed7cc7e460712345678901234567890123456',
    },
  });

  const qrToken5 = await prisma.qRToken.create({
    data: {
      batchId: batch5.id,
      nonce: batch5Nonce,
      signature: batch5Sig,
      jarIndex: 1,
      jarSizeGrams: 500,
      active: true,
    },
  });

  await prisma.qRScan.create({
    data: {
      qrTokenId: qrToken5.id,
      ipAddress: '127.0.0.1',
      ipRegion: 'India (Live Node)',
      ipCity: 'Wardha Gateway',
      ipCountry: 'IN',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      timestamp: new Date(now),
    },
  });

  console.log('\n======================================================');
  console.log('🎉 SEED COMPLETE! DEMO READY');
  console.log('======================================================');
  console.log('🔑 CREDENTIALS FOR DEMO:');
  console.log('1. Beekeeper Sonal:  Phone: 8882218036 (Passwordless) | Email: beekeeper@pollinator.com (Pass: Pollinator@2026)');
  console.log('2. Transporter:      Email: transporter@pollinator.com (Pass: Pollinator@2026)');
  console.log('3. QA Laboratory:    Email: lab@pollinator.com (Pass: Pollinator@2026)');
  console.log('4. Processor:        Email: processor@pollinator.com (Pass: Pollinator@2026)');
  console.log('5. Admin:            Email: admin@pollinator.com (Pass: Pollinator@2026)');
  console.log('------------------------------------------------------');
  console.log('📦 SEEDED BATCHES:');
  console.log('• Batch 1 (Packaged, Retail, QR Ready):', batch1Code);
  console.log(`  🔗 QR Link: ${appUrl}/verify?b=${batch1Code}&n=${primaryNonce}&sig=${primarySig}`);
  console.log('• Batch 2 (In Transit with Transporter):', batch2Code);
  console.log('• Batch 3 (Fresh Harvest with Sonal):', batch3Code);
  console.log('• Batch 4 (Awaiting Lab Certificate):', batch4Code);
  console.log('• Batch 5 (Exact User Bookmarked Link):', batch5Code);
  console.log(`  🔗 User Bookmark: ${appUrl}/verify?b=${batch5Code}&n=${batch5Nonce}&sig=${batch5Sig}`);
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
