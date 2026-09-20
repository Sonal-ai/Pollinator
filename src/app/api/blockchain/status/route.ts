import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import {
  getActiveNetworkName,
  getActiveContractAddress,
  getActiveRpcUrl,
  getActivePrivateKey,
  isLocalChain,
} from '@/lib/blockchain';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const network = getActiveNetworkName();
    const isLocal = isLocalChain();
    const contractAddress = getActiveContractAddress();
    const rpcUrl = getActiveRpcUrl();
    const pk = getActivePrivateKey();

    let walletAddress: string | null = null;
    let balanceFormatted = '0 POL';
    let balanceRaw = '0';

    if (pk) {
      try {
        const wallet = new ethers.Wallet(pk);
        walletAddress = wallet.address;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const balWei = await provider.getBalance(walletAddress);
        const etherVal = ethers.formatEther(balWei);
        balanceRaw = etherVal;
        balanceFormatted = `${parseFloat(etherVal).toFixed(4)} POL`;
      } catch (err) {
        console.warn('[blockchain-status] Failed to fetch balance:', err);
      }
    }

    return NextResponse.json({
      network,
      isLocal,
      contractAddress,
      walletAddress,
      balance: balanceFormatted,
      balanceRaw,
      contractUrl:
        contractAddress && !isLocal
          ? `https://amoy.polygonscan.com/address/${contractAddress}`
          : null,
      walletUrl:
        walletAddress && !isLocal
          ? `https://amoy.polygonscan.com/address/${walletAddress}`
          : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve blockchain status' },
      { status: 500 }
    );
  }
}
