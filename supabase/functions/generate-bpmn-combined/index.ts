import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectLanguage, getLanguageName } from "../_shared/language-detection.ts";
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from "../_shared/prompts.ts";
import { checkCache, storeCacheAsync } from "../_shared/semantic-cache.ts";
import { logGenerationRequest, logGenerationSuccess, logGenerationError } from "../_shared/dashboard-logger.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CombinedGenerationRequest {
    subPrompts: string[];
    diagramType: "bpmn" | "pid";
    userId: string;
    originalPrompt: string;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { subPrompts, diagramType, userId, originalPrompt }: CombinedGenerationRequest = await req.json();

        if (!subPrompts || !Array.isArray(subPrompts) || subPrompts.length === 0) {
            throw new Error("Sub-prompts array is required");
        }

        if (!userId) {
            throw new Error("User ID is required");
        }

        const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
        if (!GOOGLE_API_KEY) {
            throw new Error("Google API key not configured");
        }

        // Create Supabase client for caching
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        let supabase = null;
        if (supabaseUrl && supabaseKey) {
            supabase = createClient(supabaseUrl, supabaseKey);
            console.log('[Combined Generation] Cache enabled');
        } else {
            console.warn('[Combined Generation] Cache disabled (missing Supabase config)');
        }

        console.log(`[Combined Generation] Starting for ${subPrompts.length} sub-prompts`);

        // Get user ID from authorization header
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        let actualUserId: string | undefined;
        if (supabase && token) {
            try {
                const { data: { user } } = await supabase.auth.getUser(token);
                actualUserId = user?.id;
            } catch (error) {
                console.warn('[Combined] Failed to get user from token:', error);
            }
        }
        const finalUserId = actualUserId || userId;

        // Log parent generation request
        let parentLogId: string | null = null;
        if (supabase && finalUserId) {
            parentLogId = await logGenerationRequest({
                supabase,
                userId: finalUserId,
                prompt: originalPrompt,
                diagramType,
                detectedLanguage: detectLanguage(originalPrompt),
                sourceFunction: 'generate-bpmn-combined',
                isMultiDiagram: true,
                subPromptCount: subPrompts.length,
            });
        }

        const startTime = Date.now();

        // Generate all sub-diagrams in parallel
        const subDiagramPromises = subPrompts.map(async (subPrompt, index) => {
            console.log(`[Combined] Generating sub-diagram ${index + 1}/${subPrompts.length}`);

            try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error("Sub-diagram generation timeout")), 45000);
                });

                const generationPromise = generateSingleDiagram(
                    subPrompt,
                    diagramType,
                    GOOGLE_API_KEY,
                    supabase
                );
                const result = await Promise.race([generationPromise, timeoutPromise]);

                console.log(`[Combined] Sub-diagram ${index + 1} completed (${result.length} chars)`);
                return { xml: result, prompt: subPrompt, index };
            } catch (error) {
                console.error(`[Combined] Sub-diagram ${index + 1} failed:`, error);
                return { xml: createPlaceholderDiagram(subPrompt, index + 1, diagramType), prompt: subPrompt, index };
            }
        });

        // Wait for all sub-diagrams
        const overallTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Overall generation timeout")), 120000);
        });

        let subDiagramResults: Array<{ xml: string; prompt: string; index: number }>;
        try {
            subDiagramResults = await Promise.race([Promise.all(subDiagramPromises), overallTimeout]);
        } catch (error) {
            console.error("[Combined] Overall timeout or failure:", error);
            throw new Error("Failed to generate sub-diagrams within time limit");
        }

        console.log(`[Combined] All ${subDiagramResults.length} sub-diagrams generated successfully`);

        // Return individual diagrams for detailed viewing
        const diagrams = subDiagramResults.map((result, index) => ({
            id: `diagram_${index + 1}`,
            title: result.prompt.substring(0, 80) + (result.prompt.length > 80 ? '...' : ''),
            xml: result.xml,
            prompt: result.prompt,
            index: index + 1,
        }));

        // Also generate a mega-diagram with all details flattened into one view
        const combinedXml = createMegaDiagram(subDiagramResults, originalPrompt);

        console.log(`[Combined] Success! Returning ${diagrams.length} individual diagrams + mega-diagram`);

        // Log successful generation
        if (supabase && parentLogId) {
            await logGenerationSuccess({
                supabase,
                logId: parentLogId,
                resultXml: combinedXml,
                durationMs: Date.now() - startTime,
                cacheHit: false,
            });
        }

        return new Response(
            JSON.stringify({
                diagrams,
                combinedXml,
                diagramCount: diagrams.length,
                originalPrompt,
                message: `Successfully generated ${diagrams.length} diagrams + combined overview`,
                type: 'multi-diagram',
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (error) {
        console.error("[Combined Generation] Error:", error);
        const errorMessage = (error as Error).message || "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});

async function generateSingleDiagram(
    prompt: string,
    diagramType: "bpmn" | "pid",
    googleApiKey: string,
    supabase: any = null,
): Promise<string> {
    // Check cache first (if Supabase is available)
    if (supabase) {
        try {
            const cachedResult = await checkCache({
                prompt,
                diagramType,
                supabase,
                googleApiKey,
            });

            if (cachedResult) {
                console.log(`[Single Diagram] Cache hit! Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%`);
                return cachedResult.bpmn_xml;
            }

            console.log(`[Single Diagram] Cache miss, proceeding with generation`);
        } catch (cacheError) {
            console.warn('[Single Diagram] Cache check failed:', cacheError);
        }
    }

    // Detect language from the prompt
    const detectedLanguageCode = detectLanguage(prompt);
    const detectedLanguageName = getLanguageName(detectedLanguageCode);

    console.log(`[Single Diagram] Detected language: ${detectedLanguageName} (${detectedLanguageCode})`);

    // Get language-aware system prompt
    const systemPrompt = diagramType === 'bpmn'
        ? getBpmnSystemPrompt(detectedLanguageCode, detectedLanguageName, false, true)
        : getPidSystemPrompt(detectedLanguageCode, detectedLanguageName);

    // Build the user prompt with language instruction
    const languageInstruction = detectedLanguageCode !== 'en'
        ? `\n\n⚠️ CRITICAL: Generate ALL labels and text in ${detectedLanguageName} (${detectedLanguageCode}). DO NOT use English.`
        : '';

    const userPrompt = `Generate a ${diagramType.toUpperCase()} diagram for:\n${prompt}\n\nREQUIREMENTS:\n1. Include complete BPMN 2.0 XML structure\n2. Include diagram interchange (bpmndi:BPMNDiagram) with coordinates\n3. Use descriptive task names based on the prompt\n4. Return ONLY the XML, no markdown formatting${languageInstruction}`;

    // Build messages with few-shot examples
    const messages = buildMessagesWithExamples(systemPrompt, userPrompt, diagramType, detectedLanguageCode, detectedLanguageName);

    // Convert messages to Gemini format
    const contents = messages
        .filter((msg: any) => msg.role !== 'system')
        .map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

    const systemInstruction = messages.find((msg: any) => msg.role === 'system')?.content || systemPrompt;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                generationConfig: {
                    maxOutputTokens: 8192,
                    temperature: 0.3,
                },
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    let xml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!xml) {
        throw new Error("No content generated from Gemini");
    }

    // Clean markdown formatting
    xml = xml.replace(/```xml\n?/g, "").replace(/```\n?/g, "").trim();

    if (!xml.includes("<?xml")) {
        throw new Error("Invalid BPMN XML generated");
    }

    // Store in cache asynchronously
    if (supabase) {
        storeCacheAsync({
            prompt,
            bpmnXml: xml,
            diagramType,
            supabase,
            googleApiKey,
        });
    }

    return xml;
}

function createPlaceholderDiagram(prompt: string, index: number, diagramType: string): string {
    const timestamp = Date.now();
    const processId = `Process_${index}_${timestamp}`;
    const taskId = `Task_${index}_${timestamp}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_${index}">
  <bpmn:process id="${processId}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_${index}" name="Start"/>
    <bpmn:task id="${taskId}" name="${prompt.substring(0, 60)}"/>
    <bpmn:endEvent id="EndEvent_${index}" name="End"/>
    <bpmn:sequenceFlow id="Flow_${index}_1" sourceRef="StartEvent_${index}" targetRef="${taskId}"/>
    <bpmn:sequenceFlow id="Flow_${index}_2" sourceRef="${taskId}" targetRef="EndEvent_${index}"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_${index}">
    <bpmndi:BPMNPlane id="Plane_${index}" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="Shape_Start_${index}" bpmnElement="StartEvent_${index}">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_${index}" bpmnElement="${taskId}">
        <dc:Bounds x="200" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_${index}" bpmnElement="EndEvent_${index}">
        <dc:Bounds x="360" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow1_${index}" bpmnElement="Flow_${index}_1">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="200" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow2_${index}" bpmnElement="Flow_${index}_2">
        <di:waypoint x="300" y="120"/>
        <di:waypoint x="360" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function createMegaDiagram(
    subDiagramResults: Array<{ xml: string; prompt: string; index: number }>,
    originalPrompt: string
): string {
    const timestamp = Date.now();
    const mainProcessId = `Process_Main_${timestamp}`;

    // Build subprocess content from each sub-diagram
    let processContent = '';
    let diContent = '';
    let offsetY = 100;
    const spacing = 200;

    subDiagramResults.forEach((result, index) => {
        const { processXml, diXml } = extractAndTransformSubProcess(result.xml, index, 100, offsetY, timestamp);
        processContent += processXml;
        diContent += diXml;
        offsetY += spacing;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_Combined_${timestamp}">
  <bpmn:process id="${mainProcessId}" isExecutable="false" name="${originalPrompt.substring(0, 80)}">
${processContent}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_Combined_${timestamp}">
    <bpmndi:BPMNPlane id="Plane_Combined_${timestamp}" bpmnElement="${mainProcessId}">
${diContent}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function extractAndTransformSubProcess(
    xml: string,
    index: number,
    offsetX: number,
    offsetY: number,
    timestamp: number
): { processXml: string; diXml: string } {
    // Extract process content
    const processMatch = xml.match(/<bpmn:process[^>]*>([\s\S]*?)<\/bpmn:process>/);
    let processContent = processMatch ? processMatch[1] : '';

    // Extract DI content
    const diMatch = xml.match(/<bpmndi:BPMNPlane[^>]*>([\s\S]*?)<\/bpmndi:BPMNPlane>/);
    let diContent = diMatch ? diMatch[1] : '';

    if (!processContent || !diContent) {
        // Fallback: create simple content
        const subId = `sub${index}_${timestamp}`;
        processContent = `    <bpmn:startEvent id="Start_${subId}" name="Start"/>
    <bpmn:task id="Task_${subId}" name="Sub-process ${index + 1}"/>
    <bpmn:endEvent id="End_${subId}" name="End"/>
    <bpmn:sequenceFlow id="Flow1_${subId}" sourceRef="Start_${subId}" targetRef="Task_${subId}"/>
    <bpmn:sequenceFlow id="Flow2_${subId}" sourceRef="Task_${subId}" targetRef="End_${subId}"/>`;

        diContent = `      <bpmndi:BPMNShape id="Shape_Start_${subId}" bpmnElement="Start_${subId}">
        <dc:Bounds x="${offsetX + 20}" y="${offsetY + 40}" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_${subId}" bpmnElement="Task_${subId}">
        <dc:Bounds x="${offsetX + 120}" y="${offsetY + 20}" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_${subId}" bpmnElement="End_${subId}">
        <dc:Bounds x="${offsetX + 280}" y="${offsetY + 40}" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow1_${subId}" bpmnElement="Flow1_${subId}">
        <di:waypoint x="${offsetX + 56}" y="${offsetY + 58}"/>
        <di:waypoint x="${offsetX + 120}" y="${offsetY + 60}"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow2_${subId}" bpmnElement="Flow2_${subId}">
        <di:waypoint x="${offsetX + 220}" y="${offsetY + 60}"/>
        <di:waypoint x="${offsetX + 280}" y="${offsetY + 58}"/>
      </bpmndi:BPMNEdge>`;

        return { processXml: processContent, diXml: diContent };
    }

    // Make IDs unique
    const idSuffix = `_sub${index}_${timestamp}`;
    processContent = processContent.replace(/id="([^"]+)"/g, `id="$1${idSuffix}"`);
    processContent = processContent.replace(/sourceRef="([^"]+)"/g, `sourceRef="$1${idSuffix}"`);
    processContent = processContent.replace(/targetRef="([^"]+)"/g, `targetRef="$1${idSuffix}"`);

    diContent = diContent.replace(/id="([^"]+)"/g, `id="$1${idSuffix}"`);
    diContent = diContent.replace(/bpmnElement="([^"]+)"/g, `bpmnElement="$1${idSuffix}"`);

    // Offset coordinates
    diContent = diContent.replace(/x="(\d+(?:\.\d+)?)"/g, (_match, x) => {
        return `x="${Math.round(parseFloat(x) + offsetX)}"`;
    });

    diContent = diContent.replace(/y="(\d+(?:\.\d+)?)"/g, (_match, y) => {
        return `y="${Math.round(parseFloat(y) + offsetY)}"`;
    });

    return { processXml: processContent, diXml: diContent };
}
