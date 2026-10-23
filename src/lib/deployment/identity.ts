import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/).refine(value => !/^0x0{40}$/.test(value));
const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
export const DeploymentSchema = z.object({
  clusterId: z.string().regex(/^[a-z][a-z0-9-]{2,39}$/),
  chainId: z.number().int().positive(), registryAddress: address, forwarderAddress: address, genesisHash: hash,
});
export type DeploymentConfig = z.infer<typeof DeploymentSchema>;
export function deploymentConfig(): DeploymentConfig {
  if (process.env.HONEYCHAIN_CLUSTER_MODE !== 'isolated') throw new Error('This release entry point requires isolated cluster mode');
  const config = DeploymentSchema.parse({ clusterId: process.env.CLUSTER_ID, chainId: Number(process.env.REGISTRY_CHAIN_ID),
    registryAddress: process.env.CONTRACT_ADDRESS, forwarderAddress: process.env.REGISTRY_FORWARDER_ADDRESS, genesisHash: process.env.REGISTRY_GENESIS_HASH });
  if (process.env.NODE_ENV === 'production') {
    if (config.chainId !== 80002 || !['amoy','polygonAmoy'].includes(process.env.BLOCKCHAIN_NETWORK || '')) throw new Error('Production prototype deployment requires the explicitly configured Amoy testnet');
    if (process.env.LOCAL_TEST_SIGNING === 'true' || process.env.LOCAL_PRIVATE_KEY) throw new Error('Local fixture credentials are forbidden in a production cluster');
    const url = new URL(process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('A public HTTPS application origin is required');
  }
  return config;
}
function matches(stored: DeploymentConfig, expected: DeploymentConfig) {
  return stored.clusterId === expected.clusterId && stored.chainId === expected.chainId
    && stored.registryAddress.toLowerCase() === expected.registryAddress.toLowerCase()
    && stored.forwarderAddress.toLowerCase() === expected.forwarderAddress.toLowerCase()
    && stored.genesisHash.toLowerCase() === expected.genesisHash.toLowerCase();
}
export async function assertDeployment(db: PrismaClient, expected: DeploymentConfig) {
  const stored = await db.deploymentIdentity.findUnique({ where: { id: 'primary' } });
  if (!stored || !matches(stored, expected)) throw new Error('Database deployment identity does not match this cluster, registry and chain. Startup refused.');
  return stored;
}
export async function bindDeployment(db: PrismaClient, expected: DeploymentConfig) {
  const parsed = DeploymentSchema.parse(expected);
  const existing = await db.deploymentIdentity.findUnique({ where: { id: 'primary' } });
  if (existing) return assertDeployment(db, parsed); // Never overwrite another cluster binding.
  try { return await db.deploymentIdentity.create({ data: { id: 'primary', ...parsed } }); }
  catch { return assertDeployment(db, parsed); } // Concurrent initialization may only accept the identical binding.
}
