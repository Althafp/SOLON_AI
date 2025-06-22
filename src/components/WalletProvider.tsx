'use client';

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useMemo } from 'react';

require('@solana/wallet-adapter-react-ui/styles.css');

export const SolanaWalletProvider = ({ children }: { children: React.ReactNode }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => 'https://api.mainnet-beta.solana.com', []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
