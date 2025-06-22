'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect, useRef } from 'react';
import { ArrowUp, X, Mic } from 'lucide-react';
import { handleTokenChatSend } from './swapFunctions';
import { parseNLPInput, queryLLM } from './chatFunctions';
import { askQuestion } from './chatBackend';

export default function ChatPage() {
  const { publicKey, signTransaction } = useWallet();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! How can I assist you today?' },
  ]);
  const [input, setInput] = useState('');
  const [activeView, setActiveView] = useState<'chat' | 'stats' | 'agents' | 'rules'>('chat');
  const [tokens, setTokens] = useState<any[]>([]);
  const [trendingTokens, setTrendingTokens] = useState<any[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('birdeye-trending');
  const [tokenChatMessages, setTokenChatMessages] = useState([
    { role: 'assistant', content: 'Ask me anything about this token! Try "Swap 0.1 SOL for this token", "What’s the price?", "Preview Swap", or "help" for options.' },
  ]);
  const [tokenChatInput, setTokenChatInput] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [agents, setAgents] = useState<{ name: string; type: 'trading' | 'tutor'; condition?: string; knowledgeBase?: string }[]>([]);
  const [agentForm, setAgentForm] = useState({ name: '', type: 'trading' as 'trading' | 'tutor', condition: '', knowledgeBase: '' });
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentChatMessages, setAgentChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Create an AI Agent to get started!' },
  ]);
  const [agentChatInput, setAgentChatInput] = useState('');
  const [rules, setRules] = useState<{ minSwapAmount?: number; maxSwapAmount?: number; avoidMemeCoins?: boolean; avoidNewCoins?: boolean }[]>([]);
  const [ruleForm, setRuleForm] = useState({ minSwapAmount: '', maxSwapAmount: '', avoidMemeCoins: false, avoidNewCoins: false });
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [risks, setRisks] = useState<any[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(false);

  const tokenCache = useRef<any[]>([]);

  const filterOptions = [
    { label: 'Trending', tag: 'birdeye-trending', url: 'https://lite-api.jup.ag/tokens/v1/tagged/birdeye-trending' },
    { label: 'Community', tag: 'community', url: 'https://lite-api.jup.ag/tokens/v1/tagged/community' },
    { label: 'Strict', tag: 'strict', url: 'https://lite-api.jup.ag/tokens/v1/tagged/strict' },
    { label: 'Verified', tag: 'verified', url: 'https://lite-api.jup.ag/tokens/v1/tagged/verified' },
    { label: 'LST', tag: 'lst', url: 'https://lite-api.jup.ag/tokens/v1/tagged/lst' },
    { label: 'New', tag: 'new', url: 'https://lite-api.jup.ag/tokens/v1/new' },
  ];

  const BLACKLISTED_TOKENS = [
    'FAKE1234567890abcdef1234567890abcdef12345678',
    'SCAM9876543210fedcba9876543210fedcba98765432',
  ];
  const WEIRD_POOLS = [
    'POOLLOWLIQ1234567890abcdef1234567890abcdef12',
    'POOLRISKY9876543210fedcba9876543210fedcba98',
  ];
  const PRICE_IMPACT_THRESHOLD = 5;
  const LIQUIDITY_THRESHOLD = 10000;

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '🤔 Processing...' }]);
      const response = await askQuestion(userMessage);
      setMessages(prev => prev.slice(0, -1).concat({ role: 'assistant', content: response }));
    } catch (e) {
      console.error('Chat query failed:', e);
      setMessages(prev => prev.slice(0, -1).concat({
        role: 'assistant',
        content: `❌ Sorry, I encountered an error: ${e.message || 'Unknown error'}. Please try again.`,
      }));
    }
  };

  const fetchTokens = async (filterTag: string) => {
    setLoadingTokens(true);
    try {
      const selectedOption = filterOptions.find((option) => option.tag === filterTag);
      if (!selectedOption) return;

      const res = await fetch(selectedOption.url);
      const data = await res.json();

      if (filterTag === 'birdeye-trending') {
        const topTokens = data
          .filter((t: any) => t.daily_volume && t.daily_volume > 0)
          .sort((a: any, b: any) => b.daily_volume - a.daily_volume)
          .slice(0, 20);
        setTrendingTokens(topTokens);
        setTokens([]);
      } else {
        setTrendingTokens([]);
        setTokens(data);
      }
    } catch (error) {
      console.error('Token fetch failed:', error);
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Failed to load tokens. Please try again.' },
      ]);
    }
    setLoadingTokens(false);
  };

  const handleTokenClick = async (token: any) => {
    try {
      const res = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${token.address}`);
      const data = await res.json();
      setSelectedToken(data);
      setTokenChatMessages([{ role: 'assistant', content: `Ask me about ${data.name}! Try "Swap 0.1 SOL for this token", "Preview Swap", or "help" for options.` }]);
      setRisks([]);
    } catch (err) {
      console.error('Failed to fetch token details:', err);
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Failed to load token details. Please try another token.' },
      ]);
    }
  };

  const fetchRisks = async (tokenAddress: string) => {
    setLoadingRisks(true);
    try {
      const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`);
      const data = await res.json();
      setRisks(data.risks || []);
    } catch (err) {
      console.error('Failed to fetch risks:', err);
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Failed to load risk analysis. Please try again.' },
      ]);
    }
    setLoadingRisks(false);
  };

  const handleAgentFormSubmit = () => {
    if (!agentForm.name.trim() || (agentForm.type === 'trading' && !agentForm.condition.trim()) || (agentForm.type === 'tutor' && !agentForm.knowledgeBase.trim())) {
      setAgentChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: '❌ Please fill in all required fields.' },
      ]);
      return;
    }

    const newAgent = {
      name: agentForm.name,
      type: agentForm.type,
      ...(agentForm.type === 'trading' ? { condition: agentForm.condition } : { knowledgeBase: agentForm.knowledgeBase }),
    };
    setAgents(prev => [...prev, newAgent]);
    setAgentChatMessages([
      { role: 'assistant', content: `✅ Agent "${newAgent.name}" created and working on the task!` },
    ]);
    setAgentForm({ name: '', type: 'trading', condition: '', knowledgeBase: '' });
    setShowAgentForm(false);
  };

  const handleAgentClick = (agent: { name: string; type: 'trading' | 'tutor'; condition?: string; knowledgeBase?: string }) => {
    setActiveView('agents');
    setAgentChatMessages([
      { role: 'assistant', content: `Interacting with ${agent.name} (${agent.type === 'trading' ? 'Trading AI' : 'Tutor AI'}). ${agent.type === 'trading' ? `Condition: ${agent.condition}` : `Knowledge Base: ${agent.knowledgeBase}`}` },
    ]);
  };

  const handleRuleFormSubmit = () => {
    if (!ruleForm.minSwapAmount && !ruleForm.maxSwapAmount && !ruleForm.avoidMemeCoins && !ruleForm.avoidNewCoins) {
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: '❌ Please set at least one rule.' },
      ]);
      return;
    }

    const newRule = {
      ...(ruleForm.minSwapAmount ? { minSwapAmount: parseFloat(ruleForm.minSwapAmount) } : {}),
      ...(ruleForm.maxSwapAmount ? { maxSwapAmount: parseFloat(ruleForm.maxSwapAmount) } : {}),
      ...(ruleForm.avoidMemeCoins ? { avoidMemeCoins: true } : {}),
      ...(ruleForm.avoidNewCoins ? { avoidNewCoins: true } : {}),
    };
    setRules(prev => [...prev, newRule]);
    setTokenChatMessages(prev => [
      ...prev,
      { role: 'assistant', content: `✅ Rule added: ${ruleForm.minSwapAmount ? `Min swap $${ruleForm.minSwapAmount}` : ''}${ruleForm.minSwapAmount && ruleForm.maxSwapAmount ? ', ' : ''}${ruleForm.maxSwapAmount ? `Max swap $${ruleForm.maxSwapAmount}` : ''}${ruleForm.avoidMemeCoins ? ', Avoid meme coins' : ''}${ruleForm.avoidNewCoins ? ', Avoid new coins' : ''}` },
    ]);
    setRuleForm({ minSwapAmount: '', maxSwapAmount: '', avoidMemeCoins: false, avoidNewCoins: false });
    setShowRuleForm(false);
  };

  const simulateSwap = (amount: number, token: any) => {
    let riskScore = 0;
    const warnings: string[] = [];

    if (BLACKLISTED_TOKENS.includes(token.address)) {
      warnings.push('⚠️ This token is blacklisted.');
      riskScore += 40;
      console.warn(`Alert: Blacklisted token ${token.address} detected. Notify Discord/Telegram.`);
    }

    const priceImpact = amount > 0.5 ? 7 : 3;
    if (priceImpact > PRICE_IMPACT_THRESHOLD) {
      warnings.push(`⚠️ Price impact is too high (${priceImpact}% > ${PRICE_IMPACT_THRESHOLD}%).`);
      riskScore += 20;
      console.warn(`Alert: High price impact (${priceImpact}%) for swap. Notify Discord/Telegram.`);
    }

    const liquidity = token.created_at > Date.now() - 7 * 24 * 60 * 60 * 1000 ? 5000 : 20000;
    if (liquidity < LIQUIDITY_THRESHOLD) {
      warnings.push(`⚠️ Liquidity looks suspicious ($${liquidity} < $${LIQUIDITY_THRESHOLD}).`);
      riskScore += 20;
      console.warn(`Alert: Low liquidity ($${liquidity}) for ${token.symbol}. Notify Discord/Telegram.`);
    }

    const usesWeirdPool = token.tags?.includes('meme') ? WEIRD_POOLS[0] : null;
    if (usesWeirdPool) {
      warnings.push(`⚠️ Route goes through weird pool (${usesWeirdPool}).`);
      riskScore += 20;
      console.warn(`Alert: Weird pool (${usesWeirdPool}) detected. Notify Discord/Telegram.`);
    }

    rules.forEach(rule => {
      if (rule.minSwapAmount && amount * 100 < rule.minSwapAmount) {
        warnings.push(`⚠️ Swap amount ($${amount * 100}) is below rule minimum ($${rule.minSwapAmount}).`);
        riskScore += 20;
      }
      if (rule.maxSwapAmount && amount * 100 > rule.maxSwapAmount) {
        warnings.push(`⚠️ Swap amount ($${amount * 100}) exceeds rule limit ($${rule.maxSwapAmount}).`);
        riskScore += 20;
      }
      if (rule.avoidMemeCoins && token.tags?.includes('meme')) {
        warnings.push('⚠️ Token is a meme coin, against your rules.');
        riskScore += 20;
      }
      if (rule.avoidNewCoins && token.created_at > Date.now() - 7 * 24 * 60 * 60 * 1000) {
        warnings.push('⚠️ Token is too new, against your rules.');
        riskScore += 20;
      }
    });

    return { riskScore: Math.min(riskScore, 100), warnings };
  };

  const handleTokenChat = async (params: {
    tokenChatInput: string;
    selectedToken: any;
    setTokenChatMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string }[]>>;
    setTokenChatInput: React.Dispatch<React.SetStateAction<string>>;
    setLoadingAction: React.Dispatch<React.SetStateAction<boolean>>;
    publicKey: any;
    signTransaction: any;
  }) => {
    const { tokenChatInput, selectedToken, setTokenChatMessages, setTokenChatInput, setLoadingAction, publicKey, signTransaction } = params;
    if (!tokenChatInput.trim() || !selectedToken) return;

    setTokenChatMessages(prev => [...prev, { role: 'user', content: tokenChatInput }]);
    setTokenChatInput('');
    setLoadingAction(true);

    try {
      if (tokenChatInput.toLowerCase().includes('preview swap')) {
        const match = tokenChatInput.match(/(\d+\.?\d*)\s*SOL/i);
        const amount = match ? parseFloat(match[1]) : 0.1;

        const { riskScore, warnings } = simulateSwap(amount, selectedToken);
        const messages = [
          `🔍 Swap Preview: ${amount} SOL for ${selectedToken.symbol}`,
          `Risk Score: ${riskScore}/100`,
          ...warnings,
          riskScore > 50 ? '⚠️ High risk detected. Proceed with caution.' : '✅ Swap looks safe.',
        ];
        setTokenChatMessages(prev => [...prev, { role: 'assistant', content: messages.join('\n') }]);
      } else {
        await handleTokenChatSend({
          tokenChatInput,
          selectedToken,
          setTokenChatMessages,
          setTokenChatInput,
          setLoadingAction,
          publicKey,
          signTransaction,
          rules,
        });
      }
    } catch (err) {
      console.error('Token chat failed:', err);
      setTokenChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `❌ Error: ${err.message || 'Unknown error'}` },
      ]);
    } finally {
      setLoadingAction(false);
    }
  };

  useEffect(() => {
    if (activeView === 'stats' && !selectedToken) {
      fetchTokens(selectedFilter);
    }
  }, [activeView, selectedFilter, selectedToken]);

  return (
    <div className="h-screen w-screen flex bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white relative font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-gray-800 to-gray-900 p-4 border-r border-gray-700/50 flex flex-col">
        <button
          className="bg-gradient-to-r from-purple-700 to-blue-700 text-white py-2 px-4 rounded-lg mb-4 hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md"
          onClick={() => {
            setActiveView('chat');
            setSelectedToken(null);
            setTokenChatMessages([{ role: 'assistant', content: 'Ask me anything about tokens!' }]);
            setShowAgentForm(false);
            setAgentChatMessages([{ role: 'assistant', content: 'Create an AI Agent to get started!' }]);
            setShowRuleForm(false);
          }}
        >
          + New Chat
        </button>
        <div className="flex flex-col gap-2 text-sm text-gray-200 overflow-y-auto">
          <div
            onClick={() => {
              setActiveView('chat');
              setSelectedToken(null);
              setTokenChatMessages([{ role: 'assistant', content: 'Ask me anything about tokens!' }]);
              setShowAgentForm(false);
              setAgentChatMessages([{ role: 'assistant', content: 'Create an AI Agent to get started!' }]);
              setShowRuleForm(false);
            }}
            className={`p-2 rounded-lg cursor-pointer transition-all duration-300 flex items-center gap-2 ${
              activeView === 'chat' ? 'bg-gradient-to-r from-purple-800 to-blue-800' : 'hover:bg-gray-700'
            }`}
          >
            🧠 Chat with Bot <Mic className="h-4 w-4" />
          </div>
          <div
            onClick={() => {
              setActiveView('stats');
              setSelectedToken(null);
              setTokenChatMessages([{ role: 'assistant', content: 'Select a token to learn more!' }]);
              setShowAgentForm(false);
              setAgentChatMessages([{ role: 'assistant', content: 'Create an AI Agent to get started!' }]);
              setShowRuleForm(false);
            }}
            className={`p-2 rounded-lg cursor-pointer transition-all duration-300 ${
              activeView === 'stats' ? 'bg-gradient-to-r from-purple-800 to-blue-800' : 'hover:bg-gray-700'
            }`}
          >
            📈 Solana Stats
          </div>
          <div className="border-t border-gray-600/50 pt-2 mt-2">
            <h3 className="text-sm font-semibold text-gray-200 mb-2">AI Agents</h3>
            <button
              className="bg-gradient-to-r from-purple-700 to-blue-700 text-white py-2 px-4 rounded-lg mb-2 w-full text-left hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md"
              onClick={() => {
                setActiveView('agents');
                setShowAgentForm(true);
                setAgentChatMessages([{ role: 'assistant', content: 'Create an AI Agent to get started!' }]);
                setShowRuleForm(false);
              }}
            >
              + Add AI Agent
            </button>
            {agents.map((agent, idx) => (
              <div
                key={idx}
                onClick={() => handleAgentClick(agent)}
                className={`p-2 rounded-lg cursor-pointer transition-all duration-300 ${
                  activeView === 'agents' && agentChatMessages.some(msg => msg.content.includes(agent.name)) ? 'bg-gradient-to-r from-purple-800 to-blue-800' : 'hover:bg-gray-700'
                }`}
              >
                {agent.name} ({agent.type === 'trading' ? 'Trading AI' : 'Tutor AI'})
              </div>
            ))}
          </div>
          <div className="border-t border-gray-600/50 pt-2 mt-2">
            <h3 className="text-sm font-semibold text-gray-200 mb-2">Set Rules</h3>
            <button
              className="bg-gradient-to-r from-purple-700 to-blue-700 text-white py-2 px-4 rounded-lg mb-2 w-full text-left hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md"
              onClick={() => {
                setActiveView('rules');
                setShowRuleForm(true);
                setShowAgentForm(false);
              }}
            >
              + Add Rule
            </button>
            {rules.map((rule, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg cursor-pointer transition-all duration-300 hover:bg-gray-700 text-sm"
              >
                {rule.minSwapAmount ? `Min $${rule.minSwapAmount}` : ''}{rule.minSwapAmount && rule.maxSwapAmount ? ', ' : ''}{rule.maxSwapAmount ? `Max $${rule.maxSwapAmount}` : ''}{rule.avoidMemeCoins ? ', No Meme Coins' : ''}{rule.avoidNewCoins ? ', No New Coins' : ''}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-auto text-xs text-gray-400 pt-4 border-t border-gray-600/50">
          Powered by Solana Wallet Adapter
        </div>
      </aside>

      {/* Main View */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
        {/* Header */}
        <div className="h-14 border-b border-gray-700/50 flex items-center justify-between px-6 bg-gradient-to-r from-gray-800 to-gray-900 shadow-sm">
          <h1 className="text-lg font-semibold">
            {activeView === 'chat' ? 'Chat' : activeView === 'stats' ? (selectedToken ? `${selectedToken.name} Details` : 'Solana Stats') : activeView === 'agents' ? 'AI Agents' : 'Set Rules'}
          </h1>
          <div className="text-xs text-gray-400 truncate max-w-[200px] font-mono">
            {publicKey?.toBase58()}
          </div>
        </div>

        {/* Chat View */}
        {activeView === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xl px-4 py-3 rounded-xl text-sm shadow-md ${
                      msg.role === 'user' ? 'bg-gradient-to-r from-purple-700 to-blue-700' : 'bg-gradient-to-r from-gray-700 to-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-700/50 bg-gradient-to-r from-gray-800 to-gray-900">
              <div className="flex items-center gap-2 max-w-3xl mx-auto w-full bg-gradient-to-r from-purple-800 to-blue-800 rounded-xl px-4 py-2 shadow-md">
                <input
                  type="text"
                  placeholder="Message ChatBot..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="bg-transparent flex-1 text-sm outline-none text-white placeholder-gray-400"
                />
                <button onClick={handleSend}>
                  <ArrowUp className="h-5 w-5 text-gray-300 hover:text-white transition-colors duration-200" />
                </button>
                <button>
                  <Mic className="h-5 w-5 text-gray-300 hover:text-white transition-colors duration-200" />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Stats View */}
        {activeView === 'stats' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {!selectedToken ? (
              <>
                {/* Filter Bar */}
                <div className="flex gap-2 flex-wrap">
                  {filterOptions.map((option) => (
                    <button
                      key={option.tag}
                      onClick={() => setSelectedFilter(option.tag)}
                      className={`px-4 py-2 rounded-xl text-sm shadow-md transition-all duration-300 ${
                        selectedFilter === option.tag
                          ? 'bg-gradient-to-r from-purple-700 to-blue-700 text-white'
                          : 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 hover:from-purple-600 hover:to-blue-600 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {loadingTokens ? (
                  <div className="text-gray-400">Loading tokens...</div>
                ) : (
                  <>
                    {/* Trending Tokens */}
                    {selectedFilter === 'birdeye-trending' && trendingTokens.length > 0 && (
                      <div>
                        <h2 className="text-lg font-semibold mb-2">🔥 Trending Tokens</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {trendingTokens.map((token) => (
                            <div
                              key={token.address}
                              onClick={() => handleTokenClick(token)}
                              className="bg-gradient-to-br from-gray-800 to-gray-900 hover:from-purple-800 hover:to-blue-800 p-4 rounded-xl shadow-lg border border-gray-700/50 cursor-pointer transition-all duration-300"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <img
                                  src={token.logoURI}
                                  alt={token.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                                <div>
                                  <div className="font-semibold">{token.name}</div>
                                  <div className="text-xs text-gray-400">{token.symbol}</div>
                                </div>
                              </div>
                              <div className="text-sm text-gray-300">
                                Volume: ${token.daily_volume?.toLocaleString() || 'N/A'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* All Tokens */}
                    {tokens.length > 0 && (
                      <div>
                        <h2 className="text-lg font-semibold mb-2">
                          📦 {selectedFilter === 'birdeye-trending' ? 'All Tokens' : `${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Tokens`}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {tokens.map((token) => (
                            <div
                              key={token.address}
                              onClick={() => handleTokenClick(token)}
                              className="bg-gradient-to-br from-gray-800 to-gray-900 hover:from-purple-800 hover:to-blue-800 p-4 rounded-xl shadow-lg border border-gray-700/50 cursor-pointer transition-all duration-300"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <img
                                  src={token.logoURI}
                                  alt={token.symbol}
                                  className="w-8 h-8 rounded-full"
                                />
                                <div>
                                  <div className="font-semibold">{token.name}</div>
                                  <div className="text-xs text-gray-400">{token.symbol}</div>
                                </div>
                              </div>
                              <div className="text-sm text-gray-300">
                                Volume: ${token.daily_volume?.toLocaleString() || 'N/A'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="flex gap-6">
                {/* Left Column: Token Details and Graph */}
                <div className="flex-1 space-y-6">
                  {/* Back Button */}
                  <button
                    onClick={() => {
                      setSelectedToken(null);
                      setTokenChatMessages([{ role: 'assistant', content: 'Select a token to learn more!' }]);
                    }}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    <X className="h-5 w-5" /> Back to Tokens
                  </button>

                  {/* Token Details */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50">
                    <div className="flex items-center gap-4 mb-4">
                      <img
                        src={selectedToken.logoURI}
                        alt={selectedToken.symbol}
                        className="w-12 h-12 rounded-full"
                      />
                      <div>
                        <div className="text-xl font-bold">{selectedToken.name}</div>
                        <div className="text-sm text-gray-400">{selectedToken.symbol}</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div><strong>Address:</strong> {selectedToken.address}</div>
                      <div><strong>Decimals:</strong> {selectedToken.decimals}</div>
                      <div><strong>Volume (24h):</strong> ${selectedToken.daily_volume?.toLocaleString() || 'N/A'}</div>
                      <div><strong>Created At:</strong> {new Date(selectedToken.created_at).toLocaleString()}</div>
                      <div><strong>Tags:</strong> {selectedToken.tags?.join(', ') || 'N/A'}</div>
                      {selectedToken.extensions?.coingeckoId && (
                        <div><strong>Coingecko:</strong> {selectedToken.extensions.coingeckoId}</div>
                      )}
                    </div>
                    <button
                      onClick={() => fetchRisks(selectedToken.address)}
                      className="mt-4 bg-gradient-to-r from-purple-700 to-blue-700 text-white py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md text-sm"
                      disabled={loadingRisks}
                    >
                      {loadingRisks ? 'Analyzing...' : 'Analyze Risks'}
                    </button>
                    {risks.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h3 className="text-sm font-semibold text-gray-200">Risk Analysis</h3>
                        {risks.map((risk, idx) => (
                          <div key={idx} className={`text-sm p-2 rounded ${risk.level === 'danger' ? 'bg-red-900/50' : 'bg-yellow-900/50'}`}>
                            <strong>{risk.name}:</strong> {risk.description} (Score: {risk.score})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Graph */}
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50">
                    <h2 className="text-lg font-semibold mb-4">Price Graph</h2>
                    <div className="h-64 flex items-center justify-center">
                      <img
                        src="/imgg.jpeg"
                        alt="Token Price Graph"
                        className="w-full h-full object-contain rounded-lg"
                        onError={() => console.error('Failed to load image: /img.jpeg')}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Token Chat */}
                <div className="w-1/3">
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50 sticky top-6">
                    <h2 className="text-lg font-semibold mb-4">Token Chat</h2>
                    <div className="h-96 overflow-y-auto space-y-4 mb-4">
                      {tokenChatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-md px-4 py-3 rounded-xl text-sm shadow-md ${
                              msg.role === 'user' ? 'bg-gradient-to-r from-purple-700 to-blue-700' : 'bg-gradient-to-r from-gray-700 to-gray-800'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {loadingAction && (
                        <div className="flex justify-start">
                          <div className="text-gray-400 text-sm">🤔 Processing...</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 bg-gradient-to-r from-purple-800 to-blue-800 rounded-xl px-4 py-2 shadow-md">
                      <input
                        type="text"
                        placeholder="Try 'Swap 0.1 SOL for this token', 'Preview Swap', or 'help'"
                        value={tokenChatInput}
                        onChange={(e) => setTokenChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleTokenChat({
                          tokenChatInput,
                          selectedToken,
                          setTokenChatMessages,
                          setTokenChatInput,
                          setLoadingAction,
                          publicKey,
                          signTransaction,
                        })}
                        className="bg-transparent flex-1 text-sm outline-none text-white placeholder-gray-400"
                        disabled={loadingAction}
                      />
                      <button
                        onClick={() => handleTokenChat({
                          tokenChatInput,
                          selectedToken,
                          setTokenChatMessages,
                          setTokenChatInput,
                          setLoadingAction,
                          publicKey,
                          signTransaction,
                        })}
                        disabled={loadingAction}
                      >
                        <ArrowUp className={`h-5 w-5 ${loadingAction ? 'text-gray-600' : 'text-gray-300 hover:text-white transition-colors duration-200'}`} />
                      </button>
                      <button disabled={loadingAction}>
                        <Mic className={`h-5 w-5 ${loadingAction ? 'text-gray-600' : 'text-gray-300 hover:text-white transition-colors duration-200'}`} />
                      </button>
                      <button
                        onClick={() => handleTokenChat({
                          tokenChatInput: 'Preview Swap',
                          selectedToken,
                          setTokenChatMessages,
                          setTokenChatInput,
                          setLoadingAction,
                          publicKey,
                          signTransaction,
                        })}
                        disabled={loadingAction}
                        className="bg-gradient-to-r from-purple-700 to-blue-700 text-white px-3 py-1 rounded-lg text-sm hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md"
                      >
                        Preview Swap
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Agents View */}
        {activeView === 'agents' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {showAgentForm ? (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50">
                <h2 className="text-lg font-semibold mb-4">Create AI Agent</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Agent Name</label>
                    <input
                      type="text"
                      value={agentForm.name}
                      onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                      placeholder="Enter agent name"
                      className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm rounded-lg px-4 py-2 outline-none shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Agent Type</label>
                    <select
                      value={agentForm.type}
                      onChange={(e) => setAgentForm({ ...agentForm, type: e.target.value as 'trading' | 'tutor', condition: '', knowledgeBase: '' })}
                      className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm rounded-lg px-4 py-2 outline-none shadow-inner"
                    >
                      <option value="trading">Trading AI</option>
                      <option value="tutor">Tutor AI</option>
                    </select>
                  </div>
                  {agentForm.type === 'trading' ? (
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Condition</label>
                      <input
                        type="text"
                        value={agentForm.condition}
                        onChange={(e) => setAgentForm({ ...agentForm, condition: e.target.value })}
                        placeholder="e.g., If BONK reaches 30k then buy it"
                        className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm rounded-lg px-4 py-2 outline-none shadow-inner"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm text-gray-300 mb-1">Knowledge Base</label>
                      <textarea
                        value={agentForm.knowledgeBase}
                        onChange={(e) => setAgentForm({ ...agentForm, knowledgeBase: e.target.value })}
                        placeholder="Enter knowledge base content"
                        className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm rounded-lg px-4 py-2 outline-none shadow-inner h-24"
                      />
                    </div>
                  )}
                  <div className="flex gap-4">
                    <button
                      onClick={handleAgentFormSubmit}
                      className="bg-gradient-to-r from-purple-700 to-blue-700 text-white py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md"
                    >
                      Create Agent
                    </button>
                    <button
                      onClick={() => setShowAgentForm(false)}
                      className="bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 hover:text-white transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50">
                <h2 className="text-lg font-semibold mb-4">Agent Chat</h2>
                <div className="h-64 overflow-y-auto space-y-4 mb-4">
                  {agentChatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-md px-4 py-3 rounded-xl text-sm shadow-md ${
                          msg.role === 'user' ? 'bg-gradient-to-r from-purple-700 to-blue-700' : 'bg-gradient-to-r from-gray-700 to-gray-800'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-gradient-to-r from-purple-800 to-blue-800 rounded-xl px-4 py-2 shadow-md">
                  <input
                    type="text"
                    placeholder="Interact with your agent..."
                    value={agentChatInput}
                    onChange={(e) => setAgentChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && agentChatInput.trim()) {
                        setAgentChatMessages(prev => [
                          ...prev,
                          { role: 'user', content: agentChatInput },
                          { role: 'assistant', content: 'Agent response coming soon! (Mock response)' },
                        ]);
                        setAgentChatInput('');
                      }
                    }}
                    className="bg-transparent flex-1 text-sm outline-none text-white placeholder-gray-400"
                  />
                  <button
                    onClick={() => {
                      if (agentChatInput.trim()) {
                        setAgentChatMessages(prev => [
                          ...prev,
                          { role: 'user', content: agentChatInput },
                          { role: 'assistant', content: 'Agent response coming soon! (Mock response)' },
                        ]);
                        setAgentChatInput('');
                      }
                    }}
                  >
                    <ArrowUp className="h-5 w-5 text-gray-300 hover:text-white transition-colors duration-200" />
                  </button>
                  <button>
                    <Mic className="h-5 w-5 text-gray-300 hover:text-white transition-colors duration-200" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rules View */}
        {activeView === 'rules' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {showRuleForm ? (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50">
                <h2 className="text-lg font-semibold mb-4">Create Swap Rule</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Min Swap Amount ($)</label>
                    <input
                      type="number"
                      value={ruleForm.minSwapAmount}
                      onChange={(e) => setRuleForm({ ...ruleForm, minSwapAmount: e.target.value })}
                      placeholder="e.g., 10"
                      className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm rounded-lg px-4 py-2 outline-none shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Max Swap Amount ($)</label>
                    <input
                      type="number"
                      value={ruleForm.maxSwapAmount}
                      onChange={(e) => setRuleForm({ ...ruleForm, maxSwapAmount: e.target.value })}
                      placeholder="e.g., 100"
                      className="w-full bg-gradient-to-r from-gray-700 to-gray-800 text-white text-sm rounded-lg px-4 py-2 outline-none shadow-inner"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ruleForm.avoidMemeCoins}
                      onChange={(e) => setRuleForm({ ...ruleForm, avoidMemeCoins: e.target.checked })}
                      className="h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded"
                    />
                    <label className="text-sm text-gray-300">Avoid Meme Coins</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ruleForm.avoidNewCoins}
                      onChange={(e) => setRuleForm({ ...ruleForm, avoidNewCoins: e.target.checked })}
                      className="h-4 w-4 text-purple-600 bg-gray-700 border-gray-600 rounded"
                    />
                    <label className="text-sm text-gray-300">Avoid New Coins (less than 7 days old)</label>
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={handleRuleFormSubmit}
                      className="bg-gradient-to-r from-purple-700 to-blue-700 text-white py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-300 shadow-md"
                    >
                      Create Rule
                    </button>
                    <button
                      onClick={() => setShowRuleForm(false)}
                      className="bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300 py-2 px-4 rounded-lg hover:from-purple-600 hover:to-blue-600 hover:text-white transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl shadow-lg border border-gray-700/50">
                <h2 className="text-lg font-semibold mb-4">Swap Rules</h2>
                <div className="text-sm text-gray-300">
                  {rules.length > 0 ? (
                    rules.map((rule, idx) => (
                      <div key={idx} className="mb-2">
                        {rule.minSwapAmount ? `Min Swap: $${rule.minSwapAmount}` : ''}{rule.minSwapAmount && rule.maxSwapAmount ? ', ' : ''}{rule.maxSwapAmount ? `Max Swap: $${rule.maxSwapAmount}` : ''}{rule.avoidMemeCoins ? ', Avoid Meme Coins' : ''}{rule.avoidNewCoins ? ', Avoid New Coins' : ''}
                      </div>
                    ))
                  ) : (
                    <div>No rules set. Add a rule to secure your swaps!</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}