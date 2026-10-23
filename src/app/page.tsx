import { HomeView } from '@/components/home/home-view';
import { connection } from 'next/server';
import {
  getActiveContractAddress,
  getActiveNetworkName,
  getExplorerAddressUrl,
  isLocalChain,
} from '@/lib/blockchain';

export default async function HomePage() {
  await connection(); // Registry and contact details belong to this running cluster, not the build machine.
  const contractAddress = getActiveContractAddress() || '';
  const networkName = getActiveNetworkName();
  const isLocal = isLocalChain();
  const explorerUrl = getExplorerAddressUrl(contractAddress);
  const whatsappNumber = process.env.WHATSAPP_PUBLIC_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <HomeView
      contractAddress={contractAddress}
      networkName={networkName}
      explorerUrl={explorerUrl}
      isLocal={isLocal}
      whatsappNumber={whatsappNumber}
    />
  );
}
