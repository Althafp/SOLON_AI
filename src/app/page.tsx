'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (publicKey) {
      router.push('/chat');
    }
  }, [publicKey, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-black via-purple-900 to-gray-900 text-white px-4">
      <div className="bg-white/5 backdrop-blur-md p-10 rounded-2xl shadow-lg border border-white/10">
        <h1 className="text-4xl font-extrabold text-white mb-6 text-center drop-shadow-md">
          Connect Your Wallet
        </h1>
        <div className="flex justify-center">
          <WalletMultiButton className="!bg-gradient-to-r !from-purple-600 !to-purple-400 !text-white !hover:from-purple-500 !hover:to-purple-300 !rounded-xl !px-6 !py-3 !font-semibold !text-lg shadow-lg" />
        </div>
      </div>
    </div>
  );
}
