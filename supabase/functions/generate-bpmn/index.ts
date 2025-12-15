import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../_shared/metrics.ts';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../_shared/prompts.ts';
import { analyzePrompt, selectModel } from '../_shared/model-selection.ts';
import { detectLanguage, getLanguageName } from '../_shared/language-detection.ts';
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from '../_shared/bpmn-di-optimizer.ts';
import { analyzePromptComplexity, simplifyPrompt, splitPromptIntoSubPrompts, fallbackAnalysis, fallbackSplit } from '../_shared/prompt-analyzer.ts';
import { logGenerationRequest, logGenerationSuccess, logGenerationError } from '../_shared/dashboard-logger.ts';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}

interface SummarizationResult {
  summarizedPrompt: string;
  wasSummarized: boolean;
}

/**
 * Detect if prompt requires async generation (conservative thresholds)
 * Only use async for genuinely complex prompts that risk timeout
 */
function shouldUseAsyncGeneration(prompt: string, promptLength: number): boolean {
  const actors = (prompt.match(/actor|participant|swimlane|pool|lane|department|system|service/gi) || []).length;
  const complexity = (prompt.match(/subprocess|parallel|timer|boundary|escalate|event|gateway|decision/gi) || []).length;

  // Conservative thresholds - only async for truly complex prompts
  return (
    promptLength > 1500 ||           // Very long prompts
    actors >= 4 ||                   // 4+ swimlanes/actors  
    complexity >= 4 ||               // Multiple complex BPMN features
    (actors >= 3 && complexity >= 2) // Moderate actors + complexity
  );
}

function sanitizeBpmnXml(xml: string): string {
  let sanitized = xml;
  sanitized = sanitized.replace(/bpmns:/gi, "bpmn:");
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, "bpmndi:BPMNShape");
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, "bpmndi:BPMNEdge");
  sanitized = sanitized.replace(/<\/\s*di:waypoint\s*>/gi, "");
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint\s*([^>]*?)>/gi,
    (match: string, whitespace: string, attrs: string) => {
      if (match.includes("/>")) return match;
      const cleanAttrs = attrs.trim();
      return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
    },
  );
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint\s*([^>]*?)\s*\n\s*>/gi,
    (_match: string, whitespace: string, attrs: string) => {
      return `<${whitespace}di:waypoint ${attrs.trim().replace(/\s+/g, " ")}/>`;
    },
  );
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint([^>]*?)([^\/])>/gi,
    (_match: string, whitespace: string, attrs: string) => {
      const cleanAttrs = attrs.trim();
      return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
    },
  );
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmns:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\/\s*bpmn:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\/\s*bpmns:flowNodeRef\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?\s*>/gi, "");
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, "<?xml");
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, "");
  return sanitized.trim();
}

async function summarizeInputWithFlash(userPrompt: string, googleApiKey: string): Promise<SummarizationResult> {
  const shouldSummarize = userPrompt.length > 1500 || userPrompt.split("\n").length > 10;
  if (!shouldSummarize) return { summarizedPrompt: userPrompt, wasSummarized: false };
  console.log(`[Summarization] Summarizing prompt (length: ${userPrompt.length} chars)`);
  const summarizationPrompt = `You are a business process modeling assistant. Summarize and simplify the following prompt while preserving ALL critical information for BPMN 2.0 diagram generation.\n\nPreserve: workflow steps, decision points, participants/roles, sequence flows, exception handling, subprocesses, parallel activities, message flows, data objects.\n\nSimplify by: removing redundant explanations, consolidating similar concepts, using concise language.\n\nReturn ONLY the simplified prompt.\n\nOriginal prompt:\n${userPrompt}`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: summarizationPrompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
        }),
      },
    );
    if (!response.ok) {
      console.warn("[Summarization] Failed");
      return { summarizedPrompt: userPrompt, wasSummarized: false };
    }
    const data = await response.json();
    const summarized = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userPrompt;
    if (summarized && summarized.length < userPrompt.length * 0.8) {
      console.log(`[Summarization] Success: ${userPrompt.length} -> ${summarized.length} chars`);
      return { summarizedPrompt: summarized, wasSummarized: true };
    }
    return { summarizedPrompt: userPrompt, wasSummarized: false };
  } catch (error) {
    console.warn("[Summarization] Error:", error);
    return { summarizedPrompt: userPrompt, wasSummarized: false };
  }
}

