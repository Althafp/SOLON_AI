import { PublicKey } from '@solana/web3.js';

export const parseNLPInput = async (input: string, token: any) => {
  try {
    const systemPrompt = `You are a JSON-only assistant for a Solana DeFi application. 

RULES:
1. Analyze user commands and return ONLY valid JSON
2. For swap/buy commands, extract amount and return swap intent
3. For all other queries (price, info, monitoring, etc.), return query intent
4. Be flexible with input formats and synonyms

Current token: ${token.symbol} (${token.address})
Input token for swaps: SOL (So11111111111111111111111111111111111111112)

SWAP EXAMPLES:
- "swap 0.1 SOL for this token" → {"intent":"swap","amount":0.1,"inputMint":"So11111111111111111111111111111111111111112","outputMint":"${token.address}"}
- "buy 100 tokens" → {"intent":"swap","amount":100,"type":"tokens","inputMint":"So11111111111111111111111111111111111111112","outputMint":"${token.address}"}
- "get 50 ${token.symbol}" → {"intent":"swap","amount":50,"type":"tokens","inputMint":"So11111111111111111111111111111111111111112","outputMint":"${token.address}"}

QUERY EXAMPLES:
- "what's the price" → {"intent":"query"}
- "tell me about this token" → {"intent":"query"}
- "set alert when price drops" → {"intent":"query"}
- "help" → {"intent":"help"}

Command to analyze: "${input}"

Return ONLY JSON, no explanations.`;

    const response = await fetch('https://1f67-49-47-216-27.ngrok-free.app/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: systemPrompt,
        stream: true,
        options: {
          temperature: 0.1,
          top_p: 0.9,
        },
      }),
    });

    let fullResponse = '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) fullResponse += json.response;
        } catch (err) {
          console.error('Error parsing chunk:', err, line);
        }
      }
    }

    console.log('Raw NLP response:', fullResponse);

    let cleanResponse = fullResponse.trim();
    if (!cleanResponse) {
      console.error('Empty response from LLM');
      throw new Error('LLM returned empty response');
    }

    // Use a more robust regex to match JSON objects
    const jsonMatch = cleanResponse.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.error('No valid JSON found in response:', cleanResponse);
      throw new Error('No valid JSON in LLM response');
    }
    cleanResponse = jsonMatch[0];

    // Validate JSON before parsing
    try {
      JSON.parse(cleanResponse);
    } catch (err) {
      console.error('Invalid JSON detected:', cleanResponse, err);
      throw new Error('Invalid JSON format from LLM');
    }

    const parsed = JSON.parse(cleanResponse);

    if (parsed.intent === 'swap') {
      if (parsed.type === 'tokens') {
        parsed.amount = parsed.amount * Math.pow(10, token.decimals);
      } else {
        parsed.amount = parsed.amount * Math.pow(10, 9); // Assume SOL
      }
      parsed.inputMint = parsed.inputMint || 'So11111111111111111111111111111111111111112';
      parsed.outputMint = parsed.outputMint || token.address;
    }

    return parsed;
  } catch (err) {
    console.error('NLP parsing failed:', err);
    const swapKeywords = ['swap', 'buy', 'purchase', 'get', 'trade', 'exchange'];
    const hasSwapKeyword = swapKeywords.some(keyword => input.toLowerCase().includes(keyword));
    if (hasSwapKeyword) {
      const amountMatch = input.match(/(\d+\.?\d*)/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[1]) * Math.pow(10, 9); // Assume SOL
        return {
          intent: 'swap',
          amount: amount,
          inputMint: 'So11111111111111111111111111111111111111112',
          outputMint: token.address,
        };
      }
    }
    return { intent: 'query' };
  }
};

export const getCurrentTokenPrice = async (tokenAddress: string, coingeckoId?: string) => {
  try {
    if (coingeckoId) {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`);
      const data = await response.json();
      return data[coingeckoId]?.usd || null;
    } else {
      const response = await fetch(`https://api.jup.ag/price/v2?ids=${tokenAddress}`);
      const data = await response.json();
      return data.data?.[tokenAddress]?.price || null;
    }
  } catch (error) {
    console.error('Price fetch failed:', error);
    return null;
  }
};

export const queryLLM = async (input: string, token: any) => {
  try {
    const price = await getCurrentTokenPrice(token.address, token.extensions?.coingeckoId);
    const tokenInfo = {
      name: token.name,
      symbol: token.symbol,
      address: token.address,
      decimals: token.decimals,
      volume_24h: token.daily_volume ? `$${token.daily_volume.toLocaleString()}` : 'N/A',
      created_at: new Date(token.created_at).toLocaleString(),
      tags: token.tags?.join(', ') || 'N/A',
      coingeckoId: token.extensions?.coingeckoId || 'N/A',
      estimated_price: price ? `$${price.toFixed(6)}` : 'N/A',
    };

    const systemPrompt = `You are a helpful DeFi assistant specializing in Solana tokens. 

CONTEXT:
- Current token: ${JSON.stringify(tokenInfo, null, 2)}
- User query: "${input}"

GUIDELINES:
1. Provide natural, conversational responses
2. For price queries, use the estimated price or mention data limitations
3. For volume/stats queries, use the provided data
4. For monitoring/alerts, explain it's coming soon
5. For general token info, use the provided metadata
6. Be concise but informative
7. If you don't have specific data, be honest about limitations

RESPONSE STYLE:
- Natural language (NOT JSON)
- Friendly and helpful tone
- Include relevant numbers/stats when available
- Suggest related actions when appropriate`;

    const response = await fetch('https://7ef8-45-119-114-222.ngrok-free.app/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        prompt: systemPrompt,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 150,
        },
      }),
    });

    let fullResponse = '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) fullResponse += json.response;
        } catch (err) {
          console.error('Error parsing chunk:', err, line);
        }
      }
    }

    console.log('Raw query response:', fullResponse);
    return fullResponse.trim() || 'I understand your question, but I need more information to provide a helpful response.';
  } catch (err) {
    console.error('Query LLM failed:', err);
    const lowerInput = input.toLowerCase();
    if (lowerInput.includes('price')) {
      return `I don't have real-time price data for ${token.symbol} right now, but you can check the 24h volume of ${token.daily_volume ? `$${token.daily_volume.toLocaleString()}` : 'N/A'} to gauge activity.`;
    } else if (lowerInput.includes('volume')) {
      return `The 24-hour volume for ${token.symbol} is ${token.daily_volume ? `$${token.daily_volume.toLocaleString()}` : 'not available'}.`;
    } else if (lowerInput.includes('info') || lowerInput.includes('about')) {
      return `${token.name} (${token.symbol}) is a Solana token with ${token.decimals} decimals. It was created on ${new Date(token.created_at).toLocaleDateString()}. ${token.tags?.length ? `Tags: ${token.tags.join(', ')}.` : ''}`;
    } else if (lowerInput.includes('alert') || lowerInput.includes('monitor')) {
      return 'Price alerts and monitoring features are coming soon! For now, you can manually check back or try making a small swap.';
    } else {
      return `I can help you with information about ${token.symbol} or execute swaps. Try asking about the price, volume, or say "swap 0.1 SOL for this token".`;
    }
  }
};