const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const token = await prisma.qRToken.findUnique({
    where: { nonce: 'af44726f-27cd-480b-ac60-1a8576f7a6e0' },
    include: {
      scans: { orderBy: { timestamp: 'desc' } },
    },
  });

  const alerts = token ? await prisma.scanAlert.findMany({ where: { qrTokenId: token.id } }) : [];

  console.log('Token scans count:', token?.scans?.length);
  console.log('Scans:', JSON.stringify(token?.scans, null, 2));
  console.log('Alerts:', JSON.stringify(alerts, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
