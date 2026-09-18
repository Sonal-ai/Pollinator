const { execSync } = require('child_process');

const commitMap = {
  'next.config.ts': 'Configure standalone output for AWS Docker deployment',
  'package.json': 'Update dependencies and scripts for production build',
  'package-lock.json': 'Lock production dependencies',
  'prisma/schema.prisma': 'Add recall flags and custody tracking fields to database schema',
  'src/app/api/webhook/whatsapp/route.ts': 'Handle incoming whatsapp payloads and media',
  'src/app/dashboard/page.tsx': 'Filter batch registry by user role and wallet',
  'src/app/page.tsx': 'Clean up landing page redirects',
  'src/lib/whatsapp/bedrock.ts': 'Add AWS Bedrock integration for conversational bot',
  'src/lib/whatsapp/client.ts': 'Configure Meta WhatsApp Cloud API client',
  'src/lib/whatsapp/fsm.ts': 'Implement finite state machine for whatsapp flows',
  'Dockerfile': 'Add multi-stage dockerfile for AWS ECS',
  'contracts/HoneyChain.sol': 'Allow admins to act as gas relayers in custody transfers',
  'docker-compose.yml': 'Setup local docker compose environment',
  'hardhat.config.js': 'Configure hardhat for Polygon Amoy testnet',
  'scripts/deploy.js': 'Add smart contract deployment script',
  'src/app/api/alerts/[alertId]/resolve/route.ts': 'Secure alert resolution endpoint to admins only',
  'src/app/api/auth/login/route.ts': 'Add JWT session generation for web dashboard',
  'src/app/api/batch/[batchCode]/package/route.ts': 'Implement processor packaging API with blockchain minting',
  'src/app/api/batch/[batchCode]/recall/route.ts': 'Implement admin batch recall endpoint',
  'src/app/api/batch/[batchCode]/route.ts': 'Add batch details lookup API',
  'src/app/api/batch/route.ts': 'Add batch creation API',
  'src/app/api/certificate/route.ts': 'Secure lab certificate upload API with session auth',
  'src/app/api/custody/route.ts': 'Add session auth to custody transfer API',
  'src/app/api/custody/transfer/route.ts': 'Remove deprecated custody transfer route',
  'src/app/api/iot/[hiveId]/route.ts': 'Add IoT hive lookup API',
  'src/app/api/ipfs/route.ts': 'Integrate Pinata for IPFS metadata uploads',
  'src/app/api/qr/generate/route.ts': 'Remove deprecated QR generation route',
  'src/app/api/qr/route.ts': 'Secure QR generation API for processors',
  'src/app/api/qr/verify/route.ts': 'Redirect old QR verify route',
  'src/app/api/sensor-data/route.ts': 'Add IoT sensor telemetry ingestion API',
  'src/app/dashboard/analytics/page.tsx': 'Build scan analytics and geo-anomaly dashboard',
  'src/app/dashboard/batch/[batchCode]/page.tsx': 'Build detailed batch view with custody timeline',
  'src/app/dashboard/custody/custody-form.tsx': 'Add client component for custody transfers',
  'src/app/dashboard/custody/page.tsx': 'Convert custody page to secure server component',
  'src/app/dashboard/iot/chart-client.tsx': 'Add Recharts visualization for IoT telemetry',
  'src/app/dashboard/iot/page.tsx': 'Secure IoT dashboard for beekeepers',
  'src/app/dashboard/lab/page.tsx': 'Upgrade lab dashboard to fetch pending batches',
  'src/app/dashboard/lab/upload-form.tsx': 'Add client form for lab certificate uploads',
  'src/app/dashboard/layout.tsx': 'Add processor role to sidebar navigation',
  'src/app/dashboard/login/page.tsx': 'Add processor option to login dropdown',
  'src/app/dashboard/processor/packaging-form.tsx': 'Build packaging and QR generation client UI',
  'src/app/dashboard/processor/page.tsx': 'Build processor packaging server page',
  'src/app/dashboard/recall/admin-actions.tsx': 'Add client buttons for admin recall actions',
  'src/app/dashboard/recall/page.tsx': 'Upgrade recall dashboard UI and client components',
  'src/app/verify/page.tsx': 'Build consumer QR verification page with anti-clone checks',
  'src/lib/anti-clone.ts': 'Implement geographic and volume-based QR anomaly detection',
  'src/lib/blockchain.ts': 'Add ethers.js integration for Polygon interactions',
  'src/lib/env.ts': 'Add zod environment variable validation',
  'src/lib/ipfs.ts': 'Add IPFS integrity verification utils',
  'src/lib/qr.ts': 'Implement cryptographic QR signatures and validation',
  'src/lib/whatsapp/handler.ts': 'Implement auto-wallet generation and IoT pairing in bot',
  'src/middleware.ts': 'Add Next.js edge middleware for routing',
  'test/HoneyChain.test.js': 'test: update smart contract test coverage for gas relayer fixes',
  '.gitignore': 'Ignore hardhat artifacts and cache'
};

const stdout = execSync('git status --porcelain -u').toString();
const files = stdout.split('\n')
  .filter(line => line.trim().length > 0)
  .map(line => line.substring(3))
  .filter(f => !f.startsWith('artifacts/') && !f.startsWith('cache/'));

for (const file of files) {
  let msg = commitMap[file];
  if (!msg) {
    if (file.includes('route.ts')) msg = 'Implement backend API endpoint';
    else if (file.includes('page.tsx')) msg = 'Build UI dashboard page';
    else msg = `Update ${file.split('/').pop()}`;
  }

  try {
    execSync(`git add "${file}"`);
    execSync(`git commit -m "${msg}"`);
  } catch (e) {
  }
}
