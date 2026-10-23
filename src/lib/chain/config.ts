import { env } from '../env';

import fs from 'fs';
import path from 'path';

// ============================================================
// Network Helpers
// ============================================================

export function isLocalChain(): boolean {
  const net = (env.BLOCKCHAIN_NETWORK || 'local').toLowerCase();
  return net === 'local' || net === 'localhost';
}

export function getActiveNetworkName(): string {
  return isLocalChain() ? 'Hardhat Localhost' : 'Polygon Amoy';
}

function getDeployedAddressFromFile(networkKey: 'localhost' | 'polygon-amoy'): string | null {
  try {
    const filePath = path.join(process.cwd(), 'deployed-address.json');
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.networks && data.networks[networkKey]?.address) {
        return data.networks[networkKey].address;
      }
      if (data.network === networkKey && data.address) {
        return data.address;
      }
    }
  } catch {
    // Ignore error
  }
  return null;
}

export function getActiveContractAddress(): string | null {
  if (isLocalChain()) {
    return (
      env.LOCAL_CONTRACT_ADDRESS ||
      getDeployedAddressFromFile('localhost') ||
      env.CONTRACT_ADDRESS ||
      null
    );
  }
  return (
    env.CONTRACT_ADDRESS ||
    getDeployedAddressFromFile('polygon-amoy') ||
    null
  );
}

export function getActiveRpcUrl(): string {
  if (isLocalChain()) {
    return env.LOCAL_RPC_URL || 'http://127.0.0.1:8545';
  }
  return env.AMB_ENDPOINT || env.POLYGON_RPC_URL || 'https://polygon-amoy.drpc.org';
}

export function getActivePrivateKey(): string | null {
  if (isLocalChain()) {
    if (process.env.NODE_ENV === 'production') return null;
    return env.LOCAL_PRIVATE_KEY || null;
  }
  return env.RELAYER_PRIVATE_KEY || null;
}

export function getExplorerTxUrl(txHash: string | null | undefined): string | null {
  if (!txHash) return null;
  if (isLocalChain()) {
    return null; // Local node transactions have no public Polygonscan link
  }
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string | null | undefined): string | null {
  if (!address) return null;
  if (isLocalChain()) {
    return null;
  }
  return `https://amoy.polygonscan.com/address/${address}`;
}
