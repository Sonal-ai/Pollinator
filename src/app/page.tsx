import { HomeView } from '@/components/home/home-view';
import {
  getActiveContractAddress,
  getActiveNetworkName,
  getExplorerAddressUrl,
  isLocalChain,
} from '@/lib/blockchain';

export default function HomePage() {
  const contractAddress = getActiveContractAddress() || '0x4B650a3d926A8f777f96422d790B0e36eB29b47a';
  const networkName = getActiveNetworkName();
  const isLocal = isLocalChain();
  const explorerUrl = getExplorerAddressUrl(contractAddress);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '918882291014';

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
