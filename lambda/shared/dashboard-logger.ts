// Supabase logging removed as per requirement: Lambdas should not call Supabase directly.

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
  supabase?: any; // Kept for compatibility but not used
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
  supabase?: any; // Kept for compatibility but not used
  logId: string;
  resultXml: string;
  durationMs: number;
  cacheHit?: boolean;
  cacheSimilarity?: number;
  cachedFromId?: string;
}

export interface LogGenerationErrorParams {
  supabase?: any; // Kept for compatibility but not used
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

    console.log(`[Dashboard Logger] Generation Request: user=${userId}, type=${diagramType}, complexity=${complexityLevel}, source=${sourceFunction}, job=${jobId || 'none'}`);

    // Generate a pseudo-ID for locally identifying logs if needed
    const pseudoLogId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return pseudoLogId;
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
    const inputTokens = Math.ceil(outputTokens * 0.3);
    const estimatedCost = estimateCost(inputTokens, outputTokens);
    const status = cacheHit ? "cached" : "success";

    console.log(`[Dashboard Logger] Success: id=${logId}, status=${status}, tokens=${outputTokens}, cost=$${estimatedCost.toFixed(6)}, cache=${cacheHit}`);
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
    console.log(`[Dashboard Logger] Error: id=${logId}, message=${errorMessage}, duration=${durationMs}ms`);
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
