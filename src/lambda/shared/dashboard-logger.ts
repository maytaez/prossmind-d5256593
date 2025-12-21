import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Token counting and cost estimation for Gemini 2.0 Flash
 * Pricing: https://ai.google.dev/pricing
 * - Input: $0.075 per 1M tokens
 * - Output: $0.30 per 1M tokens
 */

const GEMINI_FLASH_INPUT_COST_PER_1M = 0.075;
const GEMINI_FLASH_OUTPUT_COST_PER_1M = 0.3;

/**
 * Estimate token count using simple heuristic
 * Rough approximation: 1 token ≈ 4 characters
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate cost based on token usage
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * GEMINI_FLASH_INPUT_COST_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * GEMINI_FLASH_OUTPUT_COST_PER_1M;
  return inputCost + outputCost;
}

/**
 * Determine complexity level based on prompt characteristics
 */
export function determineComplexityLevel(prompt: string, isMultiDiagram: boolean): string {
  if (isMultiDiagram) return "multi-prompt";

  const length = prompt.length;
  const laneCount = (prompt.match(/lane|swimlane|pool/gi) || []).length;
  const taskCount = (prompt.match(/task|activity|step/gi) || []).length;

  if (length > 1500 || laneCount >= 3 || taskCount >= 10) return "complex";
  if (length > 800 || laneCount >= 2 || taskCount >= 5) return "moderate";
  return "simple";
}

export interface LogGenerationRequestParams {
  supabase: SupabaseClient;
  userId: string;
  prompt: string;
  diagramType: "bpmn" | "pid";
  detectedLanguage?: string;
  sourceFunction: "generate-bpmn" | "generate-bpmn-combined" | "process-bpmn-job";
  isMultiDiagram?: boolean;
  subPromptCount?: number;
  parentRequestId?: string;
  jobId?: string;
  clientInfo?: Record<string, any>;
}

export interface LogGenerationSuccessParams {
  supabase: SupabaseClient;
  logId: string;
  resultXml: string;
  durationMs: number;
  cacheHit?: boolean;
  cacheSimilarity?: number;
  cachedFromId?: string;
}

export interface LogGenerationErrorParams {
  supabase: SupabaseClient;
  logId: string;
  errorMessage: string;
  errorStack?: string;
  durationMs: number;
}

/**
 * Log a new generation request
 * Returns the log ID for subsequent updates
 */
export async function logGenerationRequest(params: LogGenerationRequestParams): Promise<string | null> {
  const {
    supabase,
    userId,
    prompt,
    diagramType,
    detectedLanguage,
    sourceFunction,
    isMultiDiagram = false,
    subPromptCount,
    parentRequestId,
    jobId,
    clientInfo,
  } = params;

  try {
    const complexityLevel = determineComplexityLevel(prompt, isMultiDiagram);

    const { data, error } = await supabase
      .from("bpmn_generation_logs")
      .insert({
        user_id: userId,
        original_prompt: prompt,
        diagram_type: diagramType,
        detected_language: detectedLanguage,
        complexity_level: complexityLevel,
        source_function: sourceFunction,
        status: "pending", // Will be updated to success/error/cached later
        is_multi_diagram: isMultiDiagram,
        sub_prompt_count: subPromptCount,
        parent_request_id: parentRequestId,
        job_id: jobId,
        client_info: clientInfo,
        request_timestamp: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Dashboard Logger] Failed to log request:", error);
      return null;
    }

    console.log(`[Dashboard Logger] Request logged: ${data.id}`);
    return data.id;
  } catch (error) {
    console.error("[Dashboard Logger] Unexpected error logging request:", error);
    return null;
  }
}

/**
 * Update log with successful generation details
 */
export async function logGenerationSuccess(params: LogGenerationSuccessParams): Promise<void> {
  const { supabase, logId, resultXml, durationMs, cacheHit = false, cacheSimilarity, cachedFromId } = params;

  try {
    // Count tokens and estimate cost
    const outputTokens = countTokens(resultXml);
    // Input tokens are harder to estimate without the full prompt context,
    // but we can approximate based on average prompt size
    const inputTokens = Math.ceil(outputTokens * 0.3); // Rough estimate: prompt is ~30% of output
    const estimatedCost = estimateCost(inputTokens, outputTokens);

    const status = cacheHit ? "cached" : "success";

    const { error } = await supabase
      .from("bpmn_generation_logs")
      .update({
        status,
        result_xml: resultXml,
        generation_duration_ms: durationMs,
        cache_hit: cacheHit,
        cache_similarity_score: cacheSimilarity,
        cached_from_id: cachedFromId,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: estimatedCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    if (error) {
      console.error("[Dashboard Logger] Failed to log success:", error);
      return;
    }

    console.log(
      `[Dashboard Logger] Success logged: ${logId}, tokens: ${outputTokens}, cost: $${estimatedCost.toFixed(6)}, cache: ${cacheHit}`,
    );
  } catch (error) {
    console.error("[Dashboard Logger] Unexpected error logging success:", error);
  }
}

/**
 * Update log with error details
 */
export async function logGenerationError(params: LogGenerationErrorParams): Promise<void> {
  const { supabase, logId, errorMessage, errorStack, durationMs } = params;

  try {
    const { error } = await supabase
      .from("bpmn_generation_logs")
      .update({
        status: "error",
        error_message: errorMessage,
        error_stack: errorStack,
        generation_duration_ms: durationMs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", logId);

    if (error) {
      console.error("[Dashboard Logger] Failed to log error:", error);
      return;
    }

    console.log(`[Dashboard Logger] Error logged: ${logId}, message: ${errorMessage}`);
  } catch (error) {
    console.error("[Dashboard Logger] Unexpected error logging error:", error);
  }
}

/**
 * Fire-and-forget wrapper for logging (never throws)
 * Use this for async logging that shouldn't block the main flow
 */
export function logAsync(logFn: () => Promise<void>): void {
  logFn().catch((err) => {
    console.warn("[Dashboard Logger] Async log failed (non-blocking):", err);
  });
}