function validateBpmnXml(xml: string): ValidationResult {
  if (!xml || typeof xml !== "string") return { isValid: false, error: "Invalid XML: empty or non-string input" };
  if (!xml.trim().startsWith("<?xml")) return { isValid: false, error: "Missing XML declaration" };
  if (!xml.includes("<bpmn:definitions") && !xml.includes("<bpmn:Definitions") && !xml.includes("<definitions"))
    return { isValid: false, error: "Missing BPMN definitions element" };
  if (!xml.includes("<bpmn:process") && !xml.includes("<process"))
    return { isValid: false, error: "Missing BPMN process element" };
  if (!xml.includes("<bpmndi:BPMNDiagram") && !xml.includes("<bpmndi:BPMNPlane"))
    return { isValid: false, error: "Missing BPMN diagram interchange" };
  const unclosedWaypoints = xml.match(/<di:waypoint[^>]*[^\/]>/gi);
  if (unclosedWaypoints && unclosedWaypoints.length > 0)
    return {
      isValid: false,
      error: "Unclosed di:waypoint tags",
      errorDetails: `Found ${unclosedWaypoints.length} unclosed tags`,
    };
  if (xml.includes("bpmns:") && !xml.includes("xmlns:bpmns="))
    return { isValid: false, error: "Invalid namespace prefix bpmns:" };
  return { isValid: true };
}

async function generateBpmnXmlWithGemini(
  simplifiedPrompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  retryContext?: { error: string; errorDetails?: string; attemptNumber: number },
): Promise<string> {
  let generationPrompt = simplifiedPrompt;
  if (retryContext) {
    generationPrompt = `${simplifiedPrompt}\n\n⚠️ CRITICAL: Previous BPMN XML failed validation: ${retryContext.error}${retryContext.errorDetails ? `\nDetails: ${retryContext.errorDetails}` : ""}\n\nFix: ensure all tags closed, di:waypoint self-closing, no invalid elements, proper namespaces.`;
  }
  const messages = buildMessagesWithExamples(systemPrompt, generationPrompt, diagramType, languageCode, languageName);
  const systemMessage = messages.find((m: any) => m.role === "system");
  const userMessages = messages.filter((m: any) => m.role === "user");
  console.log("[GEMINI REQUEST] Sending to Gemini 2.5 Pro");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: userMessages.map((m: any) => ({ role: "user", parts: [{ text: m.content }] })),
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
        generationConfig: { maxOutputTokens: maxTokens, temperature: temperature },
      }),
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${errorText}`);
  }
  const data = await response.json();
  let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!bpmnXml) throw new Error("No content generated from Gemini 2.5 Pro");
  bpmnXml = bpmnXml
    .replace(/```xml\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  bpmnXml = sanitizeBpmnXml(bpmnXml);

  // Optimize BPMN DI to prevent truncation
  const beforeOptimization = bpmnXml.length;
  const estimatedTokens = estimateTokenCount(bpmnXml);

  // Use aggressive optimization if we're close to or over the token limit
  const aggressive = estimatedTokens > maxTokens * 0.8;
  if (needsDIOptimization(bpmnXml, maxTokens) || aggressive) {
    console.log(
      `[BPMN DI Optimization] Before: ${beforeOptimization} chars (~${estimatedTokens} tokens), aggressive: ${aggressive}`,
    );
    bpmnXml = optimizeBpmnDI(bpmnXml, aggressive);
    const afterOptimization = bpmnXml.length;
    const reduction = (((beforeOptimization - afterOptimization) / beforeOptimization) * 100).toFixed(1);
    console.log(
      `[BPMN DI Optimization] After: ${afterOptimization} chars (~${estimateTokenCount(bpmnXml)} tokens), reduced: ${reduction}%`,
    );
  }

  console.log("[GEMINI RESPONSE] Final length:", bpmnXml.length);
  return bpmnXml;
}

