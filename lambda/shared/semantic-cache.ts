// Supabase caching removed as per requirement: Lambdas should not call Supabase directly.

// Configuration
const CACHE_LOOKUP_TIMEOUT = 2000; // 2 seconds max for cache lookup
const SIMILARITY_THRESHOLD = 0.9; // 90% similarity required for cache hit
const EMBEDDING_MODEL = "text-embedding-3-small"; // OpenAI model
const EMBEDDING_DIMENSIONS = 1536; // OpenAI text-embedding-3-small outputs 1536-dimensional vectors

export interface CacheResult {
    id: string;
    bpmn_xml: string;
    similarity: number;
    prompt_text: string;
    hit_count: number;
}

export interface CacheCheckOptions {
    prompt: string;
    diagramType: 'bpmn' | 'pid';
    supabase?: any;
    googleApiKey: string;
    timeout?: number;
    similarityThreshold?: number;
}

export interface CacheStoreOptions {
    prompt: string;
    bpmnXml: string;
    diagramType: 'bpmn' | 'pid';
    supabase?: any;
    googleApiKey: string;
}

/**
 * Generate SHA-256 hash of a prompt for exact matching
 */
export async function generatePromptHash(prompt: string): Promise<string> {
    const normalized = prompt.trim().toLowerCase();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Generate vector embedding for a text using OpenAI's embedding API
 * Uses text-embedding-3-small which outputs 1536-dimensional vectors
 */
export async function generateEmbedding(text: string, _googleApiKey: string): Promise<number[]> {
    const startTime = Date.now();

    try {
        // Get OpenAI API key from environment
        const OPENAI_API_KEY = process.env['OPENAI_API_KEY'];
        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not configured in environment variables');
        }

        const response = await fetch(
            'https://api.openai.com/v1/embeddings',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: text,
                    encoding_format: 'float'
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI Embedding API error: ${errorText}`);
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;

        if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(`Invalid embedding response: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding?.length || 0}`);
        }

        const duration = Date.now() - startTime;
        console.log(`[Cache] Generated embedding in ${duration}ms`);

        return embedding;
    } catch (error) {
        console.error('[Cache] Embedding generation failed:', error);
        throw error;
    }
}

/**
 * Internal cache check function (without timeout wrapper)
 */
async function checkCacheInternal(options: CacheCheckOptions): Promise<CacheResult | null> {
    if (!options.supabase) {
        console.log('[Cache] No Supabase client provided, skipping cache check.');
        return null;
    }
    console.log('[Cache] DB lookup skipped: Lambdas cannot call Supabase directly.');
    return null;
}


/**
 * Check cache for similar prompts with timeout protection
 * Returns null if cache miss, timeout, or error
 */
export async function checkCache(options: CacheCheckOptions): Promise<CacheResult | null> {
    const timeout = options.timeout || CACHE_LOOKUP_TIMEOUT;

    try {
        const timeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error('Cache lookup timeout')), timeout);
        });

        const result = await Promise.race([
            checkCacheInternal(options),
            timeoutPromise
        ]);

        return result;
    } catch (error) {
        if (error instanceof Error && error.message === 'Cache lookup timeout') {
            console.warn(`[Cache] ⏱️  Lookup exceeded ${timeout}ms, proceeding with generation`);
        } else {
            console.error('[Cache] Unexpected error during cache check:', error);
        }
        return null;
    }
}

/**
 * Store a prompt and its BPMN result in cache asynchronously (fire-and-forget)
 * This function returns immediately and does not block
 */
export function storeCacheAsync(options: CacheStoreOptions): void {
    console.log('[Cache] DB storage skipped: Lambdas cannot call Supabase directly.');
}

/**
 * Update hit count and last accessed time for a cache entry
 */
async function updateCacheHitCount(cacheId: string, supabase: any): Promise<void> {
    // No-op
}

/**
 * Get cache statistics
 */
export async function getCacheStats(supabase: any): Promise<{
    totalEntries: number;
    totalHits: number;
    avgHits: number;
    hitRate?: number;
}> {
    return { totalEntries: 0, totalHits: 0, avgHits: 0 };
}