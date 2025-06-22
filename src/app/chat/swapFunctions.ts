// src/app/chat/swapFunctions.ts
import { PublicKey, Connection, VersionedTransaction, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { parseNLPInput, queryLLM } from './chatFunctions';
import { Token, ChatMessage, SwapRule, SignTransactionType } from './types';

export const validateSwapParams = (
  amount: number,
  inputMint: string,
  outputMint: string,
  token: Token,
  rules: SwapRule[]
) => {
  const errors: string[] = [];
  if (!amount || amount <= 0) errors.push('Invalid swap amount');
  if (!inputMint || !outputMint) errors.push('Missing token addresses');
  if (inputMint === outputMint) errors.push('Cannot swap token for itself');
  const solAmount = inputMint === 'So11111111111111111111111111111111111111112' ? amount / Math.pow(10, 9) : 0;
  if (solAmount > 10) errors.push('Large swap detected - please confirm you want to swap more than 10 SOL');

  // Check user-defined rules
  const usdAmount = solAmount * 100; // Assume 1 SOL = $100 for simplicity
  rules.forEach(rule => {
    if (rule.minSwapAmount && usdAmount < rule.minSwapAmount) {
      errors.push(`Swap amount ($${usdAmount.toFixed(2)}) is below minimum rule ($${rule.minSwapAmount})`);
    }
    if (rule.maxSwapAmount && usdAmount > rule.maxSwapAmount) {
      errors.push(`Swap amount ($${usdAmount.toFixed(2)}) exceeds maximum rule ($${rule.maxSwapAmount})`);
    }
    if (rule.avoidMemeCoins && token.tags?.includes('meme')) {
      errors.push('Token is a meme coin, which violates your rules');
    }
    if (rule.avoidNewCoins && new Date(token.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000) {
      errors.push('Token is less than 7 days old, which violates your rules');
    }
  });

  return { isValid: errors.length === 0, errors };
};

export const swapAgent = async (
  amount: number,
  inputMint: string,
  outputMint: string,
  selectedToken: Token,
  setTokenChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  publicKey: PublicKey | null,
  signTransaction: SignTransactionType,
  connection: Connection,
  rules: SwapRule[]
) => {
  if (!publicKey || !signTransaction) {
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: '🔒 Please connect your Solana wallet to perform swaps.' },
    ]);
    return;
  }

  const validation = validateSwapParams(amount, inputMint, outputMint, selectedToken, rules);
  if (!validation.isValid) {
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `❌ Swap validation failed: ${validation.errors.join(', ')}. Please adjust your swap parameters to meet your set rules.` },
    ]);
    return;
  }

  try {
    const merchantAccount = new PublicKey(selectedToken.address);
    const merchantTokenAccount = await getAssociatedTokenAddress(
      new PublicKey(outputMint),
      merchantAccount,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    let accountInfo = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        accountInfo = await connection.getAccountInfo(merchantTokenAccount, 'confirmed');
        break;
      } catch (rpcErr: unknown) {
        if (attempt === 2) {
          throw new Error(`Failed to fetch account info for ${merchantTokenAccount.toBase58()}: ${(rpcErr as Error).message}. The public RPC endpoint may be rate-limited or blocking browser requests.`);
        }
        setTokenChatMessages(prev => [
          ...prev,
          { role: 'assistant', content: `⚠️ Retrying account check (attempt ${attempt + 2}/3)...` },
        ]);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    if (!accountInfo) {
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `🛠️ Creating associated token account for ${selectedToken.symbol}...` },
      ]);
      const transaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          merchantTokenAccount,
          merchantAccount,
          new PublicKey(outputMint),
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;
      const signedTx = await signTransaction(transaction);
      const createSignature = await connection.sendRawTransaction(signedTx.serialize(), {
        maxRetries: 10,
        preflightCommitment: 'finalized',
      });
      await connection.confirmTransaction(createSignature, 'finalized');
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `✅ Associated token account created! Signature: https://solscan.io/tx/${createSignature}` },
      ]);
    }

    const solAmount = inputMint === 'So11111111111111111111111111111111111111112' ? (amount / Math.pow(10, 9)).toFixed(4) : 'Unknown';
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `🔄 Initiating swap: ${solAmount} SOL → ${selectedToken.symbol}. Please confirm in your wallet...` },
    ]);

    const quoteResponse = await (
      await fetch(
        `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50&restrictIntermediateTokens=true&swapMode=ExactOut`
      )
    ).json();

    if (quoteResponse.error) throw new Error(`Quote failed: ${quoteResponse.error}`);

    const swapResponse = await (
      await fetch('https://lite-api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: publicKey.toBase58(),
          destinationTokenAccount: merchantTokenAccount.toBase58(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
              maxLamports: 1000000,
              priorityLevel: 'veryHigh',
              global: false,
            },
          },
        }),
      })
    ).json();

    if (swapResponse.error) throw new Error(`Swap preparation failed: ${swapResponse.error}`);

    const transaction = VersionedTransaction.deserialize(Buffer.from(swapResponse.swapTransaction, 'base64'));

    const signedTransaction = await signTransaction(transaction);
    const transactionBinary = signedTransaction.serialize();

    const signature = await connection.sendRawTransaction(transactionBinary, {
      maxRetries: 10,
      preflightCommitment: 'processed',
      skipPreflight: true,
    });

    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `⏳ Transaction submitted! Signature: ${signature}\n\nWaiting for confirmation...` },
    ]);

    await connection.confirmTransaction(signature, 'finalized');
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `✅ **Swap Successful!**\n\n🔗 **Transaction:** https://solscan.io/tx/${signature}\n💰 **Amount:** ${solAmount} SOL → ${selectedToken.symbol}\n\nThe tokens should appear in the merchant's wallet shortly!` },
    ]);
  } catch (err: unknown) {
    console.error('Swap failed:', err);
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `❌ **Swap Failed**\n\n**Error:** ${(err as Error).message}\n\n**Possible solutions:**\n• Check your wallet balance (need SOL for gas)\n• Try again later if the public RPC is rate-limited\n• Verify the token mint address\n• Reduce slippage tolerance\n• Use a smaller amount\n\nWould you like to try again?` },
    ]);
  }
};

