 
export type WalletNotification = {
  type: 'connect' | 'disconnect' | 'error';
  message: string;
};