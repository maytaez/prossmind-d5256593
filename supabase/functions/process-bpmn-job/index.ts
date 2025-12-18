import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectLanguage, getLanguageName } from "../_shared/language-detection.ts";
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from "../_shared/prompts.ts";
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from "../_shared/bpmn-di-optimizer.ts";
import { selectModel } from "../_shared/model-selection.ts";
import { addBpmnDiagram } from "../_shared/bpmn-diagram-generator.ts";
import { checkCache, storeCacheAsync } from "../_shared/semantic-cache.ts";
import { logGenerationRequest, logGenerationSuccess, logGenerationError } from "../_shared/dashboard-logger.ts";

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

  console.log(`[GEMINI] Calling Gemini 2.5 Pro (attempt ${retryContext?.attemptNumber || 1})`);

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

    // Detect if prompt is complex - be aggressive to prevent truncation
    const laneCount = (prompt.match(/lane|swimlane|pool/gi) || []).length;

    // Count explicit swimlanes/participants (e.g., "Patient, System, Doctor")
    const explicitSwimLanes = (
      prompt.match(
        /(?:swimlane|lane|pool|participant|actor)(?:s)?\s+(?:for|including|:)?\s*([A-Z][^,\.\n]+(?:,\s*[A-Z][^,\.\n]+)*)/gi,
      ) || []
    ).length;

    // Detect complex BPMN features
    const hasGateways = /gateway|decision|exclusive|parallel|inclusive|event-based/gi.test(prompt);
    const hasSubprocesses = /subprocess|sub-process|nested process/gi.test(prompt);
    const hasMessageEvents = /message event|send.*message|receive.*message|notification/gi.test(prompt);
    const hasBoundaryEvents = /boundary event|timer|escalat|interrupt/gi.test(prompt);
    const complexFeatureCount = [hasGateways, hasSubprocesses, hasMessageEvents, hasBoundaryEvents].filter(
      Boolean,
    ).length;

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

    console.log(
      `[BPMN Generation] Structure-only: ${useStructureOnly ? "YES" : "NO"} (length: ${prompt.length}, lane keywords: ${laneCount}, explicit lanes: ${explicitSwimLanes}, complex features: ${complexFeatureCount}, multiple actors: ${hasMultipleActors})`,
    );

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
    Deno.serve(async (req) => {
      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      try {
        const { jobId } = await req.json();

        if (!jobId) {
          throw new Error('Job ID is required');
        }

        console.log(`[Job ${jobId}] Starting async BPMN generation`);

        // Create Supabase client
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get job from database
        const { data: job, error: fetchError } = await supabase
          .from('vision_bpmn_jobs')
          .select('*')
          .eq('id', jobId)
          .eq('source_type', 'prompt') // Only process prompt-based jobs
          .single();

        if (fetchError || !job) {
          console.error(`[Job ${jobId}] Job not found:`, fetchError);
          return new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: corsHeaders }
          );
        }

        const typedJob = job as unknown as BpmnGenerationJob;

        if (!typedJob.prompt) {
          throw new Error('Job prompt is missing');
        }

        // Update status to processing
        await supabase
          .from('vision_bpmn_jobs')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', jobId);

        console.log(`[Job ${jobId}] Processing prompt: ${typedJob.prompt.substring(0, 100)}...`);

        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
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
            supabase,
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
            supabase,
            googleApiKey: GOOGLE_API_KEY,
          });

          if (cachedResult) {
            const generationTime = 0; // Cache hit, no generation needed
            console.log(`[Job ${jobId}] 🎯 Cache hit! Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%, returning cached result`);

            // Log cache hit
            if (logId) {
              await logGenerationSuccess({
                supabase,
                logId,
                resultXml: cachedResult.bpmn_xml,
                durationMs: generationTime,
                cacheHit: true,
                cacheSimilarity: cachedResult.similarity,
              });
            }

            // Update job with cached result
            await supabase
              .from('vision_bpmn_jobs')
              .update({
                status: 'completed',
                bpmn_xml: cachedResult.bpmn_xml,
                model_used: 'cache-hit',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', jobId);

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
        const modelSelection = selectModel({
          promptLength: typedJob.prompt.length,
          diagramType: typedJob.diagram_type,
          hasMultiplePools: (typedJob.prompt.match(/pool|swimlane|lane/gi) || []).length > 1,
          hasComplexGateways: (typedJob.prompt.match(/gateway|decision|exclusive|parallel|inclusive/gi) || []).length > 1,
          hasSubprocesses: (typedJob.prompt.match(/subprocess|sub-process/gi) || []).length > 0,
          hasMultipleParticipants: (typedJob.prompt.match(/actor|participant/gi) || []).length > 2,
          hasErrorHandling: (typedJob.prompt.match(/error|exception|boundary/gi) || []).length > 0,
          hasDataObjects: (typedJob.prompt.match(/data|document|artifact/gi) || []).length > 0,
          hasMessageFlows: (typedJob.prompt.match(/message.*flow|message.*event/gi) || []).length > 0,
        });

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
            modelSelection.maxTokens, // Use dynamic token limit from model selection
            modelSelection.temperature, // Use dynamic temperature
            3, // max attempts
          );

          const generationTime = Date.now() - startTime;
          console.log(`[Job ${jobId}] BPMN generated successfully in ${generationTime}ms (${bpmnXml.length} chars)`);

          // Log successful generation
          if (logId) {
            await logGenerationSuccess({
              supabase,
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
            supabase,
            googleApiKey: GOOGLE_API_KEY,
          });

          // Store result
          await supabase
            .from("vision_bpmn_jobs")
            .update({
              status: "completed",
              bpmn_xml: bpmnXml,
              model_used: "gemini-2.5-pro",
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

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
              supabase,
              logId,
              errorMessage,
              errorStack: generationError instanceof Error ? generationError.stack : undefined,
              durationMs: Date.now() - startTime,
            });
          }

          // Store error
          await supabase
            .from("vision_bpmn_jobs")
            .update({
              status: "failed",
              error_message: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);

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
