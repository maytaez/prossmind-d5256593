import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectLanguage, getLanguageName } from "../_shared/language-detection.ts";
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from "../_shared/prompts.ts";
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from "../_shared/bpmn-di-optimizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BpmnGenerationJob {
  id: string;
  user_id: string;
  prompt: string;
  diagram_type: "bpmn" | "pid";
  source_type: string;
  status: string;
}

// Sanitize BPMN XML (extracted from generate-bpmn)
function sanitizeBpmnXml(xml: string): string {
  let sanitized = xml;
  sanitized = sanitized.replace(/bpmns:/gi, "bpmn:");
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, "bpmndi:BPMNShape");
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, "bpmndi:BPMNEdge");

  // Fix unclosed di:waypoint tags
  sanitized = sanitized.replace(/<\/\s*di:waypoint\s*>/gi, "");
  sanitized = sanitized.replace(
    /<(\s*)di:waypoint\s*([^>]*?)>/gi,
    (match: string, whitespace: string, attrs: string) => {
      if (match.includes("/>")) return match;
      const cleanAttrs = attrs.trim();
      return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
    },
  );

  // Fix unclosed bpmndi:BPMNShape tags (close them if they're missing closing tags)
  // Look for opening BPMNShape tags without proper closing
  const shapeOpenings = (sanitized.match(/<bpmndi:BPMNShape[^>]*>/g) || []).length;
  const shapeClosings = (sanitized.match(/<\/bpmndi:BPMNShape>/g) || []).length;

  if (shapeOpenings > shapeClosings) {
    console.warn(`[Sanitization] Found ${shapeOpenings} BPMNShape openings but only ${shapeClosings} closings`);
    // Try to fix by making self-closing if they have no children
    sanitized = sanitized.replace(
      /<bpmndi:BPMNShape([^>]*?)>\s*(?=<(?:bpmndi:BPMNShape|bpmndi:BPMNEdge|\/bpmndi:BPMNPlane))/g,
      "<bpmndi:BPMNShape$1/>",
    );
  }

  // Fix unclosed bpmndi:BPMNEdge tags
  const edgeOpenings = (sanitized.match(/<bpmndi:BPMNEdge[^>]*>/g) || []).length;
  const edgeClosings = (sanitized.match(/<\/bpmndi:BPMNEdge>/g) || []).length;

  if (edgeOpenings > edgeClosings) {
    console.warn(`[Sanitization] Found ${edgeOpenings} BPMNEdge openings but only ${edgeClosings} closings`);
    // Add closing tags before the next opening or plane closing
    sanitized = sanitized.replace(
      /<bpmndi:BPMNEdge([^>]*?)>((?:(?!<\/bpmndi:BPMNEdge>).)*?)(?=<(?:bpmndi:BPMNShape|bpmndi:BPMNEdge|\/bpmndi:BPMNPlane))/gs,
      (match, attrs, content) => {
        // If content only has waypoints, close the tag
        if (content.trim().match(/^(<di:waypoint[^>]*\/>[\s\n]*)*$/)) {
          return `<bpmndi:BPMNEdge${attrs}>${content}</bpmndi:BPMNEdge>`;
        }
        return match;
      },
    );
  }

  sanitized = sanitized.replace(/<\s*\/\?xml/gi, "<?xml");
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
  return sanitized.trim();
}

// Validate BPMN XML (extracted from generate-bpmn)
function validateBpmnXml(xml: string): { isValid: boolean; error?: string } {
  if (!xml || typeof xml !== "string") return { isValid: false, error: "Invalid XML: empty or non-string input" };
  if (!xml.trim().startsWith("<?xml")) return { isValid: false, error: "Missing XML declaration" };
  if (!xml.includes("<bpmn:definitions") && !xml.includes("<bpmn:Definitions") && !xml.includes("<definitions"))
    return { isValid: false, error: "Missing BPMN definitions element" };
  if (!xml.includes("<bpmn:process") && !xml.includes("<process"))
    return { isValid: false, error: "Missing BPMN process element" };
  if (!xml.includes("<bpmndi:BPMNDiagram") && !xml.includes("<bpmndi:BPMNPlane"))
    return { isValid: false, error: "Missing BPMN diagram interchange" };

  // Check for balanced BPMNShape tags
  const shapeOpenings = (xml.match(/<bpmndi:BPMNShape[^>]*(?<!\/)\s*>/g) || []).length;
  const shapeSelfClosing = (xml.match(/<bpmndi:BPMNShape[^>]*\/>/g) || []).length;
  const shapeClosings = (xml.match(/<\/bpmndi:BPMNShape>/g) || []).length;

  if (shapeOpenings !== shapeClosings) {
    return {
      isValid: false,
      error: `Unbalanced BPMNShape tags: ${shapeOpenings} openings, ${shapeClosings} closings, ${shapeSelfClosing} self-closing`,
    };
  }

  // Check for balanced BPMNEdge tags
  const edgeOpenings = (xml.match(/<bpmndi:BPMNEdge[^>]*(?<!\/)\s*>/g) || []).length;
  const edgeSelfClosing = (xml.match(/<bpmndi:BPMNEdge[^>]*\/>/g) || []).length;
  const edgeClosings = (xml.match(/<\/bpmndi:BPMNEdge>/g) || []).length;

  if (edgeOpenings !== edgeClosings) {
    return {
      isValid: false,
      error: `Unbalanced BPMNEdge tags: ${edgeOpenings} openings, ${edgeClosings} closings, ${edgeSelfClosing} self-closing`,
    };
  }

  return { isValid: true };
}

