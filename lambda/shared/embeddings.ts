/**
 * Embedding generation utility for semantic similarity search
 * Supports multiple providers with fallback logic
 */

export interface EmbeddingProvider {
  name: string;
  generateEmbedding(text: string): Promise<number[]>;
}

/**
 * Generate embedding using OpenAI's text-embedding-3-small model
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const OPENAI_API_KEY = process.env['OPENAI_API_KEY'];
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    throw new Error('Invalid response structure from OpenAI embedding API');
  }

  return data.data[0].embedding;
}

/**
 * Generate embedding using Supabase AI (if available)
 */
async function generateSupabaseEmbedding(text: string): Promise<number[]> {
  // Supabase AI embeddings would go here if available
  // For now, throw error to fall back to OpenAI
  throw new Error('Supabase AI embeddings not yet implemented');
}

/**
 * Generate embedding using Cohere (fallback)
 */
async function generateCohereEmbedding(text: string): Promise<number[]> {
  const COHERE_API_KEY = process.env['COHERE_API_KEY'];
  if (!COHERE_API_KEY) {
    throw new Error('COHERE_API_KEY not configured');
  }

  const response = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'embed-english-v3.0',
      texts: [text],
      input_type: 'search_document',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cohere embedding API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.embeddings || !data.embeddings[0]) {
    throw new Error('Invalid response structure from Cohere embedding API');
  }

  return data.embeddings[0];
}

/**
 * Main function to generate embedding with provider fallback
 * Priority: OpenAI > Supabase AI > Cohere
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  // Truncate text if too long (OpenAI limit is 8191 tokens, ~6000 words)
  const maxLength = 6000;
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

  const provider = process.env['EMBEDDING_PROVIDER'] || 'openai';
  const providers: Array<{ name: string; fn: () => Promise<number[]> }> = [];

  // Build provider list based on configuration
  if (provider === 'openai' || provider === 'auto') {
    providers.push({ name: 'openai', fn: () => generateOpenAIEmbedding(truncatedText) });
  }
  if (provider === 'supabase' || provider === 'auto') {
    providers.push({ name: 'supabase', fn: () => generateSupabaseEmbedding(truncatedText) });
  }
  if (provider === 'cohere' || provider === 'auto') {
    providers.push({ name: 'cohere', fn: () => generateCohereEmbedding(truncatedText) });
  }

  // If auto, add OpenAI as fallback if not already included
  if (provider === 'auto' && !providers.some(p => p.name === 'openai')) {
    providers.push({ name: 'openai', fn: () => generateOpenAIEmbedding(truncatedText) });
  }

  // Try providers in order
  let lastError: Error | null = null;
  for (const providerInfo of providers) {
    try {
      console.log(`Attempting to generate embedding using ${providerInfo.name}...`);
      const embedding = await providerInfo.fn();
      console.log(`Successfully generated embedding using ${providerInfo.name} (dimensions: ${embedding.length})`);
      return embedding;
    } catch (error) {
      console.warn(`Failed to generate embedding using ${providerInfo.name}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // Continue to next provider
    }
  }

  // All providers failed
  throw new Error(`Failed to generate embedding with all providers. Last error: ${lastError?.message}`);
}

/**
 * Check if semantic caching is enabled
 */
export function isSemanticCacheEnabled(): boolean {
  const enabled = process.env['SEMANTIC_CACHE_ENABLED'];
  return enabled !== 'false' && enabled !== '0';
}

/**
 * Get semantic similarity threshold
 */
export function getSemanticSimilarityThreshold(): number {
  const threshold = process.env['SEMANTIC_SIMILARITY_THRESHOLD'];
  return threshold ? parseFloat(threshold) : 0.85;
}





