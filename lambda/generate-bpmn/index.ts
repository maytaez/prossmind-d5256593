import { serve } from '../shared/aws-shim';
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

// Supabase interactions removed as per requirement: Lambdas should not call Supabase directly.
import { checkCache, storeCacheAsync } from '../shared/semantic-cache';
import { logPerformanceMetric, measureExecutionTime } from '../shared/metrics';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../shared/prompts';
import { analyzePrompt, selectModel } from '../shared/model-selection';
import { detectLanguage, getLanguageName } from '../shared/language-detection';
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from '../shared/bpmn-di-optimizer';

import { logGenerationRequest, logGenerationSuccess, logGenerationError } from '../shared/dashboard-logger';
import { getGoogleApiKey } from '../shared/secrets';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}

// Summarization function removed as it was unused and not present in Edge implementation

/**
 * Detect if prompt requires async generation (adjusted thresholds to prevent API Gateway 29s timeout)
 * Routes prompts likely to take >25s to background jobs to avoid 504 errors
 */
function shouldUseAsyncGeneration(prompt: string, promptLength: number): boolean {
  const actors = (prompt.match(/actor|participant|swimlane|pool|lane|department|system|service|business|court|creditor|customer|manager|team|user/gi) || []).length;
  const complexity = (prompt.match(/subprocess|parallel|timer|boundary|escalate|event|gateway|decision|approval|review|meeting|discharge/gi) || []).length;

  // Enhanced detection for business processes
  const businessProcessKeywords = (prompt.match(/filing|paperwork|submit|review|approve|attend|meeting|issue|release|complete|determine/gi) || []).length;
  const sequentialSteps = (prompt.match(/then|after|once|when|must|will|can/gi) || []).length;

  // Balanced thresholds - only trigger async for genuinely complex prompts
  return (
    promptLength > 1200 ||           // Long prompts (increased from 300)
    actors >= 5 ||                   // 5+ actors/entities (increased from 2)
    complexity >= 4 ||               // 4+ complex features (increased from 2)
    businessProcessKeywords >= 8 ||  // Business process with many steps (increased from 3)
    sequentialSteps >= 8 ||          // Many sequential steps (increased from 4)
    (actors >= 3 && complexity >= 3) // Moderate actors + complexity (increased from 1+1)
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
  model: string,
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

  // Format model ID (strip 'google/' if present)
  const modelId = model.startsWith('google/') ? model.split('/')[1] : model;

  console.log(`[GEMINI REQUEST] Sending to ${modelId}`);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${googleApiKey}`,
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
  if (!bpmnXml) throw new Error(`No content generated from ${modelId}`);
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
  model: string,
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
        model,
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

export const handler = serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  let cacheType: "exact_hash" | "semantic" | "none" = "none";
  let similarityScore: number | undefined;
  let modelUsed: string | undefined;
  let prompt: string | undefined;
  let promptLength = 0;
  let logId: string | null = null;

  try {
    let requestData;
    try {
      console.log('[DEBUG] Request method:', req.method);
      console.log('[DEBUG] Content-Type:', req.headers.get('content-type'));
      const bodyText = await req.text();
      console.log('[DEBUG] Request body (raw):', bodyText);
      console.log('[DEBUG] Request body length:', bodyText?.length || 0);
      console.log('[DEBUG] Request body type:', typeof bodyText);

      if (!bodyText || bodyText.trim() === '') {
        console.error('[DEBUG] Empty body received');
        return new Response(JSON.stringify({ error: "Empty request body", details: 'No data received in request body' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      requestData = JSON.parse(bodyText);
      console.log('[DEBUG] Parsed request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('[DEBUG] JSON parse error:', parseError);
      console.error('[DEBUG] Parse error type:', parseError instanceof Error ? parseError.constructor.name : typeof parseError);
      console.error('[DEBUG] Parse error message:', parseError instanceof Error ? parseError.message : String(parseError));
      return new Response(JSON.stringify({ error: "Invalid JSON", details: parseError instanceof Error ? parseError.message : 'Unknown parse error' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    prompt = requestData.prompt;
    const diagramType = requestData.diagramType || "bpmn";
    // Force skipCache as per user request to disable caching
    const skipCache = true; // requestData.skipCache === true;
    const modelingAgentMode = requestData.modelingAgentMode === true;
    if (!prompt) throw new Error("Prompt is required");
    promptLength = prompt.length;
    console.log("Generating BPMN for prompt:", prompt);
    const detectedLanguageCode = modelingAgentMode ? "en" : detectLanguage(prompt);
    const detectedLanguageName = modelingAgentMode ? "English" : getLanguageName(detectedLanguageCode);
    console.log(`Language: ${detectedLanguageName} (${detectedLanguageCode})`);

    // ASYNC HANDOFF FOR COMPLEX PROMPTS - High Priority
    // Bypass all local processing and hand off to background job to avoid API Gateway 29s timeout
    if (!modelingAgentMode && (promptLength > 200 || shouldUseAsyncGeneration(prompt, promptLength))) {
      console.log(`[Async Mode] Complex prompt detected (length: ${promptLength}), handoff to background job`);
      try {
        const jobId = crypto.randomUUID();
        const client = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
        const payload = JSON.stringify({
          jobId,
          prompt,
          diagramType,
          authHeader: req.headers.get('Authorization'),
          sourceFunction: 'generate-bpmn'
        });

        const command = new InvokeCommand({
          FunctionName: 'prossmind-process-bpmn-job',
          InvocationType: 'Event',
          Payload: new TextEncoder().encode(payload),
        });

        await client.send(command).catch(err => {
          console.error('[Async Mode] Lambda invocation failed:', err);
          throw err;
        });

        return new Response(JSON.stringify({
          requiresPolling: true,
          jobId: jobId,
          message: 'Complex prompt - generation started in background',
          estimatedTime: '60-90 seconds'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (asyncError) {
        console.error('[Async Mode] Critical handoff error, attempting sync fallback:', asyncError);
        // Fall through to sync generation if handoff fails
      }
    }

    // Fetch Google API Key from AWS Secrets Manager
    const GOOGLE_API_KEY = await getGoogleApiKey();
    if (!GOOGLE_API_KEY) throw new Error("Google API key not configured");

    // Supabase client and user resolution removed
    let userId: string | undefined;


    // Log generation request - Temporarily disabled
    /*
    if (userId) {
      logId = await logGenerationRequest({
        supabase: undefined as any,
        userId,
        prompt,
        diagramType,
        detectedLanguage: detectedLanguageCode,
        sourceFunction: "generate-bpmn",
        isMultiDiagram: false,
      });
    }
    */

    // CHECK CACHE FIRST - Temporarily disabled
    /*
    if (!skipCache && !modelingAgentMode) {
      try {
        const GOOGLE_API_KEY = await getGoogleApiKey();
        if (GOOGLE_API_KEY) {
          console.log('[Cache] Checking for cached results...');
          const cachedResult = await checkCache({
            prompt,
            diagramType,
            supabase: undefined as any,
            googleApiKey: GOOGLE_API_KEY,
          });

          if (cachedResult) {
            cacheType = cachedResult.similarity === 1.0 ? "exact_hash" : "semantic";
            similarityScore = cachedResult.similarity;

            console.log(`[Cache] ✅ Cache hit! Type: ${cacheType}, Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%`);

            await logPerformanceMetric({
              function_name: "generate-bpmn",
              cache_type: cacheType,
              prompt_length: prompt.length,
              response_time_ms: Date.now() - startTime,
              cache_hit: true,
              similarity_score: cachedResult.similarity,
              error_occurred: false,
            });

            // Log cache hit
            if (logId) {
              await logGenerationSuccess({
                supabase: undefined as any,
                logId,
                resultXml: cachedResult.bpmn_xml,
                durationMs: Date.now() - startTime,
                cacheHit: true,
                cacheSimilarity: cachedResult.similarity,
              });
            }

            return new Response(
              JSON.stringify({
                bpmnXml: cachedResult.bpmn_xml,
                cached: true,
                similarity: cachedResult.similarity
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          console.log('[Cache] ❌ No cache hit, proceeding with generation');
        }
      } catch (cacheError) {
        console.warn('[Cache] Cache check failed, proceeding with generation:', cacheError);
        // Continue with generation if cache check fails
      }
    }
    */

    // TIME BUDGET MANAGEMENT - Track elapsed time to prevent API Gateway timeout
    const TIMEOUT_LIMIT_MS = 25000; // 25 seconds, leaving 4s buffer before API Gateway's 29s hard limit
    const getElapsedTime = () => Date.now() - startTime;
    const hasTimeBudget = (requiredMs: number = 0) => getElapsedTime() + requiredMs < TIMEOUT_LIMIT_MS;

    console.log(`[Time Budget] Starting with ${TIMEOUT_LIMIT_MS}ms limit`);

    // SIMPLIFIED FLOW: Direct generation for simple prompts (Complex already handled above)
    let finalPromptToGenerate = prompt;

    // Direct generation for non-complex prompts begins here

    // Complex prompts are handled via async generation above
    // Simple prompts proceed directly to generation
    console.log(`[Generation Mode] ${modelingAgentMode ? 'Modeling Agent' : 'Standard'} - prompt length: ${promptLength} chars`);

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
    // Semantic cache check already performed above in unified checkCache() call
    // This section is no longer needed as cache checking is now handled earlier

    // Use the analyzed/simplified prompt for generation
    const bpmnXml = await retryBpmnGenerationIfNecessary(
      finalPromptToGenerate,
      systemPrompt,
      diagramType,
      detectedLanguageCode,
      detectedLanguageName,
      GOOGLE_API_KEY,
      model,
      maxTokens,
      temperature,
      3,
    );
    modelUsed = model;
    const finalValidation = validateBpmnXml(bpmnXml);
    if (!finalValidation.isValid) throw new Error(`Final validation failed: ${finalValidation.error}`);
    // Store in cache asynchronously - Temporarily disabled
    /*
    if (!skipCache && !modelingAgentMode) {
      const GOOGLE_API_KEY = await getGoogleApiKey();
      if (GOOGLE_API_KEY) {
        storeCacheAsync({
          prompt: finalPromptToGenerate,
          bpmnXml: bpmnXml,
          diagramType,
          supabase: undefined as any,
          googleApiKey: GOOGLE_API_KEY,
        });
      }
    }
    */
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
    // Log successful generation - Temporarily disabled
    /*
    if (logId) {
      await logGenerationSuccess({
        supabase: undefined as any,
        logId,
        resultXml: bpmnXml,
        durationMs: Date.now() - startTime,
        cacheHit: false,
      });
    }
    */
    return new Response(
      JSON.stringify({
        bpmnXml,
        cached: false,
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
    // Log error - Temporarily disabled
    /*
    if (logId) {
      await logGenerationError({
        supabase: undefined as any,
        logId,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });
    }
    */
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});