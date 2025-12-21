import { serve } from '../shared/aws-shim.ts';

import { createClient } from "@supabase/supabase-js";
import { detectLanguage, getLanguageName } from "../shared/language-detection.ts";
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from "../shared/prompts.ts";
import { checkCache, storeCacheAsync } from "../shared/semantic-cache.ts";
import { logGenerationRequest, logGenerationSuccess, logGenerationError } from "../shared/dashboard-logger.ts";

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

export const handler = serve(async (req) => {
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

    const GOOGLE_API_KEY = process.env["GOOGLE_API_KEY"];
    if (!GOOGLE_API_KEY) {
      throw new Error("Google API key not configured");
    }

    // Create Supabase client for caching
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

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
    // Fallback to userId from request if token extraction failed
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
        combinedXml, // Combined overview with expandable subprocesses
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
    // Note: Error logging to bpmn_generation_logs happens within the try block where we have access to logId
    // Errors caught here are already visible in function logs
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
  supabase: any = null, // SupabaseClient or null
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
        console.log(`[Single Diagram] 🎯 Cache hit! Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%, skipping generation`);
        return cachedResult.bpmn_xml;
      }

      console.log(`[Single Diagram] Cache miss, proceeding with generation`);
    } catch (cacheError) {
      console.warn('[Single Diagram] Cache check failed, proceeding with generation:', cacheError);
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
    .filter(msg => msg.role !== 'system') // Gemini doesn't use system role in contents
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

  // Add system instruction separately
  const systemInstruction = messages.find(msg => msg.role === 'system')?.content || systemPrompt;

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

  console.log(`[Combined Generation] Starting for ${subPrompts.length} sub-prompts`);

  // Get user ID from authorization header
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  let actualUserId: string | undefined;
  if (supabase && token) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      actualUserId = user?.id;
    } catch (error) {
      console.warn("[Combined] Failed to get user from token:", error);
    }
  }
  // Fallback to userId from request if token extraction failed
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
      sourceFunction: "generate-bpmn-combined",
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

      const generationPromise = generateSingleDiagram(subPrompt, diagramType, GOOGLE_API_KEY, supabase);
      const result = await Promise.race([generationPromise, timeoutPromise]);

      if (!xml.includes("<?xml")) {
        throw new Error("Invalid BPMN XML generated");
      }

      console.log(`[Combined] All ${subDiagramResults.length} sub-diagrams generated successfully`);

      // Return individual diagrams for detailed viewing
      const diagrams = subDiagramResults.map((result, index) => ({
        id: `diagram_${index + 1}`,
        title: result.prompt.substring(0, 80) + (result.prompt.length > 80 ? "..." : ""),
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
          combinedXml, // Combined overview with expandable subprocesses
          diagramCount: diagrams.length,
          originalPrompt,
          message: `Successfully generated ${diagrams.length} diagrams + combined overview`,
          type: "multi-diagram",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("[Combined Generation] Error:", error);
      const errorMessage = (error as Error).message || "Unknown error";
      // Note: Error logging to bpmn_generation_logs happens within the try block where we have access to logId
      // Errors caught here are already visible in function logs
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
    supabase: any = null, // SupabaseClient or null
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
          console.log(
            `[Single Diagram] 🎯 Cache hit! Similarity: ${(cachedResult.similarity * 100).toFixed(1)}%, skipping generation`,
          );
          return cachedResult.bpmn_xml;
        }

        console.log(`[Single Diagram] Cache miss, proceeding with generation`);
      } catch (cacheError) {
        console.warn("[Single Diagram] Cache check failed, proceeding with generation:", cacheError);
      }

      return xml;
    }

    function createPlaceholderDiagram(prompt: string, index: number, diagramType: string): string {
      const processId = `Process_${index}_${Date.now()}`;
      const taskId = `Task_${index}_${Date.now()}`;

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
      <bpmndi:BPMNEdge id="Edge_Flow_${index}_1" bpmnElement="Flow_${index}_1">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="200" y="120"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow_${index}_2" bpmnElement="Flow_${index}_2">
        <di:waypoint x="300" y="120"/>
        <di:waypoint x="360" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    }

    /**
     * Creates a mega-diagram by merging all sub-diagrams into a flat view (no lanes)
     * All tasks, events, and flows are visible - stacked vertically
     */
    function createMegaDiagram(
      subDiagramResults: Array<{ xml: string; prompt: string; index: number }>,
      originalPrompt: string,
    ): string {
      const timestamp = Date.now();

      let allFlowNodes = "";
      let allDIContent = "";
      let currentYOffset = 100;
      const sectionSpacing = 100;

      subDiagramResults.forEach((result, index) => {
        console.log(`[Mega-Diagram] Processing diagram ${index + 1}/${subDiagramResults.length}`);

        const idSuffix = `_d${index}_${timestamp}`;

        // Extract process content (everything inside <process>) WITHOUT laneSets
        let processMatch = result.xml.match(/<process[^>]*>([\s\S]*?)<\/process>/);
        if (!processMatch) {
          processMatch = result.xml.match(/<bpmn:process[^>]*>([\s\S]*?)<\/bpmn:process>/);
        }

        if (!processMatch) {
          console.warn(`[Mega-Diagram] No process content found in diagram ${index}`);
          return;
        }

        let processContent = processMatch[1];

        // Remove laneSet completely (we're creating a flat diagram)
        processContent = processContent.replace(/<laneSet[^>]*>[\s\S]*?<\/laneSet>/g, '');

        // Make all IDs unique
        processContent = processContent.replace(/id="([^"]+)"/g, `id="$1${idSuffix}"`);
        processContent = processContent.replace(/sourceRef="([^"]+)"/g, `sourceRef="$1${idSuffix}"`);
        processContent = processContent.replace(/targetRef="([^"]+)"/g, `targetRef="$1${idSuffix}"`);
        processContent = processContent.replace(/attachedToRef="([^"]+)"/g, `attachedToRef="$1${idSuffix}"`);
        processContent = processContent.replace(/<incoming>([^<]+)<\/incoming>/g, (match, ref) => `<incoming>${ref}${idSuffix}</incoming>`);
        processContent = processContent.replace(/<outgoing>([^<]+)<\/outgoing>/g, (match, ref) => `<outgoing>${ref}${idSuffix}</outgoing>`);
        processContent = processContent.replace(/bpmnElement="([^"]+)"/g, `bpmnElement="$1${idSuffix}"`);

        allFlowNodes += processContent + "\n";

        // Extract DI content
        let diPlaneMatch = result.xml.match(/<bpmndi:BPMNPlane[^>]*>([\s\S]*?)<\/bpmndi:BPMNPlane>/);
        if (!diPlaneMatch) {
          diPlaneMatch = result.xml.match(/<BPMNPlane[^>]*>([\s\S]*?)<\/BPMNPlane>/);
        }

        if (!diPlaneMatch) {
          console.warn(`[Mega-Diagram] No DI content found in diagram ${index}`);
          return;
        }

        let diContent = diPlaneMatch[1];

        // Remove lane shapes from DI (we don't need them)
        diContent = diContent.replace(/<bpmndi:BPMNShape[^>]*bpmnElement="[^"]*Lane[^"]*"[^>]*>[\s\S]*?<\/bpmndi:BPMNShape>/g, '');

        // Make DI IDs unique
        diContent = diContent.replace(/id="([^"]+)"/g, `id="$1${idSuffix}"`);
        diContent = diContent.replace(/bpmnElement="([^"]+)"/g, `bpmnElement="$1${idSuffix}"`);

        // Find max Y coordinate for height calculation
        const yCoords: number[] = [];
        diContent.replace(/y="(\d+)"/g, (match, y) => {
          yCoords.push(parseInt(y));
          return match;
        });

        const maxY = Math.max(...yCoords, 0);
        const diagramHeight = maxY + 200;

        // Adjust Y coordinates
        diContent = diContent.replace(/y="(\d+)"/g, (match, y) => {
          const newY = parseInt(y) + currentYOffset;
          return `y="${newY}"`;
        });

        allDIContent += `\n      <!-- Diagram ${index + 1}: ${result.prompt.substring(0, 60)}... -->\n`;
        allDIContent += diContent + "\n";

        currentYOffset += diagramHeight + sectionSpacing;
      });

      // Build complete BPMN XML without lanes
      return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   id="Definitions_Mega_${timestamp}"
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Mega_${timestamp}" isExecutable="false" name="${originalPrompt.substring(0, 100)}">
${allFlowNodes}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_Mega_${timestamp}">
    <bpmndi:BPMNPlane id="BPMNPlane_Mega_${timestamp}" bpmnElement="Process_Mega_${timestamp}">
