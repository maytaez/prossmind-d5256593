import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  diagramType: "bpmn" | "pid";
  supabase: SupabaseClient;
  googleApiKey: string;
  timeout?: number;
  similarityThreshold?: number;
}

export interface CacheStoreOptions {
  prompt: string;
  bpmnXml: string;
  diagramType: "bpmn" | "pid";
  supabase: SupabaseClient;
  googleApiKey: string;
}

/**
 * Generate SHA-256 hash of a prompt for exact matching
 */
export async function generatePromptHash(prompt: string): Promise<string> {
  const normalized = prompt.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured in environment variables");
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Embedding API error: ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Invalid embedding response: expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding?.length || 0}`,
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[Cache] Generated embedding in ${duration}ms`);

    return embedding;
  } catch (error) {
    console.error("[Cache] Embedding generation failed:", error);
    throw error;
  }
}

/**
 * Internal cache check function (without timeout wrapper)
 */
async function checkCacheInternal(options: CacheCheckOptions): Promise<CacheResult | null> {
  const { prompt, diagramType, supabase, googleApiKey, similarityThreshold = SIMILARITY_THRESHOLD } = options;

  const startTime = Date.now();
  console.log(`[Cache] Checking cache for ${diagramType} prompt (${prompt.length} chars)`);

  try {
    // Step 1: Try exact match first (fastest)
    const promptHash = await generatePromptHash(prompt);

    const { data: exactMatch, error: exactError } = await supabase
      .from("bpmn_prompt_cache")
      .select("id, bpmn_xml, prompt_text, hit_count")
      .eq("prompt_hash", promptHash)
      .eq("diagram_type", diagramType)
      .limit(1)
      .maybeSingle();

    if (exactError) {
      console.warn("[Cache] Exact match query error:", exactError);
    } else if (exactMatch) {
      const duration = Date.now() - startTime;
      console.log(`[Cache] 🎯 Exact match found! Retrieved in ${duration}ms (hit_count: ${exactMatch.hit_count})`);

      // Update hit count asynchronously (don't wait)
      updateCacheHitCount(exactMatch.id, supabase).catch((err) =>
        console.warn("[Cache] Failed to update hit count:", err),
      );

      return {
        id: exactMatch.id,
        bpmn_xml: exactMatch.bpmn_xml,
        similarity: 1.0, // Exact match
        prompt_text: exactMatch.prompt_text,
        hit_count: exactMatch.hit_count,
      };
    }

    // Step 2: Try semantic similarity search
    console.log("[Cache] No exact match, trying semantic similarity...");

    const embedding = await generateEmbedding(prompt, googleApiKey);

    // Call the match_similar_prompts function
    const { data: similarMatches, error: similarError } = await supabase.rpc("match_similar_prompts", {
      query_embedding: embedding,
      match_threshold: similarityThreshold,
      match_count: 1,
      diagram_type_filter: diagramType,
    });

    if (similarError) {
      console.warn("[Cache] Semantic search error:", similarError);
      return null;
    }

    if (similarMatches && similarMatches.length > 0) {
      const match = similarMatches[0];
      const duration = Date.now() - startTime;
      console.log(
        `[Cache] ✅ Semantic match found! Similarity: ${(match.similarity * 100).toFixed(1)}%, retrieved in ${duration}ms`,
      );

      // Update hit count asynchronously
      updateCacheHitCount(match.id, supabase).catch((err) => console.warn("[Cache] Failed to update hit count:", err));

      return {
        id: match.id,
        bpmn_xml: match.bpmn_xml,
        similarity: match.similarity,
        prompt_text: match.prompt_text,
        hit_count: match.hit_count,
      };
    }

    const duration = Date.now() - startTime;
    console.log(`[Cache] ❌ No match found (checked in ${duration}ms)`);
    return null;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Cache] Error during cache check (${duration}ms):`, error);
    return null;
  }
}

/**
 * Check cache for similar prompts with timeout protection
 * Returns null if cache miss, timeout, or error
 */
export async function checkCache(options: CacheCheckOptions): Promise<CacheResult | null> {
  const timeout = options.timeout || CACHE_LOOKUP_TIMEOUT;

  try {
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error("Cache lookup timeout")), timeout);
    });

    const result = await Promise.race([checkCacheInternal(options), timeoutPromise]);

    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "Cache lookup timeout") {
      console.warn(`[Cache] ⏱️  Lookup exceeded ${timeout}ms, proceeding with generation`);
    } else {
      console.error("[Cache] Unexpected error during cache check:", error);
    }
    return null;
  }
}

/**
 * Store a prompt and its BPMN result in cache asynchronously (fire-and-forget)
 * This function returns immediately and does not block
 */
export function storeCacheAsync(options: CacheStoreOptions): void {
  const { prompt, bpmnXml, diagramType, supabase, googleApiKey } = options;

  console.log(`[Cache] 💾 Starting async cache storage for ${diagramType} prompt (${prompt.length} chars)`);

  // Fire-and-forget: don't await this
  (async () => {
    const startTime = Date.now();

    try {
      console.log(`[Cache] Generating hash and embedding...`);

      // Generate hash (always succeeds)
      const promptHash = await generatePromptHash(prompt);

      // Try to generate embedding, but don't fail if it doesn't work
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(prompt, googleApiKey);
        console.log(`[Cache] ✅ Embedding generated: ${embedding.length} dimensions`);
      } catch (embeddingError) {
        console.warn("[Cache] ⚠️  Embedding generation failed, storing without embedding:", embeddingError);
        // Continue without embedding - we'll still get exact hash cache benefits
      }

      console.log(`[Cache] Hash: ${promptHash.substring(0, 16)}..., Has embedding: ${embedding !== null}`);

      // Prepare the data
      const cacheData = {
        prompt_text: prompt,
        prompt_hash: promptHash,
        prompt_embedding: embedding, // Will be null if embedding failed
        diagram_type: diagramType,
        bpmn_xml: bpmnXml,
        hit_count: 1,
        created_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      };

      console.log(`[Cache] Upserting to database...`);

      // Try to insert or update
      const { data, error } = await supabase
        .from("bpmn_prompt_cache")
        .upsert(cacheData, {
          onConflict: "prompt_hash,diagram_type",
          ignoreDuplicates: false, // Update if exists
        })
        .select();

      if (error) {
        console.error("[Cache] ❌ Failed to store in cache:", error);
        console.error("[Cache] Error details:", JSON.stringify(error, null, 2));
      } else {
        const duration = Date.now() - startTime;
        const cacheType = embedding ? "with embedding" : "hash-only (no embedding)";
        console.log(`[Cache] ✅ Stored successfully in ${duration}ms (${cacheType})`);
        console.log(`[Cache] Stored entry:`, data ? `ID: ${data[0]?.id}` : "No data returned");
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Cache] ❌ Error storing in cache (${duration}ms):`, error);
      if (error instanceof Error) {
        console.error("[Cache] Error stack:", error.stack);
      }
    }
  })().catch((err) => {
    // Extra safety net - should never reach here
    console.error("[Cache] ❌ Unhandled error in async cache storage:", err);
  });

  console.log(`[Cache] Cache storage initiated (running in background)`);
}

/**
 * Update hit count and last accessed time for a cache entry
 */
async function updateCacheHitCount(cacheId: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("update_cache_access", { cache_id: cacheId });

  if (error) {
    throw error;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(supabase: SupabaseClient): Promise<{
  totalEntries: number;
  totalHits: number;
  avgHits: number;
  hitRate?: number;
}> {
  try {
    const { data, error } = await supabase.rpc("get_cache_statistics");

    if (error) throw error;

    if (data && data.length > 0) {
      const stats = data[0];
      return {
        totalEntries: Number(stats.total_prompt_cache_entries) || 0,
        totalHits: Number(stats.total_prompt_cache_hits) || 0,
        avgHits: Number(stats.avg_prompt_cache_hits) || 0,
      };
    }

    return { totalEntries: 0, totalHits: 0, avgHits: 0 };
  } catch (error) {
    console.error("[Cache] Error fetching cache stats:", error);
    return { totalEntries: 0, totalHits: 0, avgHits: 0 };
  }
}
