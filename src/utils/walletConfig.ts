export const WalletNotification = {
  onConnect: (walletName: string) => {
    console.log(`[Wallet Connected] ${walletName}`);
  },
  onDisconnect: (walletName: string) => {
    console.log(`[Wallet Disconnected] ${walletName}`);
  },
  onError: (error: any) => {
    console.error('[Wallet Error]', error);
  },
  onNotInstalled: (walletName: string) => {
    console.warn(`[Wallet Not Installed] ${walletName}`);
  },
};