async function retryBpmnGenerationIfNecessary(
  simplifiedPrompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  maxAttempts: number = 3,
): Promise<string> {
  let lastValidationError: ValidationResult | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[BPMN Generation] Attempt ${attempt}/${maxAttempts}`);
    try {
      const bpmnXml = await generateBpmnXmlWithGemini(
        simplifiedPrompt,
        systemPrompt,
        diagramType,
        languageCode,
        languageName,
        googleApiKey,
        maxTokens,
        temperature,
        lastValidationError
          ? {
            error: lastValidationError.error || "Validation failed",
            errorDetails: lastValidationError.errorDetails,
            attemptNumber: attempt,
          }
          : undefined,
      );
      const validation = validateBpmnXml(bpmnXml);
      if (validation.isValid) {
        console.log(`[BPMN Generation] Valid XML on attempt ${attempt}`);
        return bpmnXml;
      }
      lastValidationError = validation;
      console.warn(`[BPMN Generation] Validation failed attempt ${attempt}:`, validation.error);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[BPMN Generation] Error attempt ${attempt}:`, error);
      if (attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(
    `Failed to generate valid BPMN XML after ${maxAttempts} attempts. Last error: ${lastValidationError?.error || "Unknown"}`,
  );
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  let cacheType: "exact_hash" | "semantic" | "none" = "none";
  let similarityScore: number | undefined;
  let modelUsed: string | undefined;
  let prompt: string | undefined;
  let promptLength = 0;
  let logId: string | null = null;
  let supabase: any = null;
  try {
    let requestData;
    try {
      requestData = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    prompt = requestData.prompt;
    const diagramType = requestData.diagramType || "bpmn";
    const skipCache = requestData.skipCache === true;
    const modelingAgentMode = requestData.modelingAgentMode === true;
    if (!prompt) throw new Error("Prompt is required");
    promptLength = prompt.length;
    console.log("Generating BPMN for prompt:", prompt);
    const detectedLanguageCode = modelingAgentMode ? "en" : detectLanguage(prompt);
    const detectedLanguageName = modelingAgentMode ? "English" : getLanguageName(detectedLanguageCode);
    console.log(`Language: ${detectedLanguageName} (${detectedLanguageCode})`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) throw new Error("Google API key not configured");

    // Create Supabase client for logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && supabaseServiceKey) {
      supabase = createClient(supabaseUrl, supabaseServiceKey);
    }

    // Get user ID for logging
    let userId: string | undefined;
    if (supabase) {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (token) {
        try {
          const { data: { user } } = await supabase.auth.getUser(token);
          userId = user?.id;
        } catch (error) {
          console.warn('[Logging] Failed to get user:', error);
        }
      }
    }

    // Log generation request
    if (supabase && userId) {
      logId = await logGenerationRequest({
        supabase,
        userId,
        prompt,
        diagramType,
        detectedLanguage: detectedLanguageCode,
        sourceFunction: 'generate-bpmn',
        isMultiDiagram: false,
      });
    }

    // CHECK CACHE FIRST - Skip expensive complexity analysis if we have a cached result
    let promptHash: string;
    try {
      promptHash = await generateHash(`${prompt}:${diagramType}:${detectedLanguageCode}`);
    } catch {
      throw new Error("Failed to generate prompt hash");
    }
    if (!skipCache && !modelingAgentMode) {
      let exactCache;
      try {
        exactCache = await checkExactHashCache(promptHash, diagramType);
      } catch {
        exactCache = null;
      }
      if (exactCache) {
        cacheType = "exact_hash";
        await logPerformanceMetric({
          function_name: "generate-bpmn",
          cache_type: "exact_hash",
          prompt_length: prompt.length,
          response_time_ms: Date.now() - startTime,
          cache_hit: true,
          error_occurred: false,
        });
        // Log cache hit
        if (supabase && logId) {
          await logGenerationSuccess({
            supabase,
            logId,
            resultXml: exactCache.bpmnXml,
            durationMs: Date.now() - startTime,
            cacheHit: true,
          });
        }
        return new Response(JSON.stringify({ bpmnXml: exactCache.bpmnXml, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // TIME BUDGET MANAGEMENT - Track elapsed time to prevent timeout
    const TIMEOUT_LIMIT_MS = 50000; // 50 seconds, leaving 10s buffer before edge function timeout
    const getElapsedTime = () => Date.now() - startTime;
    const hasTimeBudget = (requiredMs: number = 0) => getElapsedTime() + requiredMs < TIMEOUT_LIMIT_MS;

    console.log(`[Time Budget] Starting with ${TIMEOUT_LIMIT_MS}ms limit`);

    // INTELLIGENT PROMPT ANALYSIS - Only for extremely long prompts (trust Gemini 2.5 Pro for normal complexity)
    let finalPromptToGenerate = prompt;
    let wasSimplified = false;
    let wasSplit = false;
    let subPrompts: string[] = [];

    // ASYNC GENERATION FOR COMPLEX PROMPTS - Bypass 60s timeout using background jobs
    if (!modelingAgentMode && shouldUseAsyncGeneration(prompt, promptLength)) {
      console.log(`[Async Mode] Complex prompt detected (length: ${promptLength}), creating background job`);

      try {
        // Create Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
          console.warn('[Async Mode] Supabase config missing, falling back to sync');
        } else {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          // Get user ID from JWT
          const authHeader = req.headers.get('Authorization');
          const token = authHeader?.replace('Bearer ', '');
          let userId: string | undefined;

          if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id;
          }

          // Create job in vision_bpmn_jobs table
          const { data: job, error: jobError } = await supabase
            .from('vision_bpmn_jobs')
            .insert({
              user_id: userId || null,
              source_type: 'prompt',
              prompt: prompt,
              diagram_type: diagramType,
              image_data: null,
              status: 'pending'
            })
            .select()
            .single();

          if (jobError || !job) {
            console.error('[Async Mode] Failed to create job:', jobError);
            console.warn('[Async Mode] Falling back to sync generation');
          } else {
            console.log(`[Async Mode] Job created: ${job.id}`);

            // Trigger async processing (fire and forget)
            fetch(`${supabaseUrl}/functions/v1/process-bpmn-job`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
              },
              body: JSON.stringify({ jobId: job.id })
            }).catch(err => console.error('[Async Mode] Failed to trigger processor:', err));

            // Return immediately with job ID for client polling
            return new Response(JSON.stringify({
              requiresPolling: true,
              jobId: job.id,
              message: 'Complex prompt - generation started in background',
              estimatedTime: '60-90 seconds'
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (asyncError) {
        console.error('[Async Mode] Error setting up async:', asyncError);
        console.warn('[Async Mode] Falling back to sync generation');
        // Continue with normal synchronous generation below
      }
    }

    // DISABLED FOR NORMAL USE - Only analyze extremely long prompts (>5000 chars)
    // Trust Gemini 2.5 Pro + DI optimization to handle complex prompts (proven by Modelling Agent Mode)
    if (!modelingAgentMode && promptLength > 5000) {
      console.log(`[Prompt Analysis] Starting analysis for ${promptLength} char prompt (elapsed: ${getElapsedTime()}ms)...`);

      // Check time budget before expensive AI analysis
      if (!hasTimeBudget(20000)) {
        console.warn(`[Time Budget] Insufficient time for full analysis (${getElapsedTime()}ms elapsed), using fallback`);
        const fallbackResult = fallbackAnalysis(prompt);
        if (fallbackResult.recommendation === 'split') {
          subPrompts = fallbackSplit(prompt);
          return new Response(JSON.stringify({
            requiresSplit: true,
            subPrompts,
            analysis: { complexity: fallbackResult.complexity, reasoning: fallbackResult.reasoning + ' (time budget exceeded)' },
            message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts.`
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const analysisStartTime = Date.now();

      try {
        const analysis = await analyzePromptComplexity(prompt, GOOGLE_API_KEY, detectedLanguageCode, detectedLanguageName);
        const analysisTime = Date.now() - analysisStartTime;
        console.log(`[Prompt Analysis] Completed in ${analysisTime}ms - Recommendation: ${analysis.recommendation} (elapsed: ${getElapsedTime()}ms)`);

        if (analysis.recommendation === "split") {
          // Very complex - split into multiple sub-prompts
          console.log(
            `[Prompt Analysis] Splitting prompt (complexity: ${analysis.complexity.score}, actors: ${analysis.complexity.actors})`,
          );
          const splitStartTime = Date.now();

          // If analysis already provided sub-prompts, use them
          if (analysis.subPrompts && analysis.subPrompts.length > 0) {
            subPrompts = analysis.subPrompts;
          } else {
            subPrompts = await splitPromptIntoSubPrompts(prompt, GOOGLE_API_KEY, detectedLanguageCode, detectedLanguageName);
          }

          const splitTime = Date.now() - splitStartTime;
          console.log(`[Prompt Analysis] Split into ${subPrompts.length} sub-prompts in ${splitTime}ms`);
          wasSplit = true;

          // Return sub-prompts to client for multi-diagram generation
          return new Response(
            JSON.stringify({
              requiresSplit: true,
              subPrompts,
              analysis: {
                complexity: analysis.complexity,
                reasoning: analysis.reasoning,
              },
              message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts for better results.`,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } else if (analysis.recommendation === "simplify") {
          // Moderately complex - simplify
          console.log(
            `[Prompt Analysis] Simplifying prompt (complexity: ${analysis.complexity.score}, actors: ${analysis.complexity.actors})`,
          );
          const simplifyStartTime = Date.now();

          if (analysis.simplifiedPrompt) {
            finalPromptToGenerate = analysis.simplifiedPrompt;
          } else {
            finalPromptToGenerate = await simplifyPrompt(prompt, GOOGLE_API_KEY, detectedLanguageCode, detectedLanguageName);
          }

          const simplifyTime = Date.now() - simplifyStartTime;
          wasSimplified = true;
          promptLength = finalPromptToGenerate.length;
          console.log(
            `[Prompt Analysis] Simplified in ${simplifyTime}ms: ${prompt.length} → ${finalPromptToGenerate.length} chars`,
          );
        } else {
          console.log(
            `[Prompt Analysis] Complexity acceptable (score: ${analysis.complexity.score}), generating directly`,
          );
        }
      } catch (error) {
        console.error('[Prompt Analysis] AI analysis failed, using fallback heuristics:', error);
        // CRITICAL SAFETY CHECK: Use fallback heuristics to avoid timeout on complex prompts
        const fallbackResult = fallbackAnalysis(prompt);

        console.log(`[Prompt Analysis] Fallback result: ${fallbackResult.recommendation} (score: ${fallbackResult.complexity.score})`);

        if (fallbackResult.recommendation === 'split') {
          console.log('[Prompt Analysis] Fallback detected complex prompt, splitting...');
          subPrompts = fallbackSplit(prompt);

          return new Response(JSON.stringify({
            requiresSplit: true,
            subPrompts,
            analysis: {
              complexity: fallbackResult.complexity,
              reasoning: fallbackResult.reasoning + ' (fallback heuristics used due to AI timeout)'
            },
            message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts for better results.`
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (fallbackResult.recommendation === 'simplify') {
          console.log('[Prompt Analysis] Fallback recommends simplification');
          // Use a simple reduction strategy - keep only substantial sentences
          finalPromptToGenerate = prompt.split('. ').filter(s => s.length > 20).join('. ');
          wasSimplified = true;
          promptLength = finalPromptToGenerate.length;
        }
        // Otherwise continue with original prompt
      }
    } else if (modelingAgentMode) {
      console.log("[Prompt Analysis] Skipping analysis (modeling agent mode)");
    } else {
      console.log(`[Prompt Analysis] Skipping analysis (prompt length: ${promptLength} chars, threshold: 5000)`);
    }

    // Final time budget check before generation
    if (!hasTimeBudget(25000)) {
      console.warn(`[Time Budget] Insufficient time for generation (${getElapsedTime()}ms elapsed), forcing split`);
      const quickSplit = fallbackSplit(finalPromptToGenerate || prompt);
      return new Response(JSON.stringify({
        requiresSplit: true,
        subPrompts: quickSplit,
        analysis: { reasoning: 'Time budget exceeded before generation - prompt split automatically' },
        message: `Insufficient time to generate this diagram. It has been split into ${quickSplit.length} sub-prompts.`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Cache already checked above, proceed with model selection
    const criteria = analyzePrompt(finalPromptToGenerate, diagramType);
    const modelSelection = selectModel(criteria);
    let { model, temperature, maxTokens } = modelSelection;
    const { complexityScore } = modelSelection;

    // For very complex prompts, generate without DI to prevent truncation
    // The client will add layout using auto-layout algorithms
    const useNoDI = promptLength > 3000 || complexityScore >= 9;
    const useCompactDI = !useNoDI && (promptLength > 2000 || complexityScore >= 7);

    const systemPrompt = diagramType === 'pid'
      ? getPidSystemPrompt(detectedLanguageCode, detectedLanguageName)
      : getBpmnSystemPrompt(detectedLanguageCode, detectedLanguageName, false, true);

    console.log(
      `[Model Selection] ${model} with ${maxTokens} tokens (complexity: ${complexityScore}, compactDI: ${useCompactDI}, noDI: ${useNoDI})`,
    );
    if (modelingAgentMode)
      temperature =
        model === "google/gemini-2.5-pro" ? Math.min(temperature + 0.1, 0.4) : Math.min(temperature + 0.2, 0.7);
    modelUsed = model;
    // SEMANTIC CACHE DISABLED: Saves 3-5 seconds by skipping expensive embedding generation
    // Embedding generation via OpenAI API takes 2-4s for complex prompts, causing timeouts
    // Modelling Agent Mode bypasses this entirely - adopting same approach for all users
    // Exact hash cache (above) still provides instant responses for perfect matches
    if (false && !skipCache && !modelingAgentMode && isSemanticCacheEnabled()) {
      try {
        const embedding = await generateEmbedding(finalPromptToGenerate);
        const semanticCache = await checkSemanticCache(embedding, diagramType, getSemanticSimilarityThreshold());
        if (semanticCache) {
          cacheType = "semantic";
          similarityScore = semanticCache.similarity;
          await logPerformanceMetric({
            function_name: "generate-bpmn",
            cache_type: "semantic",
            prompt_length: promptLength,
            complexity_score: complexityScore,
            response_time_ms: Date.now() - startTime,
            cache_hit: true,
            similarity_score: semanticCache.similarity,
            error_occurred: false,
          });
          // Log semantic cache hit
          if (supabase && logId) {
            await logGenerationSuccess({
              supabase,
              logId,
              resultXml: semanticCache.bpmnXml,
              durationMs: Date.now() - startTime,
              cacheHit: true,
              cacheSimilarity: semanticCache.similarity,
            });
          }
          return new Response(
            JSON.stringify({
              bpmnXml: semanticCache.bpmnXml,
              cached: true,
              similarity: semanticCache.similarity,
              wasSimplified,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch {
        /* continue */
      }
    }

    // Use the analyzed/simplified prompt for generation
    const bpmnXml = await retryBpmnGenerationIfNecessary(
      finalPromptToGenerate,
      systemPrompt,
      diagramType,
      detectedLanguageCode,
      detectedLanguageName,
      GOOGLE_API_KEY,
      maxTokens,
      temperature,
      3,
    );
    modelUsed = "google/gemini-2.5-pro";
    const finalValidation = validateBpmnXml(bpmnXml);
    if (!finalValidation.isValid) throw new Error(`Final validation failed: ${finalValidation.error}`);
    if (!skipCache && !modelingAgentMode) {
      (async () => {
        try {
          // EMBEDDING GENERATION DISABLED: Skip expensive OpenAI API call (saves 1-2 seconds)
          // Store only exact hash cache without semantic embedding
          // Matches Modelling Agent Mode's efficient approach
          await storeExactHashCache(promptHash, finalPromptToGenerate, diagramType, bpmnXml, undefined);
        } catch {
          /* ignore */
        }
      })();
    }
    await logPerformanceMetric({
      function_name: "generate-bpmn",
      cache_type: cacheType,
      model_used: modelUsed,
      prompt_length: promptLength,
      complexity_score: complexityScore,
      response_time_ms: Date.now() - startTime,
      cache_hit: cacheType !== "none",
      similarity_score: similarityScore,
      error_occurred: false,
    });
    // Log successful generation
    if (supabase && logId) {
      await logGenerationSuccess({
        supabase,
        logId,
        resultXml: bpmnXml,
        durationMs: Date.now() - startTime,
        cacheHit: false,
      });
    }
    return new Response(
      JSON.stringify({
        bpmnXml,
        cached: false,
        wasSimplified,
        originalPromptLength: wasSimplified ? prompt.length : undefined,
        simplifiedPromptLength: wasSimplified ? finalPromptToGenerate.length : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in generate-bpmn:", errorMessage);
    try {
      await logPerformanceMetric({
        function_name: "generate-bpmn",
        cache_type: cacheType,
        model_used: modelUsed,
        prompt_length: promptLength,
        response_time_ms: Date.now() - startTime,
        cache_hit: false,
        error_occurred: true,
        error_message: errorMessage,
      });
    } catch {
      /* ignore */
    }
    // Log error
    if (supabase && logId) {
      await logGenerationError({
        supabase,
        logId,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});