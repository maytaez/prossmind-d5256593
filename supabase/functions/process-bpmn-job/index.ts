// Process BPMN Job Edge Function
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

function sanitizeBpmnXml(xml: string): string {
    let sanitized = xml;
    sanitized = sanitized.replace(/bpmns:/gi, "bpmn:");
    sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, "bpmndi:BPMNShape");
    sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, "bpmndi:BPMNEdge");
    sanitized = sanitized.replace(/<\/\s*di:waypoint\s*>/gi, "");
    sanitized = sanitized.replace(/<(\s*)di:waypoint\s*([^>]*?)>/gi, (match, ws, attrs) => {
        if (match.includes("/>")) return match;
        return attrs.trim() ? `<${ws}di:waypoint ${attrs.trim()}/>` : `<${ws}di:waypoint/>`;
    });
    sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, "");
    sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
    return sanitized.trim();
}

function validateBpmnXml(xml: string): ValidationResult {
    if (!xml || typeof xml !== "string") return { isValid: false, error: "Invalid XML" };
    if (!xml.trim().startsWith("<?xml")) return { isValid: false, error: "Missing XML declaration" };
    if (!xml.includes("<bpmn:definitions") && !xml.includes("<definitions"))
        return { isValid: false, error: "Missing BPMN definitions" };
    if (!xml.includes("<bpmn:process") && !xml.includes("<process"))
        return { isValid: false, error: "Missing BPMN process" };
    return { isValid: true };
}

async function generateBpmnXmlWithGemini(
    prompt: string, systemPrompt: string, diagramType: string, languageCode: string,
    languageName: string, googleApiKey: string, maxTokens: number, temperature: number,
    retryContext?: { error: string; attemptNumber: number }
): Promise<string> {
    let generationPrompt = prompt;
    if (retryContext) {
        generationPrompt = `${prompt}\n\n⚠️ Previous attempt failed: ${retryContext.error}\n\nFix: ensure all tags closed, proper namespaces.`;
    }

    const messages = buildMessagesWithExamples(systemPrompt, generationPrompt, diagramType, languageCode, languageName);
    const systemMessage = messages.find((m: any) => m.role === "system");
    const userMessages = messages.filter((m: any) => m.role === "user");

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: userMessages.map((m: any) => ({ role: "user", parts: [{ text: m.content }] })),
                systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
                generationConfig: { maxOutputTokens: maxTokens, temperature },
            }),
        }
    );

    if (!response.ok) throw new Error(`Gemini API error: ${await response.text()}`);

    const data = await response.json();
    let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!bpmnXml) throw new Error("No content generated");

    bpmnXml = bpmnXml.replace(/```xml\n?/g, "").replace(/```\n?/g, "").trim();
    bpmnXml = sanitizeBpmnXml(bpmnXml);

    if (needsDIOptimization(bpmnXml, maxTokens)) {
        bpmnXml = optimizeBpmnDI(bpmnXml, estimateTokenCount(bpmnXml) > maxTokens * 0.8);
    }

    return bpmnXml;
}

