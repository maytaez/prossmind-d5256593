import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuration
const CACHE_LOOKUP_TIMEOUT = 2000; // 2 seconds max for cache lookup
const SIMILARITY_THRESHOLD = 0.9; // 90% similarity required for cache hit
const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 1536;

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
 * Generate vector embedding for a text using Gemini's embedding API
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: {
            parts: [{ text: text }],
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding || !Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding response: expected ${EMBEDDING_DIMENSIONS} dimensions`);
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

  // Fire-and-forget: don't await this
  (async () => {
    const startTime = Date.now();
    console.log(`[Cache] 💾 Storing in cache (async): ${diagramType} prompt (${prompt.length} chars)`);

    try {
      // Generate hash and embedding
      const [promptHash, embedding] = await Promise.all([
        generatePromptHash(prompt),
        generateEmbedding(prompt, googleApiKey),
      ]);

      // Try to insert or update
      const { error } = await supabase.from("bpmn_prompt_cache").upsert(
        {
          prompt_text: prompt,
          prompt_hash: promptHash,
          prompt_embedding: embedding,
          diagram_type: diagramType,
          bpmn_xml: bpmnXml,
          hit_count: 1,
          created_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        },
        {
          onConflict: "prompt_hash,diagram_type",
          ignoreDuplicates: false, // Update if exists
        },
      );

      if (error) {
        console.error("[Cache] Failed to store in cache:", error);
      } else {
        const duration = Date.now() - startTime;
        console.log(`[Cache] ✅ Stored successfully in ${duration}ms`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Cache] Error storing in cache (${duration}ms):`, error);
    }
  })();
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