// Generate BPMN XML using Gemini (extracted and adapted from generate-bpmn)
async function generateBpmnXml(
  prompt: string,
  systemPrompt: string,
  diagramType: "bpmn" | "pid",
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  retryContext?: { error: string; attemptNumber: number },
): Promise<string> {
  let generationPrompt = prompt;
  if (retryContext) {
    generationPrompt = `${prompt}\n\n⚠️ CRITICAL: Previous BPMN XML failed validation: ${retryContext.error}\n\nFix: ensure all tags closed, di:waypoint self-closing, no invalid elements, proper namespaces.`;
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
    console.log(`[BPMN DI Optimization] Before: ${beforeOptimization} chars (~${estimatedTokens} tokens)`);
    bpmnXml = optimizeBpmnDI(bpmnXml, aggressive);
    const afterOptimization = bpmnXml.length;
    console.log(`[BPMN DI Optimization] After: ${afterOptimization} chars (~${estimateTokenCount(bpmnXml)} tokens)`);
  }

  return bpmnXml;
}

// Retry logic for BPMN generation
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
  let lastValidationError: { error?: string } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[BPMN Generation] Attempt ${attempt}/${maxAttempts}`);
    try {
      const bpmnXml = await generateBpmnXml(
        prompt,
        systemPrompt,
        diagramType,
        languageCode,
        languageName,
        googleApiKey,
        maxTokens,
        temperature,
        lastValidationError
          ? { error: lastValidationError.error || "Validation failed", attemptNumber: attempt }
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId } = await req.json();

    if (!jobId) {
      throw new Error("Job ID is required");
    }

    console.log(`[Job ${jobId}] Starting async BPMN generation`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get job from database
    const { data: job, error: fetchError } = await supabase
      .from("vision_bpmn_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("source_type", "prompt") // Only process prompt-based jobs
      .single();

    if (fetchError || !job) {
      console.error(`[Job ${jobId}] Job not found:`, fetchError);
      return new Response(JSON.stringify({ error: "Job not found" }), { status: 404, headers: corsHeaders });
    }

    const typedJob = job as unknown as BpmnGenerationJob;

    if (!typedJob.prompt) {
      throw new Error("Job prompt is missing");
    }

    // Update status to processing
    await supabase
      .from("vision_bpmn_jobs")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    console.log(`[Job ${jobId}] Processing prompt: ${typedJob.prompt.substring(0, 100)}...`);

    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    if (!GOOGLE_API_KEY) {
      throw new Error("Google API key not configured");
    }

    // Detect language
    const languageCode = detectLanguage(typedJob.prompt);
    const languageName = getLanguageName(languageCode);

    console.log(`[Job ${jobId}] Language: ${languageName} (${languageCode})`);

    // Get system prompt
    const systemPrompt =
      typedJob.diagram_type === "pid"
        ? getPidSystemPrompt(languageCode, languageName)
        : getBpmnSystemPrompt(languageCode, languageName, false, true);

    try {
      // Generate BPMN (no timeout limit for background processing)
      const startTime = Date.now();
      const bpmnXml = await retryBpmnGeneration(
        typedJob.prompt,
        systemPrompt,
        typedJob.diagram_type,
        languageCode,
        languageName,
        GOOGLE_API_KEY,
        8192, // maxTokens
        0.3, // temperature
        3, // max attempts
      );

      const generationTime = Date.now() - startTime;
      console.log(`[Job ${jobId}] BPMN generated successfully in ${generationTime}ms (${bpmnXml.length} chars)`);

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

      // Store error
      await supabase
        .from("vision_bpmn_jobs")
        .update({
          status: "failed",
          error_message: generationError instanceof Error ? generationError.message : "Unknown error during generation",
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
