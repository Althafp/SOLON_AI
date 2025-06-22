// src/types.ts
import { Transaction, VersionedTransaction } from '@solana/web3.js';

export interface Token {
  symbol: string;
  address: string;
  decimals: number;
  name: string;
  daily_volume?: number;
  created_at: string;
  tags?: string[];
  extensions?: { coingeckoId?: string };
  logoURI?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'agent'; // Include 'agent'
  content: string;
}

export interface Risk {
  name: string;
  description: string;
  score: number;
  level: string;
}

export interface SwapRule {
  minSwapAmount?: number;
  maxSwapAmount?: number;
  avoidMemeCoins?: boolean;
  avoidNewCoins?: boolean;
}

export interface Agent {
  name: string;
  type: 'trading' | 'tutor';
  condition?: string;
  knowledgeBase?: string;
}

export type SignTransactionType = (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;