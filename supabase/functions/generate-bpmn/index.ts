import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from "../_shared/cache.ts";
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from "../_shared/embeddings.ts";
import { logPerformanceMetric, measureExecutionTime } from "../_shared/metrics.ts";
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from "../_shared/prompts.ts";
import { analyzePrompt, selectModel } from "../_shared/model-selection.ts";
import { detectLanguage, getLanguageName } from "../_shared/language-detection.ts";
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from "../_shared/bpmn-di-optimizer.ts";
import { analyzePromptComplexity, simplifyPrompt, splitPromptIntoSubPrompts } from "../_shared/prompt-analyzer.ts";
import { BPMNProcess, createDefinitions } from "../_shared/bpmn-json-schema.ts";
import { convertBpmnJsonToXml } from "../_shared/bpmn-json-to-xml.ts";

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}

interface SummarizationResult {
  summarizedPrompt: string;
  wasSummarized: boolean;
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

/**
 * Generate BPMN as JSON structure (more compact and efficient for complex prompts)
 */
async function generateBpmnAsJson(
  prompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<BPMNProcess> {
  const systemPrompt = `You are a BPMN 2.0 expert. Generate a BPMN process as a JSON structure in ${languageName}.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "id": "process_id",
  "name": "Process Name",
  "elements": [
    {"id": "start1", "type": "startEvent", "name": "Start"},
    {"id": "task1", "type": "task", "name": "Task Description"},
    {"id": "gateway1", "type": "exclusiveGateway", "name": "Decision Point"},
    {"id": "end1", "type": "endEvent", "name": "End"}
  ],
  "flows": [
    {"id": "flow1", "sourceRef": "start1", "targetRef": "task1"},
    {"id": "flow2", "sourceRef": "task1", "targetRef": "gateway1"},
    {"id": "flow3", "sourceRef": "gateway1", "targetRef": "end1", "name": "Approved"}
  ]
}

Valid element types: startEvent, endEvent, task, userTask, serviceTask, scriptTask, businessRuleTask, manualTask, sendTask, receiveTask, exclusiveGateway, parallelGateway, inclusiveGateway, subprocess

For subprocess, include nested "elements" and "flows" arrays.
For gateways, you can add "gatewayDirection": "Diverging" | "Converging"
For conditional flows, add "conditionExpression": "condition text"

IMPORTANT: 
- All IDs must be unique
- All sourceRef and targetRef must reference existing element IDs
- Use descriptive names in ${languageName}
- Return ONLY the JSON, no markdown formatting`;

  const userPrompt = `Generate a ${diagramType.toUpperCase()} process for:
${prompt}

Requirements:
- Use descriptive names in ${languageName}
- Include all necessary elements and flows
- Ensure all flow references are valid
- For complex workflows, use subprocesses to organize related tasks
- Return ONLY the JSON structure`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: temperature,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Clean up markdown formatting if present
  jsonText = jsonText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const processData = JSON.parse(jsonText);

    // Validate basic structure
    if (!processData.id || !processData.elements || !processData.flows) {
      throw new Error("Invalid JSON structure: missing required fields (id, elements, or flows)");
    }

    console.log(
      `[JSON Generation] Successfully parsed JSON with ${processData.elements.length} elements and ${processData.flows.length} flows`,
    );

    return processData as BPMNProcess;
  } catch (error) {
    console.error("[JSON Parse Error]", error);
    console.error("[JSON Text Preview]", jsonText.substring(0, 500));
    throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
  }
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

    // INTELLIGENT PROMPT ANALYSIS - Use JSON for complex prompts instead of splitting
    let finalPromptToGenerate = prompt;
    let wasSimplified = false;
    let useJsonFormat = false;
    let subPrompts: string[] = [];

    // Complexity keywords with weights
    const complexityKeywords = [
      "swimlane",
      "swim lane",
      "lane",
      "pool",
      "parallel",
      "concurrent",
      "timer",
      "escalat",
      "chase",
      "subprocess",
      "sub-process",
      "sub process",
      "multiple",
      "several",
      "approval",
      "review",
      "recertification",
      "deprovisioning",
      "provisioning",
      "automated",
      "trigger",
      "event",
      "message",
      "signal",
      "boundary",
      "gateway",
      "exclusive",
      "inclusive",
      "intermediate",
      "compensation",
      "remediation",
      "detection",
      "monitoring",
    ];

    const promptLower = prompt.toLowerCase();
    const keywordMatches = complexityKeywords.filter((kw) => promptLower.includes(kw)).length;

    // Calculate complexity score (0-100)
    // Length contributes up to 40 points, keywords contribute up to 60 points
    const lengthScore = Math.min((promptLength / 5000) * 40, 40); // Max at 5000 chars
    const keywordScore = Math.min((keywordMatches / 15) * 60, 60); // Max at 15 keywords
    const promptComplexityScore = lengthScore + keywordScore;

    // Strategy thresholds based on complexity score
    const SIMPLE_THRESHOLD = 20; // < 20: Simple, use direct XML
    const COMPLEX_THRESHOLD = 80; // >= 80: Very complex, split into sub-prompts
    // 20-80: Moderate, use JSON format

    console.log(
      `[Prompt Strategy] Length: ${promptLength} chars, Keywords: ${keywordMatches}, Complexity Score: ${promptComplexityScore.toFixed(1)}`,
    );

    // Decide on generation strategy
    if (!modelingAgentMode && promptComplexityScore >= SIMPLE_THRESHOLD) {
      if (promptComplexityScore >= COMPLEX_THRESHOLD) {
        // VERY COMPLEX: Split into sub-prompts
        console.log(
          `[Prompt Strategy] VERY COMPLEX (score: ${promptComplexityScore.toFixed(1)}) - Splitting into sub-prompts`,
        );

        try {
          const analysis = await analyzePromptComplexity(prompt, GOOGLE_API_KEY);

          if (analysis.subPrompts && analysis.subPrompts.length > 0) {
            subPrompts = analysis.subPrompts;
          } else {
            subPrompts = await splitPromptIntoSubPrompts(prompt, GOOGLE_API_KEY);
          }

          console.log(`[Prompt Strategy] Split into ${subPrompts.length} sub-prompts`);

          return new Response(
            JSON.stringify({
              requiresSplit: true,
              subPrompts,
              analysis: {
                complexity: { score: promptComplexityScore, keywords: keywordMatches, length: promptLength },
                reasoning: `Complexity score ${promptComplexityScore.toFixed(1)}/100 exceeds threshold for single diagram`,
              },
              message: `This workflow is very complex (score: ${promptComplexityScore.toFixed(1)}/100) and has been split into ${subPrompts.length} sub-prompts for optimal results.`,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (error) {
          console.error("[Prompt Strategy] Split failed, falling back to JSON format:", error);
          useJsonFormat = true;
        }
      } else {
        // MODERATELY COMPLEX: Use JSON format (40% more efficient than XML)
        console.log(
          `[Prompt Strategy] MODERATELY COMPLEX (score: ${promptComplexityScore.toFixed(1)}) - Using JSON format for efficiency`,
        );
        useJsonFormat = true;
      }
    } else if (modelingAgentMode) {
      console.log("[Prompt Strategy] Modeling agent mode - using standard XML");
    } else {
      console.log(`[Prompt Strategy] SIMPLE (score: ${promptComplexityScore.toFixed(1)}) - using standard XML`);
    }

    let promptHash: string;
    try {
      promptHash = await generateHash(`${finalPromptToGenerate}:${diagramType}:${detectedLanguageCode}`);
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
        return new Response(JSON.stringify({ bpmnXml: exactCache.bpmnXml, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    const criteria = analyzePrompt(finalPromptToGenerate, diagramType);
    const modelSelection = selectModel(criteria);
    let { model, temperature, maxTokens } = modelSelection;
    const { complexityScore } = modelSelection;

    // If using JSON format, increase token limit (JSON is more compact)
    if (useJsonFormat) {
      maxTokens = Math.min(maxTokens * 1.5, 8192); // 50% more tokens for JSON
      console.log(`[JSON Format] Increased token limit to ${maxTokens} (JSON is ~40% more compact)`);
    }

    const systemPrompt =
      diagramType === "pid"
        ? getPidSystemPrompt(detectedLanguageCode, detectedLanguageName)
        : getBpmnSystemPrompt(detectedLanguageCode, detectedLanguageName);

    console.log(
      `[Model Selection] ${model} with ${maxTokens} tokens (complexity: ${complexityScore}, useJsonFormat: ${useJsonFormat})`,
    );
    if (modelingAgentMode)
      temperature =
        model === "google/gemini-2.5-pro" ? Math.min(temperature + 0.1, 0.4) : Math.min(temperature + 0.2, 0.7);
    modelUsed = model;
    if (!skipCache && !modelingAgentMode && isSemanticCacheEnabled()) {
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

    // Generate BPMN - use JSON format for complex prompts, XML for simple ones
    let bpmnXml: string;

    if (useJsonFormat) {
      console.log("[JSON Generation] Generating BPMN as JSON then converting to XML...");
      const bpmnProcess = await generateBpmnAsJson(
        finalPromptToGenerate,
        diagramType,
        detectedLanguageCode,
        detectedLanguageName,
        GOOGLE_API_KEY,
        maxTokens,
        temperature,
      );
      const definitions = createDefinitions(`Definitions_${Date.now()}`, [bpmnProcess], finalPromptToGenerate);
      bpmnXml = convertBpmnJsonToXml(definitions);
      console.log(`[JSON Generation] Success! Generated ${bpmnXml.length} chars of XML from JSON`);
    } else {
      console.log("[XML Generation] Generating BPMN as XML directly...");
      bpmnXml = await retryBpmnGenerationIfNecessary(
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
    }

    modelUsed = "google/gemini-2.5-pro";
    const finalValidation = validateBpmnXml(bpmnXml);
    if (!finalValidation.isValid) throw new Error(`Final validation failed: ${finalValidation.error}`);
    if (!skipCache && !modelingAgentMode) {
      (async () => {
        try {
          let embedding: number[] | undefined;
          if (isSemanticCacheEnabled()) {
            try {
              embedding = await generateEmbedding(finalPromptToGenerate);
            } catch {
              /* ignore */
            }
          }
          await storeExactHashCache(promptHash, finalPromptToGenerate, diagramType, bpmnXml, embedding);
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
    return new Response(
      JSON.stringify({
        bpmnXml,
        cached: false,
        wasSimplified,
        usedJsonFormat: useJsonFormat,
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
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