async function retryBpmnGeneration(
    prompt: string, systemPrompt: string, diagramType: "bpmn" | "pid",
    languageCode: string, languageName: string, googleApiKey: string,
    maxTokens: number, temperature: number, maxAttempts: number
): Promise<string> {
    let lastError: ValidationResult | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        console.log(`[BPMN Generation] Attempt ${attempt}/${maxAttempts}`);
        try {
            const bpmnXml = await generateBpmnXmlWithGemini(
                prompt, systemPrompt, diagramType, languageCode, languageName,
                googleApiKey, maxTokens, temperature,
                lastError ? { error: lastError.error || "Validation failed", attemptNumber: attempt } : undefined
            );

            const validation = validateBpmnXml(bpmnXml);
            if (validation.isValid) return bpmnXml;

            lastError = validation;
            console.warn(`[BPMN Generation] Validation failed:`, validation.error);
        } catch (error) {
            console.error(`[BPMN Generation] Error:`, error);
            if (attempt === maxAttempts) throw error;
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error(`Failed to generate valid BPMN after ${maxAttempts} attempts`);
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { jobId } = await req.json();
        if (!jobId) throw new Error('Job ID is required');

        console.log(`[Job ${jobId}] Starting async BPMN generation`);

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!supabaseUrl || !supabaseKey) throw new Error('Supabase configuration missing');

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: job, error: fetchError } = await supabase
            .from('vision_bpmn_jobs')
            .select('*')
            .eq('id', jobId)
            .eq('source_type', 'prompt')
            .single();

        if (fetchError || !job) {
            return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404, headers: corsHeaders });
        }

        const typedJob = job as unknown as BpmnGenerationJob;
        if (!typedJob.prompt) throw new Error('Job prompt is missing');

        await supabase.from('vision_bpmn_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', jobId);

        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
        if (!GOOGLE_API_KEY) throw new Error('Google API key not configured');

        const languageCode = detectLanguage(typedJob.prompt);
        const languageName = getLanguageName(languageCode);

        let logId: string | null = null;
        if (typedJob.user_id) {
            logId = await logGenerationRequest({
                supabase, userId: typedJob.user_id, prompt: typedJob.prompt,
                diagramType: typedJob.diagram_type, detectedLanguage: languageCode,
                sourceFunction: 'process-bpmn-job', isMultiDiagram: false, jobId,
            });
        }

        // Check cache
        try {
            const cachedResult = await checkCache({
                prompt: typedJob.prompt, diagramType: typedJob.diagram_type, supabase, googleApiKey: GOOGLE_API_KEY,
            });

            if (cachedResult) {
                console.log(`[Job ${jobId}] Cache hit! Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%`);
                if (logId) await logGenerationSuccess({ supabase, logId, resultXml: cachedResult.bpmn_xml, durationMs: 0, cacheHit: true, cacheSimilarity: cachedResult.similarity });
                await supabase.from('vision_bpmn_jobs').update({ status: 'completed', bpmn_xml: cachedResult.bpmn_xml, model_used: 'cache-hit', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
                return new Response(JSON.stringify({ success: true, jobId, cacheHit: true }), { status: 200, headers: corsHeaders });
            }
        } catch (e) {
            console.warn('[Job] Cache check failed:', e);
        }

        const systemPrompt = typedJob.diagram_type === 'pid'
            ? getPidSystemPrompt(languageCode, languageName)
            : getBpmnSystemPrompt(languageCode, languageName, false, true);

        const modelSelection = selectModel({ promptLength: typedJob.prompt.length, diagramType: typedJob.diagram_type });
        const startTime = Date.now();

        try {
            const bpmnXml = await retryBpmnGeneration(
                typedJob.prompt, systemPrompt, typedJob.diagram_type,
                languageCode, languageName, GOOGLE_API_KEY,
                modelSelection.maxTokens, modelSelection.temperature, 3
            );

            const generationTime = Date.now() - startTime;
            console.log(`[Job ${jobId}] BPMN generated in ${generationTime}ms`);

            if (logId) await logGenerationSuccess({ supabase, logId, resultXml: bpmnXml, durationMs: generationTime, cacheHit: false });
            storeCacheAsync({ prompt: typedJob.prompt, bpmnXml, diagramType: typedJob.diagram_type, supabase, googleApiKey: GOOGLE_API_KEY });

            await supabase.from('vision_bpmn_jobs').update({ status: 'completed', bpmn_xml: bpmnXml, model_used: 'gemini-2.5-pro', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);

            return new Response(JSON.stringify({ success: true, jobId, generationTimeMs: generationTime }), { status: 200, headers: corsHeaders });
        } catch (generationError) {
            console.error(`[Job ${jobId}] Generation failed:`, generationError);
            const errorMessage = generationError instanceof Error ? generationError.message : "Unknown error";
            if (logId) await logGenerationError({ supabase, logId, errorMessage, durationMs: Date.now() - startTime });
            await supabase.from('vision_bpmn_jobs').update({ status: 'failed', error_message: errorMessage, updated_at: new Date().toISOString() }).eq('id', jobId);
            return new Response(JSON.stringify({ error: errorMessage, jobId }), { status: 500, headers: corsHeaders });
        }
    } catch (error) {
        console.error('[process-bpmn-job] Error:', error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: corsHeaders });
    }
});
