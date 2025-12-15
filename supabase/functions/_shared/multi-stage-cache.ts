/**
 * Multi-Stage Caching
 * Caching functions for each stage of the multi-stage BPMN generation pipeline
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateHash } from "./cache.ts";
import type { NormalizedInput } from "./types/semantic-core.ts";
import type { SemanticCore } from "./types/semantic-core.ts";
import type { BpmnIR } from "./types/bpmn-ir.ts";
import type { TemplateConstraints, EnterpriseStyleProfile } from "./types/bpmn-ir.ts";

const CACHE_TTL_DAYS = 30; // Cache entries expire after 30 days

/**
 * Get semantic cache entry
 */
export async function getSemanticCache(
  normalizedInput: NormalizedInput,
  supabase: any
): Promise<SemanticCore | null> {
  try {
    const inputHash = await generateHash(normalizedInput.content);
    const { data, error } = await supabase
      .from("semantic_cache")
      .select("semantic_core")
      .eq("input_hash", inputHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    // Update last accessed
    await supabase
      .from("semantic_cache")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("input_hash", inputHash);

    return data.semantic_core as SemanticCore;
  } catch (error) {
    console.warn("[Multi-Stage Cache] Error getting semantic cache:", error);
    return null;
  }
}

/**
 * Store semantic cache entry
 */
export async function cacheSemanticResult(
  normalizedInput: NormalizedInput,
  semanticCore: SemanticCore,
  supabase: any
): Promise<void> {
  try {
    const inputHash = await generateHash(normalizedInput.content);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await supabase.from("semantic_cache").upsert({
      input_hash: inputHash,
      semantic_core: semanticCore,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      last_accessed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[Multi-Stage Cache] Error storing semantic cache:", error);
    // Don't throw - caching is best effort
  }
}

/**
 * Get BPMN IR cache entry
 */
export async function getBpmnIRCache(
  semanticCore: SemanticCore,
  templateConstraints: TemplateConstraints,
  styleProfile: EnterpriseStyleProfile,
  supabase: any
): Promise<BpmnIR | null> {
  try {
    const semanticHash = await generateHash(JSON.stringify(semanticCore));
    const templateHash = await generateHash(JSON.stringify(templateConstraints));
    const styleHash = await generateHash(JSON.stringify(styleProfile));

    const { data, error } = await supabase
      .from("bpmn_ir_cache")
      .select("bpmn_ir")
      .eq("semantic_hash", semanticHash)
      .eq("template_hash", templateHash)
      .eq("style_hash", styleHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    // Update last accessed
    await supabase
      .from("bpmn_ir_cache")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("semantic_hash", semanticHash)
      .eq("template_hash", templateHash)
      .eq("style_hash", styleHash);

    return data.bpmn_ir as BpmnIR;
  } catch (error) {
    console.warn("[Multi-Stage Cache] Error getting BPMN IR cache:", error);
    return null;
  }
}

/**
 * Store BPMN IR cache entry
 */
export async function cacheBpmnIR(
  semanticCore: SemanticCore,
  templateConstraints: TemplateConstraints,
  styleProfile: EnterpriseStyleProfile,
  bpmnIR: BpmnIR,
  supabase: any
): Promise<void> {
  try {
    const semanticHash = await generateHash(JSON.stringify(semanticCore));
    const templateHash = await generateHash(JSON.stringify(templateConstraints));
    const styleHash = await generateHash(JSON.stringify(styleProfile));
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    await supabase.from("bpmn_ir_cache").upsert({
      semantic_hash: semanticHash,
      template_hash: templateHash,
      style_hash: styleHash,
      bpmn_ir: bpmnIR,
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      last_accessed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("[Multi-Stage Cache] Error storing BPMN IR cache:", error);
    // Don't throw - caching is best effort
  }
}
