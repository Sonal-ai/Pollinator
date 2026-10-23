import { prisma } from '../lib/db';
import { assertDeployment, bindDeployment, deploymentConfig } from '../lib/deployment/identity';

export async function checkDeployment() { return assertDeployment(prisma, deploymentConfig()); }
export async function disconnectDeployment() { await prisma.$disconnect(); }
export async function initializeDeployment() {
  const { ChainTransport } = await import('../lib/chain/transport');
  const config = deploymentConfig(), chain = new ChainTransport();
  try {
    const observed = await chain.context();
    if (observed.chainId !== config.chainId || observed.registryAddress.toLowerCase() !== config.registryAddress.toLowerCase()
      || observed.forwarderAddress.toLowerCase() !== config.forwarderAddress.toLowerCase() || observed.genesisHash.toLowerCase() !== config.genesisHash.toLowerCase()) throw new Error('Live registry does not match the cluster manifest');
    await bindDeployment(prisma, config);
    if (process.env.NODE_ENV === 'production') {
      await prisma.$executeRawUnsafe('REVOKE INSERT, UPDATE, DELETE ON "DeploymentIdentity" FROM honeychain_app');
      await prisma.$executeRawUnsafe('REVOKE ALL ON "_prisma_migrations" FROM honeychain_app');
    }
  } finally { chain.provider.destroy(); await prisma.$disconnect(); }
}
export async function validateDeployment() {
  try { await checkDeployment(); } finally { await prisma.$disconnect(); }
}
