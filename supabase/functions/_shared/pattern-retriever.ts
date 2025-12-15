/**
 * Pattern Retriever
 * Retrieves similar process patterns using vector search
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SemanticCore } from "./types/semantic-core.ts";
import type { Pattern } from "./types/bpmn-ir.ts";
import { generateEmbedding } from "./embeddings.ts";

/**
 * Retrieve similar process patterns based on semantic core
 */
export async function retrievePatterns(
  semanticCore: SemanticCore,
  limit: number = 5,
  supabase?: any
): Promise<Pattern[]> {
  // For now, return empty array if supabase not provided
  // In future, this will search a patterns database
  if (!supabase) {
    return [];
  }

  try {
    // Create a text representation of semantic core for embedding
    const semanticText = createSemanticText(semanticCore);

    // Generate embedding for semantic core
    const embedding = await generateEmbedding(semanticText);

    // Search for similar patterns in database
    // Note: This requires a patterns table with embeddings
    // For now, return empty array as patterns table may not exist yet
    const { data, error } = await supabase.rpc("match_patterns", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: limit,
    });

    if (error) {
      console.warn("[Pattern Retriever] Error searching patterns:", error);
      return [];
    }

    // Convert database results to Pattern objects
    return (data || []).map((row: any) => ({
      pattern_id: row.id,
      semantic_match: row.semantic_match || "",
      bpmn_hint: {
        task_type: row.task_type || "user_task",
        gateway_type: row.gateway_type,
      },
    }));
  } catch (error) {
    console.warn("[Pattern Retriever] Error:", error);
    return [];
  }
}

/**
 * Create a text representation of semantic core for embedding
 */
function createSemanticText(semanticCore: SemanticCore): string {
  const parts: string[] = [];

  parts.push(`Process: ${semanticCore.process_metadata.name}`);
  if (semanticCore.process_metadata.domain) {
    parts.push(`Domain: ${semanticCore.process_metadata.domain}`);
  }

  parts.push(`Actors: ${semanticCore.actors.map(a => `${a.name} (${a.type})`).join(", ")}`);

  parts.push(
    `Activities: ${semanticCore.activities.map(a => `${a.action} ${a.object}`).join(", ")}`
  );

  if (semanticCore.decisions.length > 0) {
    parts.push(
      `Decisions: ${semanticCore.decisions.map(d => d.question).join(", ")}`
    );
  }

  return parts.join(". ");
}