${allDIContent}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    }

    function intelligentMergeDiagrams(
      subDiagramResults: Array<{ xml: string; prompt: string; index: number }>,
      originalPrompt: string,
    ): string {
      const timestamp = Date.now();
      let subProcesses = "";
      let subProcessShapes = "";
      let subProcessDI = ""; // DI for elements inside subprocesses
      let flows = "";
      let edges = "";

      const startX = 100;
      const startY = 200;
      const subProcessWidth = 600;
      const subProcessHeight = 400;
      const verticalSpacing = 450;
      const eventSize = 36;

      subDiagramResults.forEach((result, index) => {
        const subProcessId = `SubProcess_${index}_${timestamp}`;
        const currentY = startY + index * verticalSpacing;

        // Extract both process content and DI information
        const extracted = extractProcessAndDI(result.xml, index, timestamp, startX + 170, currentY + 20);

        subProcesses += `    <bpmn:subProcess id="${subProcessId}" name="${result.prompt.substring(0, 80)}">
${extracted.processContent}
    </bpmn:subProcess>\n`;

        // Add subprocess shape (collapsed initially, but can be expanded)
        subProcessShapes += `      <bpmndi:BPMNShape id="Shape_${subProcessId}" bpmnElement="${subProcessId}" isExpanded="true">
        <dc:Bounds x="${startX + 150}" y="${currentY}" width="${subProcessWidth}" height="${subProcessHeight}"/>
      </bpmndi:BPMNShape>\n`;

        // Add DI for elements inside the subprocess
        subProcessDI += extracted.diContent;

        // Add flows between subprocesses
        if (index === 0) {
          const flowId = `Flow_start_${timestamp}`;
          flows += `    <bpmn:sequenceFlow id="${flowId}" sourceRef="StartEvent_${timestamp}" targetRef="${subProcessId}"/>\n`;

          edges += `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
        <di:waypoint x="${startX + eventSize}" y="${startY + subProcessHeight / 2}"/>
        <di:waypoint x="${startX + 150}" y="${currentY + subProcessHeight / 2}"/>
      </bpmndi:BPMNEdge>\n`;
        } else {
          const prevSubProcessId = `SubProcess_${index - 1}_${timestamp}`;
          const flowId = `Flow_${index}_${timestamp}`;
          const prevY = startY + (index - 1) * verticalSpacing;

          flows += `    <bpmn:sequenceFlow id="${flowId}" sourceRef="${prevSubProcessId}" targetRef="${subProcessId}"/>\n`;

          edges += `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
        <di:waypoint x="${startX + 150 + subProcessWidth / 2}" y="${prevY + subProcessHeight}"/>
        <di:waypoint x="${startX + 150 + subProcessWidth / 2}" y="${currentY}"/>
      </bpmndi:BPMNEdge>\n`;
        }

        if (index === subDiagramResults.length - 1) {
          const flowId = `Flow_end_${timestamp}`;
          const endY = currentY + subProcessHeight + 100;

          flows += `    <bpmn:sequenceFlow id="${flowId}" sourceRef="${subProcessId}" targetRef="EndEvent_${timestamp}"/>\n`;

          edges += `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
        <di:waypoint x="${startX + 150 + subProcessWidth / 2}" y="${currentY + subProcessHeight}"/>
        <di:waypoint x="${startX + 150 + subProcessWidth / 2}" y="${endY}"/>
      </bpmndi:BPMNEdge>\n`;
        }
      });

      const endY = startY + subDiagramResults.length * verticalSpacing;

      return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_Combined_${timestamp}"
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Combined_${timestamp}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_${timestamp}" name="Start: ${originalPrompt.substring(0, 40)}..."/>
${subProcesses}
    <bpmn:endEvent id="EndEvent_${timestamp}" name="End"/>
${flows}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${timestamp}">
    <bpmndi:BPMNPlane id="BPMNPlane_${timestamp}" bpmnElement="Process_Combined_${timestamp}">
      <bpmndi:BPMNShape id="Shape_StartEvent_${timestamp}" bpmnElement="StartEvent_${timestamp}">
        <dc:Bounds x="${startX}" y="${startY + subProcessHeight / 2 - eventSize / 2}" width="${eventSize}" height="${eventSize}"/>
      </bpmndi:BPMNShape>
${subProcessShapes}

      <!-- Nested BPMNPlanes for subprocess internals -->
${subDiagramResults.map((result, idx) => {
        const spId = `SubProcess_${idx}_${timestamp}`;
        return `      <!-- BPMNPlane for ${spId} -->`;
      }).filter(Boolean).join('\n')}

${subProcessDI}
      <bpmndi:BPMNShape id="Shape_EndEvent_${timestamp}" bpmnElement="EndEvent_${timestamp}">
        <dc:Bounds x="${startX + 150 + subProcessWidth / 2 - eventSize / 2}" y="${endY}" width="${eventSize}" height="${eventSize}"/>
      </bpmndi:BPMNShape>
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
    }

    function extractProcessAndDI(
      xml: string,
      index: number,
      timestamp: number,
      offsetX: number,
      offsetY: number
    ): { processContent: string; diContent: string } {
      console.log(`[Extract] Processing sub-diagram ${index}, XML length: ${xml.length}`);

      // Extract process content - try multiple namespace variations
      let processMatch = xml.match(/<bpmn:process[^>]*>([\s\S]*?)<\/bpmn:process>/);
      if (!processMatch) {
        processMatch = xml.match(/<bpmn2:process[^>]*>([\s\S]*?)<\/bpmn2:process>/);
      }
      if (!processMatch) {
        processMatch = xml.match(/<process[^>]*>([\s\S]*?)<\/process>/);
      }

      // Extract DI content (shapes and edges) - try multiple namespace variations
      let diPlaneMatch = xml.match(/<bpmndi:BPMNPlane[^>]*>([\s\S]*?)<\/bpmndi:BPMNPlane>/);
      if (!diPlaneMatch) {
        diPlaneMatch = xml.match(/<BPMNPlane[^>]*>([\s\S]*?)<\/BPMNPlane>/);
      }

      let processContent = "";
      let diContent = "";

      if (processMatch && processMatch[1]) {
        console.log(`[Extract] Found process content for sub-diagram ${index}, length: ${processMatch[1].length}`);
        // Make IDs unique by adding suffix
        processContent = processMatch[1];
        processContent = processContent.replace(/id="([^"]+)"/g, `id="$1_sub${index}_${timestamp}"`);
        processContent = processContent.replace(/sourceRef="([^"]+)"/g, `sourceRef="$1_sub${index}_${timestamp}"`);
        processContent = processContent.replace(/targetRef="([^"]+)"/g, `targetRef="$1_sub${index}_${timestamp}"`);
      } else {
        console.warn(`[Extract] No process content found for sub-diagram ${index}, using fallback. XML preview: ${xml.substring(0, 200)}`);
        // Fallback: create simple content
        processContent = `      <bpmn:startEvent id="Start_sub${index}_${timestamp}" name="Start"/>
      <bpmn:task id="Task_sub${index}_${timestamp}" name="Process Step ${index + 1}"/>
      <bpmn:endEvent id="End_sub${index}_${timestamp}" name="End"/>
      <bpmn:sequenceFlow id="Flow1_sub${index}_${timestamp}" sourceRef="Start_sub${index}_${timestamp}" targetRef="Task_sub${index}_${timestamp}"/>
      <bpmn:sequenceFlow id="Flow2_sub${index}_${timestamp}" sourceRef="Task_sub${index}_${timestamp}" targetRef="End_sub${index}_${timestamp}"/>`;
      }

      if (diPlaneMatch && diPlaneMatch[1]) {
        // Extract and adjust DI information
        diContent = diPlaneMatch[1];

        // Make IDs unique
        diContent = diContent.replace(/id="([^"]+)"/g, `id="$1_sub${index}_${timestamp}"`);
        diContent = diContent.replace(/bpmnElement="([^"]+)"/g, `bpmnElement="$1_sub${index}_${timestamp}"`);

        // Find min x and y coordinates to normalize
        const xCoords: number[] = [];
        const yCoords: number[] = [];

        diContent.replace(/x="(\d+)"/g, (match, x) => {
          xCoords.push(parseInt(x));
          return match;
        });

        diContent.replace(/y="(\d+)"/g, (match, y) => {
          yCoords.push(parseInt(y));
          return match;
        });

        const minX = Math.min(...xCoords, 0);
        const minY = Math.min(...yCoords, 0);

        // Normalize coordinates (subtract min) then add offset
        diContent = diContent.replace(/x="(\d+)"/g, (match, x) => {
          const normalized = parseInt(x) - minX;
          return `x="${normalized + offsetX}"`;
        });

        diContent = diContent.replace(/y="(\d+)"/g, (match, y) => {
          const normalized = parseInt(y) - minY;
          return `y="${normalized + offsetY}"`;
        });
      } else {
        // Fallback: create simple DI
        diContent = `      <bpmndi:BPMNShape id="Shape_Start_sub${index}_${timestamp}" bpmnElement="Start_sub${index}_${timestamp}">
        <dc:Bounds x="${offsetX + 20}" y="${offsetY + 40}" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_sub${index}_${timestamp}" bpmnElement="Task_sub${index}_${timestamp}">
        <dc:Bounds x="${offsetX + 120}" y="${offsetY + 20}" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_End_sub${index}_${timestamp}" bpmnElement="End_sub${index}_${timestamp}">
        <dc:Bounds x="${offsetX + 280}" y="${offsetY + 40}" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow1_sub${index}_${timestamp}" bpmnElement="Flow1_sub${index}_${timestamp}">
        <di:waypoint x="${offsetX + 56}" y="${offsetY + 58}"/>
        <di:waypoint x="${offsetX + 120}" y="${offsetY + 60}"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Flow2_sub${index}_${timestamp}" bpmnElement="Flow2_sub${index}_${timestamp}">
        <di:waypoint x="${offsetX + 220}" y="${offsetY + 60}"/>
        <di:waypoint x="${offsetX + 280}" y="${offsetY + 58}"/>
      </bpmndi:BPMNEdge>`;
      }

      return { processContent, diContent };
    }