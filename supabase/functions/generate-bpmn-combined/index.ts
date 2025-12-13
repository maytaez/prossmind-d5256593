import "https://deno.land/x/xhr@0.1.0/mod.ts";
import {
  BPMNProcess,
  BPMNElement,
  BPMNSequenceFlow,
  createSubprocess,
  createStartEvent,
  createEndEvent,
  createSequenceFlow,
  createProcess,
  createDefinitions,
} from "../_shared/bpmn-json-schema.ts";
import { convertBpmnJsonToXml } from "../_shared/bpmn-json-to-xml.ts";

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

interface SubDiagramResult {
  process: BPMNProcess | null;
  prompt: string;
  index: number;
  error?: string;
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

    console.log(`[Combined Generation - JSON Hybrid] Starting for ${subPrompts.length} sub-prompts`);

    // Generate all sub-diagrams in parallel using JSON format
    const subDiagramPromises = subPrompts.map(async (subPrompt, index) => {
      console.log(`[Combined] Generating JSON for sub-diagram ${index + 1}/${subPrompts.length}`);

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Sub-diagram generation timeout")), 45000);
        });

        const generationPromise = generateSingleDiagramAsJSON(subPrompt, diagramType, GOOGLE_API_KEY);
        const result = await Promise.race([generationPromise, timeoutPromise]);

