import { serve } from '../shared/aws-shim';

// Supabase interactions removed as per requirement: Lambdas should not call Supabase directly.
import { detectLanguage, getLanguageName } from '../shared/language-detection';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../shared/prompts';
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from '../shared/bpmn-di-optimizer';
import { analyzePrompt, selectModel } from '../shared/model-selection';
import { addBpmnDiagram } from '../shared/bpmn-diagram-generator';
import { checkCache, storeCacheAsync } from '../shared/semantic-cache';
import { logGenerationRequest, logGenerationSuccess, logGenerationError } from '../shared/dashboard-logger';
import { getGoogleApiKey } from '../shared/secrets';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BpmnGenerationJob {
  id: string;
  user_id: string;
  prompt: string;
  diagram_type: 'bpmn' | 'pid';
  source_type: string;
  status: string;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}

// Sanitize BPMN XML (exact copy from generate-bpmn for consistency)
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
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?>/gi, "");
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?>/gi, "");
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, "<?xml");
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, "");
  return sanitized.trim();
}

// Validate BPMN XML (exact copy from generate-bpmn for consistency)
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

// Generate BPMN XML with Gemini
async function generateBpmnXmlWithGemini(
  prompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  model: string,
  maxTokens: number,
  temperature: number,
  retryContext?: { error: string; errorDetails?: string; attemptNumber: number },
  useCompactDI: boolean = false,
): Promise<string> {
  let generationPrompt = prompt;

  // Add compact DI instruction for complex diagrams or on retry
  if (useCompactDI || retryContext) {
    const compactInstruction = `\n\n⚠️ CRITICAL: Use ULTRA-COMPACT diagram interchange to fit within token limit:
- Minimal spacing (horizontal: 120px, vertical: 80px)
- Omit all optional DI attributes
- Use shortest coordinates (no decimals)
- Minimize whitespace in <bpmndi:> section`;

    if (!generationPrompt.includes(compactInstruction)) {
      generationPrompt += compactInstruction;
    }
  }

  if (retryContext) {
    generationPrompt = `${prompt}\n\n⚠️ CRITICAL: Previous BPMN XML failed validation: ${retryContext.error}${retryContext.errorDetails ? `\nDetails: ${retryContext.errorDetails}` : ""}\n\nFix: ensure all tags closed, di:waypoint self-closing, no invalid elements, proper namespaces.`;
  }

  const messages = buildMessagesWithExamples(systemPrompt, generationPrompt, diagramType, languageCode, languageName);
  const systemMessage = messages.find((m: any) => m.role === "system");
  const userMessages = messages.filter((m: any) => m.role === "user");

  // Format model ID (strip 'google/' if present)
  const modelId = model.startsWith('google/') ? model.split('/')[1] : model;

  console.log(`[GEMINI] Calling ${modelId} (attempt ${retryContext?.attemptNumber || 1})`);

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

  // Clean markdown formatting
  bpmnXml = bpmnXml
    .replace(/```xml\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // Sanitize
  bpmnXml = sanitizeBpmnXml(bpmnXml);

  // Optimize DI to prevent truncation
  const beforeOptimization = bpmnXml.length;
  const estimatedTokens = estimateTokenCount(bpmnXml);
  const aggressive = estimatedTokens > maxTokens * 0.8;

  if (needsDIOptimization(bpmnXml, maxTokens) || aggressive) {
    console.log(`[BPMN DI Optimization] Before: ${beforeOptimization} chars (~${estimatedTokens} tokens), aggressive: ${aggressive}`);
    bpmnXml = optimizeBpmnDI(bpmnXml, aggressive);
    const afterOptimization = bpmnXml.length;
    const reduction = (((beforeOptimization - afterOptimization) / beforeOptimization) * 100).toFixed(1);
    console.log(`[BPMN DI Optimization] After: ${afterOptimization} chars (~${estimateTokenCount(bpmnXml)} tokens), reduced: ${reduction}%`);
  }

  console.log("[GEMINI RESPONSE] Final length:", bpmnXml.length);
  return bpmnXml;
}

// Generate BPMN structure only (no DI) for very complex diagrams
async function generateBpmnStructureOnly(
  prompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const structureOnlyPrompt = prompt + `\n\n🚨 CRITICAL - STRUCTURE ONLY MODE:
Generate ONLY the BPMN 2.0 process structure. Do NOT generate any visual layout information.
EXCLUDE completely: All <bpmndi:BPMNDiagram>, <bpmndi:BPMNPlane>, <bpmndi:BPMNShape>, <bpmndi:BPMNEdge>, <dc:Bounds>, <di:waypoint> tags.
INCLUDE: <bpmn:process>, <bpmn:lane>, <bpmn:laneSet>, all tasks, events, gateways, <bpmn:sequenceFlow> with complete attributes and IDs.
The diagram coordinates will be calculated programmatically after generation.
End your XML at </bpmn:definitions> without any <bpmndi:*> section.`;

  const messages = buildMessagesWithExamples(systemPrompt, structureOnlyPrompt, diagramType, languageCode, languageName);
  const systemMessage = messages.find((m: any) => m.role === "system");
  const userMessages = messages.filter((m: any) => m.role === "user");

  console.log(`[GEMINI] Structure-only mode: requesting process without DI`);

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
  let bpmnStructure = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!bpmnStructure) throw new Error("No content generated from Gemini 2.5 Pro");

  // Clean markdown formatting
  bpmnStructure = bpmnStructure
    .replace(/```xml\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  // CRITICAL: Strip any leaked DI (Gemini often ignores the structure-only instruction)
  // Remove complete or truncated <bpmndi:BPMNDiagram> sections
  if (bpmnStructure.includes('<bpmndi:')) {
    console.warn(`[STRUCTURE ONLY] Warning: Output contains DI tags despite instruction, stripping them`);

    // Find the start of DI section
    const diStart = bpmnStructure.indexOf('<bpmndi:');
    if (diStart !== -1) {
      // Find the closing </bpmn:definitions> before DI
      const defsEnd = bpmnStructure.lastIndexOf('</bpmn:definitions>', diStart);
      if (defsEnd !== -1) {
        bpmnStructure = bpmnStructure.substring(0, defsEnd) + '</bpmn:definitions>';
      } else {
        // If no closing tag found before DI, just remove everything from DI onwards
        bpmnStructure = bpmnStructure.substring(0, diStart) + '</bpmn:definitions>';
      }
    }
  }

  // Sanitize XML
  bpmnStructure = sanitizeBpmnXml(bpmnStructure);

  console.log(`[STRUCTURE ONLY] Generated ${bpmnStructure.length} chars`);
  return bpmnStructure;
}

// Retry BPMN generation with validation
async function retryBpmnGeneration(
  prompt: string,
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

  // Detect if prompt is complex - be aggressive to prevent truncation
  const laneCount = (prompt.match(/lane|swimlane|pool/gi) || []).length;

  // Count explicit swimlanes/participants (e.g., "Patient, System, Doctor")
  const explicitSwimLanes = (prompt.match(/(?:swimlane|lane|pool|participant|actor)(?:s)?\s+(?:for|including|:)?\s*([A-Z][^,\.\n]+(?:,\s*[A-Z][^,\.\n]+)*)/gi) || []).length;

  // Detect complex BPMN features
  const hasGateways = /gateway|decision|exclusive|parallel|inclusive|event-based/gi.test(prompt);
  const hasSubprocesses = /subprocess|sub-process|nested process/gi.test(prompt);
  const hasMessageEvents = /message event|send.*message|receive.*message|notification/gi.test(prompt);
  const hasBoundaryEvents = /boundary event|timer|escalat|interrupt/gi.test(prompt);
  const complexFeatureCount = [hasGateways, hasSubprocesses, hasMessageEvents, hasBoundaryEvents].filter(Boolean).length;

  // Count multiple actors/participants (look for comma-separated names or "and")
  const actorMatches = prompt.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*(?:,|and)\s*([A-Z][a-z]+)/g) || [];
  const hasMultipleActors = actorMatches.length >= 2 || explicitSwimLanes > 0;

  // Determine if structure-only mode is needed
  const isComplex = prompt.length > 1500 || laneCount >= 3;
  const useStructureOnly =
    prompt.length > 1500 || // Long prompts
    laneCount >= 3 || // Multiple lane keywords
    explicitSwimLanes > 0 || // Explicit swimlanes listed
    complexFeatureCount >= 2 || // Multiple complex features
    hasMultipleActors; // Multiple actors/participants

  console.log(`[BPMN Generation] Structure-only: ${useStructureOnly ? 'YES' : 'NO'} (length: ${prompt.length}, lane keywords: ${laneCount}, explicit lanes: ${explicitSwimLanes}, complex features: ${complexFeatureCount}, multiple actors: ${hasMultipleActors})`);

  // For VERY complex diagrams, use structure-only mode (no DI from Gemini)
  if (useStructureOnly) {
    console.log(`[BPMN Generation] Using structure-only mode + automatic layout`);
    try {
      const structure = await generateBpmnStructureOnly(
        prompt,
        systemPrompt,
        diagramType,
        languageCode,
        languageName,
        googleApiKey,
        maxTokens,
        temperature,
      );

      // Add diagram layout automatically
      const completeXml = await addBpmnDiagram(structure);
      console.log(`[BPMN Generation] Structure-only complete: ${completeXml.length} chars`);
      return completeXml;
    } catch (error) {
      console.error(`[BPMN Generation] Structure-only failed, falling back to compact DI:`, error);
      // Fall through to compact DI mode
    }
  }

  // For complex diagrams or failover, use compact DI mode
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[BPMN Generation] Attempt ${attempt}/${maxAttempts}`);

    try {
      const bpmnXml = await generateBpmnXmlWithGemini(
        prompt,
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
        isComplex || attempt > 1, // Use compact DI for complex prompts or retries
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

// Main handler
export const handler = serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    const { jobId, prompt: inputPrompt, diagramType: inputDiagramType, authHeader, userId: inputUserId } = requestData;

    if (!jobId) {
      throw new Error('Job ID is required');
    }

    console.log(`[Job ${jobId}] Starting async BPMN generation`);

    // Supabase client and auth removed
    let userId = inputUserId;
    if (!userId && authHeader) {
      console.log(`[Job ${jobId}] Auth header present but Supabase call skipped`);
    }

    let typedJob: BpmnGenerationJob;

    // If prompt is provided directly, use it. Otherwise, we can't fetch from DB.
    if (inputPrompt) {
      console.log(`[Job ${jobId}] Direct payload received`);
      typedJob = {
        id: jobId,
        user_id: userId || 'anonymous',
        prompt: inputPrompt,
        diagram_type: inputDiagramType || 'bpmn',
        source_type: 'prompt',
        status: 'processing'
      };
    } else {
      throw new Error('No prompt provided and Supabase lookup is disabled');
    }

    console.log(`[Job ${jobId}] Processing prompt: ${typedJob.prompt.substring(0, 100)}...`);

    const GOOGLE_API_KEY = await getGoogleApiKey();
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key not configured');
    }

    // Detect language
    const languageCode = detectLanguage(typedJob.prompt);
    const languageName = getLanguageName(languageCode);

    console.log(`[Job ${jobId}] Language: ${languageName} (${languageCode})`);

    // Log generation request
    let logId: string | null = null;
    if (typedJob.user_id) {
      logId = await logGenerationRequest({
        supabase: undefined as any,
        userId: typedJob.user_id,
        prompt: typedJob.prompt,
        diagramType: typedJob.diagram_type,
        detectedLanguage: languageCode,
        sourceFunction: 'process-bpmn-job',
        isMultiDiagram: false,
        jobId: jobId,
      });
    }

    // Check cache before generation
    try {
      console.log(`[Job ${jobId}] Checking cache for similar prompts...`);
      const cachedResult = await checkCache({
        prompt: typedJob.prompt,
        diagramType: typedJob.diagram_type,
        supabase: undefined as any,
        googleApiKey: GOOGLE_API_KEY,
      });

      if (cachedResult) {
        const generationTime = 0; // Cache hit, no generation needed
        console.log(`[Job ${jobId}] 🎯 Cache hit! Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%, returning cached result`);

        // Log cache hit
        if (logId) {
          await logGenerationSuccess({
            supabase: undefined as any,
            logId,
            resultXml: cachedResult.bpmn_xml,
            durationMs: generationTime,
            cacheHit: true,
            cacheSimilarity: cachedResult.similarity,
          });
        }

        // Result would be logged to console. Completion signaled via response only.
        console.log(`[Job ${jobId}] Generation complete (Result would be in DB, but storage skipped)`);

        return new Response(
          JSON.stringify({
            success: true,
            jobId,
            generationTimeMs: generationTime,
            cacheHit: true,
            similarity: cachedResult.similarity
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    } catch (error) {
      console.error(`[Job ${jobId}] Cache check failed:`, error);
      // Continue with generation if cache check fails
    }

    // Get system prompt
    const systemPrompt =
      typedJob.diagram_type === "pid"
        ? getPidSystemPrompt(languageCode, languageName)
        : getBpmnSystemPrompt(languageCode, languageName, false, true);

    // Get appropriate model and token limits based on prompt complexity
    const criteria = analyzePrompt(typedJob.prompt, typedJob.diagram_type);
    const modelSelection = selectModel(criteria);

    console.log(
      `[Job ${jobId}] Model selection: ${modelSelection.model}, maxTokens: ${modelSelection.maxTokens}, reasoning: ${modelSelection.reasoning}`,
    );

    // Track generation start time for logging
    const startTime = Date.now();

    try {
      // Generate BPMN (no timeout limit for background processing)
      const bpmnXml = await retryBpmnGeneration(
        typedJob.prompt,
        systemPrompt,
        typedJob.diagram_type,
        languageCode,
        languageName,
        GOOGLE_API_KEY,
        modelSelection.model,
        modelSelection.maxTokens, // Use dynamic token limit from model selection
        modelSelection.temperature, // Use dynamic temperature
        3, // max attempts
      );

      const generationTime = Date.now() - startTime;
      console.log(`[Job ${jobId}] BPMN generated successfully in ${generationTime}ms (${bpmnXml.length} chars)`);

      // Log successful generation
      if (logId) {
        await logGenerationSuccess({
          supabase: undefined as any,
          logId,
          resultXml: bpmnXml,
          durationMs: generationTime,
          cacheHit: false,
        });
      }

      // Store in cache asynchronously (fire-and-forget, doesn't block response)
      storeCacheAsync({
        prompt: typedJob.prompt,
        bpmnXml: bpmnXml,
        diagramType: typedJob.diagram_type,
        supabase: undefined as any,
        googleApiKey: GOOGLE_API_KEY,
      });

      // Store result skipped as per requirement
      console.log(`[Job ${jobId}] BPMN Generation successful (BPMN length: ${bpmnXml.length})`);

      return new Response(
        JSON.stringify({
          success: true,
          jobId,
          generationTimeMs: generationTime,
        }),
        { status: 200, headers: corsHeaders },
      );
    } catch (generationError) {
      console.error(`[Job ${jobId}] Generation failed:`, generationError);

      const errorMessage =
        generationError instanceof Error ? generationError.message : "Unknown error during generation";

      // Log error
      if (logId) {
        await logGenerationError({
          supabase: undefined as any,
          logId,
          errorMessage,
          errorStack: generationError instanceof Error ? generationError.stack : undefined,
          durationMs: Date.now() - startTime,
        });
      }

      // Error storage skipped
      console.error(`[Job ${jobId}] BPMN Generation failed: ${errorMessage}`);

      return new Response(
        JSON.stringify({
          error: generationError instanceof Error ? generationError.message : "Generation failed",
          jobId,
        }),
        { status: 500, headers: corsHeaders },
      );
    }
  } catch (error) {
    console.error("[process-bpmn-job] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