export const handleTokenChatSend = async ({
  tokenChatInput,
  selectedToken,
  setTokenChatMessages,
  setTokenChatInput,
  setLoadingAction,
  publicKey,
  signTransaction,
  rules,
}: {
  tokenChatInput: string;
  selectedToken: Token;
  setTokenChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setTokenChatInput: React.Dispatch<React.SetStateAction<string>>;
  setLoadingAction: React.Dispatch<React.SetStateAction<boolean>>;
  publicKey: PublicKey | null;
  signTransaction: SignTransactionType;
  rules: SwapRule[];
}) => {
  if (!tokenChatInput.trim() || !selectedToken) return;
  const userMessage = tokenChatInput.trim();

  setTokenChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
  setTokenChatInput('');
  setLoadingAction(true);

  try {
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: '🤔 Analyzing your command...' },
    ]);

    const nlpResult = await parseNLPInput(userMessage, selectedToken);
    console.log('NLP Result:', nlpResult);

    setTokenChatMessages(prev => prev.slice(0, -1));

    if (nlpResult.intent === 'swap') {
      const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=2a8f3530-07d5-4ee9-b5ef-6f517cd84e88', {
        commitment: 'processed',
        disableRetryOnRateLimit: false,
      });
      await swapAgent(
        nlpResult.amount,
        nlpResult.inputMint,
        nlpResult.outputMint,
        selectedToken,
        setTokenChatMessages,
        publicKey,
        signTransaction,
        connection,
        rules
      );
    } else if (nlpResult.intent === 'query') {
      const response = await queryLLM(userMessage, selectedToken);
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: response },
      ]);
    } else if (nlpResult.intent === 'help') {
      const helpMessage = `🤖 I can help you with:\n\n**Swapping:**\n• "Swap 0.1 SOL for this token"\n• "Buy 100 ${selectedToken.symbol}"\n\n**Information:**\n• "What's the price of ${selectedToken.symbol}?"\n• "Tell me about this token"\n• "Show me the volume"\n\n**Monitoring:**\n• "Alert when price drops"\n\nTry any of these commands or ask me anything else about ${selectedToken.symbol}!`;
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: helpMessage },
      ]);
    } else {
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `🤔 I'm not sure how to help with "${userMessage}". Try asking about ${selectedToken.symbol}'s price, volume, or say "swap 0.1 SOL for this token". Type "help" for more options.` },
      ]);
    }
  } catch (error: unknown) {
    console.error('Chat handler error:', error);
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `❌ Sorry, I encountered an error: ${(error as Error).message || 'Unknown error'}. Please try again or rephrase your request.` },
    ]);
  } finally {
    setLoadingAction(false);
  }
};