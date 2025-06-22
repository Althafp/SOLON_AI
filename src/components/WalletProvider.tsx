'use client';

import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { useMemo, useEffect } from 'react';
import { WalletNotification } from '@/utils/walletConfig';
import '@solana/wallet-adapter-react-ui/styles.css';

export const SolanaWalletProvider = ({ children }: { children: React.ReactNode }) => {
  const endpoint = useMemo(() => 'https://mainnet.helius-rpc.com/?api-key=2a8f3530-07d5-4ee9-b5ef-6f517cd84e88', []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  useEffect(() => {
    wallets.forEach((wallet) => {
      wallet.on('connect', () => WalletNotification.onConnect(wallet.name));
      wallet.on('disconnect', () => WalletNotification.onDisconnect(wallet.name));
      wallet.on('error', (error: Error) => WalletNotification.onError(error));
      if (!wallet.readyState) {
        WalletNotification.onNotInstalled(wallet.name);
      }
    });

    return () => {
      wallets.forEach((wallet) => {
        wallet.off('connect', () => WalletNotification.onConnect(wallet.name));
        wallet.off('disconnect', () => WalletNotification.onDisconnect(wallet.name));
        wallet.off('error', (error: Error) => WalletNotification.onError(error));
      });
    };
  }, [wallets]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};