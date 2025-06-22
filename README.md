NOTE : Users must on/ setup  Ollama server(Ngrok is used here for accessing server) for llama 3.2 model which links before using AI chats. 

Solon AI is an innovative AI-powered interface designed to simplify and democratize Web3 trading on the Solana blockchain. It allows users—even complete beginners—to interact with complex crypto trading systems using simple natural language commands. By combining the power of AI language models with the high-speed capabilities of Jupiter Aggregator and Solana’s trading ecosystem, Solon AI provides an intelligent, user-friendly experience for decentralized finance (DeFi) enthusiasts.
Solon AI bridges the gap between complex decentralized trading and human-friendly AI interactions. It reimagines how we interact with crypto markets by replacing friction with fluid conversations. Whether you're a curious beginner or a seasoned DeFi user, Solon AI makes Web3 trading intuitive, safe, and smart.
Core mission is to make Web3 trading as intuitive as chatting with a friend — no technical knowledge required.
Key Features:
🔁 Natural Language Token Swapping
Users can type or speak commands like “Swap 0.5 SOL to USDC” or “Buy 100 BONK if price drops below 0.00002.”


Solon AI processes the input, fetches real-time routes via Jupiter API, and executes trades.


🛡️ Risk Analysis Before Swaps
Before executing a trade, Solon AI performs a token risk profile check:


Contract validity


Liquidity strength


Historical volatility


Whale wallet movement alerts


Returns a simplified “Risk Score” and warning (e.g., “This token has low liquidity and high price manipulation risk”).


📈 Future Investment Suggestions
Based on market trends, token social signals, and on-chain data, Solon AI suggests AI-curated portfolios or individual tokens for future investment, tailored to the user’s risk appetite and user can set time intervals to trade tokens(eg: Buy jup worth of 9 usdt  at 10:00 am for next 3 days), it fragments 9 usdt as 3 equal intervals and performs the action at fixed time intervals.


🕰️ Past Trade Analysis
Users can ask:


“How did my SOL trades perform last week?”


“Show ROI on my last 10 trades”


“Which of my swaps lost money?”


Solon AI fetches user wallet history, performs calculations, and gives an easy-to-read summary.


💬 Chat with Solana and Jupiter
Chatbot interfaces for:


Solana: For on-chain info, transaction help, wallet creation, fees, etc by using ollama llama3.2 model.


Jupiter: For trade execution, price slippage, routing logic, and token listings.
Rugcheck: For token risk analysis


🧠 Talk to Tokens
Users can "chat" with a token to learn:


Its purpose


Market cap


Social trends


Community engagement


Future events or airdrops


Example: “What’s trending with $JUP today?” or “Tell me about $PYTH.”


🛍️ Token Marketplace with AI Insights
Browse trending tokens with real-time market data, AI-generated summaries, and community reviews.


Visualize token performance using AI-annotated charts (e.g., "buy zone", "pump zone").


🤖 AI Trade Agents
Set up custom trading bots using natural instructions:


“Buy 10 USDT worth of trending meme tokens every day at 4 PM.”


“Sell 30% of my BONK if price drops 20% from ATH.”


Solon AI builds the logic, tracks prices, and executes rules on your behalf.


🧾 Rule Engine for Trades
A drag-and-drop interface + prompt builder to set:


Entry & exit conditions


Stop-loss / take-profit


Multi-token strategies


Real-time trigger alerts


How It Works (Technical Stack Overview):
Ngrok server for AI actions. (We had setup custom server without using openAI API, we need to on the server before using it)
Backend:


Integration with Jupiter Aggregator API for swaps


Solana RPC & Web3.js for wallet and transaction data


Llama3.2 model LLM for natural language processing
Rugcheck for token risk analysis




Security: Wallet encryption via Phantom, trade confirmation step


Hosting: Vercel


Use Cases:
A beginner with zero Web3 experience can perform secure trades without understanding gas, slippage, or liquidity.


Pro traders can save time by setting AI agents to auto-swap tokens under custom rules.


Communities can use the "Talk to Token" feature to promote engagement and trust around projects.
