import './globals.css';
import { SolanaWalletProvider } from '../components/WalletProvider';

export const metadata = {
  title: 'Solana Chat App',
  description: 'Chat using Solana wallet',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SolanaWalletProvider>
          {children}
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
