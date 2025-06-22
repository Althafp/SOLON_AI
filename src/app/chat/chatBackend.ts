const OLLAMA_URL = "https://9024-2409-40f0-1017-b46c-756f-354-cd14-880.ngrok-free.app/api";
const EMBED_URL = "https://9024-2409-40f0-1017-b46c-756f-354-cd14-880.ngrok-free.app";
const QDRANT_URL = "http://localhost:6333";
const COLLECTION_NAME = "jupiter_hackthon";
const MAX_RETRIEVED_DOCS = 4;

// Define interfaces for type safety
interface QdrantFilter {
  must: Array<{
    key: string;
    match: { value: string };
  }>;
}

interface QdrantSearchPayload {
  vector: number[];
  limit: number;
  with_payload: boolean;
  filter?: QdrantFilter;
}

interface Metadata {
  file: string;
  page_range: string;
  objectId?: string;
}

interface QdrantHit {
  payload: {
    text: string;
    metadata: Metadata;
  };
  score: number;
}

interface RankedResult {
  text: string;
  metadata: Metadata;
  score: number;
}

export const queryVectorCollection = async (
  query: string,
  objectId: string | null = null,
  topK: number = MAX_RETRIEVED_DOCS
) => {
  try {
    // Generate query embedding with retry
    let queryEmbedding: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${EMBED_URL}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: query,
          }),
        });
        console.log(response);
        const data = await response.json();
        queryEmbedding = data.embedding;
        break;
      } catch (e) {
        if (attempt === 2) {
          console.error(`Failed to get query embedding: ${e}`);
          return [];
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // Prepare Qdrant search query
    const searchPayload: QdrantSearchPayload = {
      vector: queryEmbedding,
      limit: topK * 2, // Retrieve more for reranking
      with_payload: true,
    };

    if (objectId && objectId !== "None") {
      searchPayload.filter = {
        must: [
          {
            key: "metadata.objectId",
            match: { value: objectId },
          },
        ],
      };
    }

    // Query Qdrant
    const searchResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchPayload),
    });
    const searchResults = (await searchResponse.json()).result;

    // Simulate reranking
    const rankedResults: RankedResult[] = searchResults
      .map((hit: QdrantHit) => ({
        text: hit.payload.text,
        metadata: hit.payload.metadata,
        score: hit.score,
      }))
      .sort((a: RankedResult, b: RankedResult) => b.score - a.score)
      .slice(0, topK);

    const retrievedDocs = rankedResults.map(
      (hit: RankedResult) =>
        `${hit.text}\n[Source: ${hit.metadata.file}, Pages: ${hit.metadata.page_range}]`
    );

    return retrievedDocs;
  } catch (e) {
    console.error(`Qdrant query failed: ${e}`);
    return [];
  }
};

export const callLLM = async (context: string, question: string) => {
  const systemPrompt = `
You are a friendly and helpful AI assistant, designed to provide accurate and human-like responses. Your primary goal is to answer questions based on the provided context from documents. If no relevant context is available, use your general knowledge but clearly state: "No answer in database, answering in general." Respond conversationally, acknowledging casual inputs like "hi" or "thank you" appropriately (e.g., "Hi! How can I help you?" or "You're welcome!"). 

Guidelines:
- Use clear, concise language and a warm tone.
- Organize answers into separate paragraphs for each key point, without using Markdown bold (**), bullet points (- or •), or other formatting symbols.
- Do not use lists or headers; instead, write each key point as a standalone paragraph.
- Maintain consistency with previous responses.
- For casual inputs (e.g., "hi", "thanks"), respond briefly and naturally without document context.
- Ensure proper grammar and punctuation.

Context: ${context}
Question: ${question}
  `;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`${OLLAMA_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: [{ role: 'user', content: systemPrompt }],
          stream: false,
        }),
      });
      const data = await response.json();
      let content = data.message.content;

      // Post-process to remove any residual Markdown bold symbols
      content = content.replace(/\*\*/g, '');

      return content;

    } catch (e) {
      if (attempt === 2) {
        return `Error: Failed to connect to Ollama after 3 attempts: ${e}`;
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

export const askQuestion = async (question: string, objectId: string | null = null) => {
  // Handle casual inputs directly
  const questionLower = question.toLowerCase().trim();
  if (['hi', 'hello', 'hey'].includes(questionLower)) {
    return 'Hi! How can I assist you today?';
  }
  if (['thank you', 'thanks', 'ty'].includes(questionLower)) {
    return "You're welcome! Anything else I can help with?";
  }

  const retrievedDocs = await queryVectorCollection(question, objectId);
  const context = retrievedDocs.length ? retrievedDocs.join('\n\n') : '';

  if (!context) {
    const response = await callLLM('', question);
    return `answering in general:\n\n${response}`;
  }

  return await callLLM(context, question);
};