        console.log(`[Combined] Sub-diagram ${index + 1} JSON completed`);
        return { process: result, prompt: subPrompt, index };
      } catch (error) {
        console.error(`[Combined] Sub-diagram ${index + 1} failed:`, error);
        return {
          process: createFallbackProcess(subPrompt, index),
          prompt: subPrompt,
          index,
          error: (error as Error).message,
        };
      }
    });

    // Wait for all sub-diagrams
    const overallTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Overall generation timeout")), 120000);
    });

    let subDiagramResults: SubDiagramResult[];
    try {
      subDiagramResults = await Promise.race([Promise.all(subDiagramPromises), overallTimeout]);
    } catch (error) {
      console.error("[Combined] Overall timeout or failure:", error);
      throw new Error("Failed to generate sub-diagrams within time limit");
    }

    console.log(`[Combined] All ${subDiagramResults.length} sub-diagrams generated, combining...`);

    // Combine JSON structures (much easier than XML!)
    const combinedProcess = combineProcesses(subDiagramResults, originalPrompt);

    // Convert to XML once at the end with automatic layout
    console.log("[Combined] Converting combined JSON to XML with auto-layout...");
    const definitions = createDefinitions(`Definitions_Combined_${Date.now()}`, [combinedProcess], originalPrompt);

    const combinedBpmn = convertBpmnJsonToXml(definitions);

    console.log(`[Combined] Success! Combined diagram: ${combinedBpmn.length} chars`);

    return new Response(
      JSON.stringify({
        bpmnXml: combinedBpmn,
        subDiagramCount: subDiagramResults.length,
        message: `Successfully combined ${subDiagramResults.length} sub-diagrams using JSON hybrid approach`,
        approach: "json-hybrid",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[Combined Generation] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Generate a single diagram as JSON structure (more compact, easier for AI)
 */
async function generateSingleDiagramAsJSON(
  prompt: string,
  diagramType: "bpmn" | "pid",
  googleApiKey: string,
): Promise<BPMNProcess> {
  const systemPrompt = `You are a BPMN 2.0 expert. Generate a BPMN process as a JSON structure.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "id": "process_id",
  "name": "Process Name",
  "elements": [
    {"id": "start1", "type": "startEvent", "name": "Start"},
    {"id": "task1", "type": "task", "name": "Task Description"},
    {"id": "end1", "type": "endEvent", "name": "End"}
  ],
  "flows": [
    {"id": "flow1", "sourceRef": "start1", "targetRef": "task1"},
    {"id": "flow2", "sourceRef": "task1", "targetRef": "end1"}
  ]
}

Valid element types: startEvent, endEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, subprocess
For subprocess, include nested "elements" and "flows" arrays.`;

  const userPrompt = `Generate a ${diagramType.toUpperCase()} process for:
${prompt}

Requirements:
- Use descriptive names
- Include all necessary elements and flows
- Ensure all flow references are valid
- Return ONLY the JSON structure`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        generationConfig: {
          maxOutputTokens: 4096, // JSON is more compact than XML
          temperature: 0.3,
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
      throw new Error("Invalid JSON structure: missing required fields");
    }

    return processData as BPMNProcess;
  } catch (error) {
    console.error("[JSON Parse Error]", error);
    console.error("[JSON Text]", jsonText.substring(0, 500));
    throw new Error(`Failed to parse JSON response: ${(error as Error).message}`);
  }
}

/**
 * Create a fallback process when generation fails
 */
function createFallbackProcess(prompt: string, index: number): BPMNProcess {
  const timestamp = Date.now();
  const processId = `Process_Fallback_${index}_${timestamp}`;

  const elements: BPMNElement[] = [
    createStartEvent(`Start_${index}_${timestamp}`, "Start"),
    {
      id: `Task_${index}_${timestamp}`,
      type: "task",
      name: prompt.substring(0, 60) || `Process Step ${index + 1}`,
    },
    createEndEvent(`End_${index}_${timestamp}`, "End"),
  ];

  const flows: BPMNSequenceFlow[] = [
    createSequenceFlow(`Flow1_${index}_${timestamp}`, `Start_${index}_${timestamp}`, `Task_${index}_${timestamp}`),
    createSequenceFlow(`Flow2_${index}_${timestamp}`, `Task_${index}_${timestamp}`, `End_${index}_${timestamp}`),
  ];

  return createProcess(processId, `Fallback Process ${index + 1}`, elements, flows);
}

/**
 * Combine multiple processes into a single process with subprocesses
 * This is MUCH easier with JSON than with XML string manipulation!
 */
function combineProcesses(subDiagramResults: SubDiagramResult[], originalPrompt: string): BPMNProcess {
  const timestamp = Date.now();
  const combinedProcessId = `Process_Combined_${timestamp}`;

  const elements: BPMNElement[] = [];
  const flows: BPMNSequenceFlow[] = [];

  // Add start event
  const startEventId = `StartEvent_${timestamp}`;
  elements.push(createStartEvent(startEventId, `Start: ${originalPrompt.substring(0, 40)}...`));

  // Convert each sub-process into a subprocess element
  const subprocessIds: string[] = [];

  subDiagramResults.forEach((result, index) => {
    if (!result.process) {
      console.warn(`[Combine] Skipping null process at index ${index}`);
      return;
    }

    const subprocessId = `SubProcess_${index}_${timestamp}`;
    subprocessIds.push(subprocessId);

    // Create subprocess element containing the sub-process elements and flows
    const subprocess = createSubprocess(
      subprocessId,
      result.prompt.substring(0, 80),
      result.process.elements,
      result.process.flows,
    );

    elements.push(subprocess);
  });

  // Add end event
  const endEventId = `EndEvent_${timestamp}`;
  elements.push(createEndEvent(endEventId, "End"));

  // Create flows connecting start -> subprocesses -> end
  if (subprocessIds.length > 0) {
    // Start to first subprocess
    flows.push(createSequenceFlow(`Flow_start_${timestamp}`, startEventId, subprocessIds[0]));

    // Connect subprocesses sequentially
    for (let i = 0; i < subprocessIds.length - 1; i++) {
      flows.push(createSequenceFlow(`Flow_${i}_${timestamp}`, subprocessIds[i], subprocessIds[i + 1]));
    }

    // Last subprocess to end
    flows.push(createSequenceFlow(`Flow_end_${timestamp}`, subprocessIds[subprocessIds.length - 1], endEventId));
  } else {
    // No subprocesses, just connect start to end
    flows.push(createSequenceFlow(`Flow_direct_${timestamp}`, startEventId, endEventId));
  }

  return createProcess(combinedProcessId, originalPrompt.substring(0, 100) || "Combined Process", elements, flows);
}
