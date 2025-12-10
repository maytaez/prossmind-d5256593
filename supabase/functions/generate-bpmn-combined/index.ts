import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CombinedGenerationRequest {
    subPrompts: string[];
    diagramType: 'bpmn' | 'pid';
    userId: string;
    originalPrompt: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { subPrompts, diagramType, userId, originalPrompt }: CombinedGenerationRequest = await req.json();

        if (!subPrompts || !Array.isArray(subPrompts) || subPrompts.length === 0) {
            throw new Error('Sub-prompts array is required');
        }

        if (!userId) {
            throw new Error('User ID is required');
        }

        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
        if (!GOOGLE_API_KEY) {
            throw new Error('Google API key not configured');
        }

        console.log(`[Combined Generation] Starting for ${subPrompts.length} sub-prompts`);

        // STRATEGY: Generate all sub-diagrams in parallel with timeout protection
        // Then combine them using AI - all within the 300s function timeout

        const subDiagramPromises = subPrompts.map(async (subPrompt, index) => {
            console.log(`[Combined] Generating sub-diagram ${index + 1}/${subPrompts.length}`);

            try {
                // Create a timeout promise
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Sub-diagram generation timeout')), 45000); // 45s timeout per diagram
                });

                // Create the generation promise
                const generationPromise = generateSingleDiagram(subPrompt, diagramType, GOOGLE_API_KEY);

                // Race between generation and timeout
                const result = await Promise.race([generationPromise, timeoutPromise]);
                console.log(`[Combined] Sub-diagram ${index + 1} completed (${result.length} chars)`);
                return result;
            } catch (error) {
                console.error(`[Combined] Sub-diagram ${index + 1} failed:`, error);
                // Return a simple placeholder diagram instead of failing completely
                return createPlaceholderDiagram(subPrompt, index + 1, diagramType);
            }
        });

        // Wait for all sub-diagrams with overall timeout
        const overallTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Overall generation timeout')), 120000); // 2 minutes total
        });

        let subDiagrams: string[];
        try {
            subDiagrams = await Promise.race([
                Promise.all(subDiagramPromises),
                overallTimeout
            ]);
        } catch (error) {
            console.error('[Combined] Overall timeout or failure:', error);
            throw new Error('Failed to generate sub-diagrams within time limit');
        }

        console.log(`[Combined] All ${subDiagrams.length} sub-diagrams generated, combining...`);

        // Combine diagrams with timeout protection
        const combineTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Combine timeout')), 30000); // 30s for combining
        });

        const combinePromise = combineSubDiagrams(subDiagrams, originalPrompt, diagramType, GOOGLE_API_KEY);

        let combinedBpmn: string;
        try {
            combinedBpmn = await Promise.race([combinePromise, combineTimeout]);
        } catch (error) {
            console.error('[Combined] Combine failed, using simple merge:', error);
            // Fallback: simple concatenation with proper BPMN structure
            combinedBpmn = simpleMergeDiagrams(subDiagrams, diagramType);
        }

        console.log(`[Combined] Success! Combined diagram: ${combinedBpmn.length} chars`);

        // Return the combined BPMN directly (no job tracking needed since we're fast enough now)
        return new Response(
            JSON.stringify({
                bpmnXml: combinedBpmn,
                subDiagramCount: subDiagrams.length,
                message: `Successfully combined ${subDiagrams.length} sub-diagrams`
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('[Combined Generation] Error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message || 'Unknown error' }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});

async function generateSingleDiagram(
    prompt: string,
    diagramType: 'bpmn' | 'pid',
    googleApiKey: string
): Promise<string> {
    const systemPrompt = diagramType === 'bpmn'
        ? 'You are a BPMN 2.0 expert. Generate valid BPMN XML.'
        : 'You are a P&ID expert. Generate valid BPMN XML representing a P&ID.';

    const userPrompt = `${systemPrompt}\n\nGenerate a ${diagramType.toUpperCase()} diagram for:\n${prompt}\n\nReturn ONLY the XML, no markdown formatting.`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userPrompt }] }],
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
    let xml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    xml = xml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    if (!xml.includes('<?xml')) {
        throw new Error('Invalid BPMN XML generated');
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
                   id="Definitions_${index}">
  <bpmn:process id="${processId}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_${index}" name="Start"/>
    <bpmn:task id="${taskId}" name="Sub-process ${index}: ${prompt.substring(0, 50)}..."/>
    <bpmn:endEvent id="EndEvent_${index}" name="End"/>
    <bpmn:sequenceFlow id="Flow_${index}_1" sourceRef="StartEvent_${index}" targetRef="${taskId}"/>
    <bpmn:sequenceFlow id="Flow_${index}_2" sourceRef="${taskId}" targetRef="EndEvent_${index}"/>
  </bpmn:process>
</bpmn:definitions>`;
}

async function combineSubDiagrams(
    subDiagrams: string[],
    originalPrompt: string,
    diagramType: 'bpmn' | 'pid',
    googleApiKey: string
): Promise<string> {
    console.log(`[Combine] Merging ${subDiagrams.length} sub-diagrams`);

    // Enhanced combine prompt that explicitly requests DI (diagram interchange)
    const combinePrompt = `You are a BPMN 2.0 expert. Combine these ${subDiagrams.length} BPMN sub-diagrams into ONE complete, valid BPMN 2.0 XML diagram.

CRITICAL REQUIREMENTS:
1. Include COMPLETE diagram interchange (bpmndi:BPMNDiagram) with:
   - bpmndi:BPMNShape for EVERY element (tasks, events, gateways) with x, y, width, height
   - bpmndi:BPMNEdge for EVERY sequence flow with waypoints
2. Arrange elements in a logical left-to-right flow
3. Use proper spacing (150px between elements horizontally, 100px vertically)
4. Ensure all element IDs are unique (use _combined_1, _combined_2 suffixes)
5. Connect the end of one sub-process to the start of the next
6. Fix any invalid connections (e.g., no flows FROM end events)

ORIGINAL WORKFLOW:
${originalPrompt.substring(0, 400)}

SUB-DIAGRAMS TO COMBINE:
${subDiagrams.map((xml, i) => `\n--- Sub-Diagram ${i + 1} ---\n${xml.substring(0, 800)}\n`).join('\n')}

EXAMPLE STRUCTURE (you must include similar DI for ALL elements):
<bpmn:definitions ...>
  <bpmn:process id="Process_1">
    <bpmn:startEvent id="Start_1"/>
    <bpmn:task id="Task_1"/>
    ...
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Shape_Start_1" bpmnElement="Start_1">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Shape_Task_1" bpmnElement="Task_1">
        <dc:Bounds x="200" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Edge_Flow_1" bpmnElement="Flow_1">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="200" y="120"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>

Return ONLY the complete, valid BPMN 2.0 XML with full DI information:`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: combinePrompt }] }],
                generationConfig: {
                    maxOutputTokens: 32768, // Increased for DI information
                    temperature: 0.1, // Lower for more consistent structure
                },
            }),
        }
    );

    if (!response.ok) {
        throw new Error(`Combine API error: ${response.statusText}`);
    }

    const data = await response.json();
    let combinedXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    combinedXml = combinedXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    // Validate that DI information is present
    if (!combinedXml.includes('bpmndi:BPMNShape') || !combinedXml.includes('dc:Bounds')) {
        console.warn('[Combine] Generated XML missing DI information, will use fallback');
        throw new Error('Missing diagram interchange information');
    }

    return combinedXml;
}

function simpleMergeDiagrams(subDiagrams: string[], diagramType: string): string {
    // Fallback: Create a simple sequential diagram WITH complete DI information
    const timestamp = Date.now();
    let tasks = '';
    let flows = '';
    let shapes = '';
    let edges = '';

    const startX = 100;
    const startY = 100;
    const elementSpacing = 180; // Horizontal spacing between elements
    const taskWidth = 120;
    const taskHeight = 80;
    const eventSize = 36;

    subDiagrams.forEach((_, index) => {
        const taskId = `Task_${index}_${timestamp}`;
        const currentX = startX + (index + 1) * elementSpacing;

        // Add task element
        tasks += `    <bpmn:task id="${taskId}" name="Sub-process ${index + 1}"/>\n`;

        // Add task shape with coordinates
        shapes += `      <bpmndi:BPMNShape id="Shape_${taskId}" bpmnElement="${taskId}">
        <dc:Bounds x="${currentX}" y="${startY - taskHeight / 2}" width="${taskWidth}" height="${taskHeight}"/>
      </bpmndi:BPMNShape>\n`;

        if (index === 0) {
            const flowId = `Flow_start_${timestamp}`;
            flows += `    <bpmn:sequenceFlow id="${flowId}" sourceRef="StartEvent_${timestamp}" targetRef="${taskId}"/>\n`;

            // Add edge for start -> first task
            edges += `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
        <di:waypoint x="${startX + eventSize}" y="${startY}"/>
        <di:waypoint x="${currentX}" y="${startY}"/>
      </bpmndi:BPMNEdge>\n`;
        } else {
            const prevTaskId = `Task_${index - 1}_${timestamp}`;
            const flowId = `Flow_${index}_${timestamp}`;
            const prevX = startX + index * elementSpacing;

            flows += `    <bpmn:sequenceFlow id="${flowId}" sourceRef="${prevTaskId}" targetRef="${taskId}"/>\n`;

            // Add edge for prev task -> current task
            edges += `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
        <di:waypoint x="${prevX + taskWidth}" y="${startY}"/>
        <di:waypoint x="${currentX}" y="${startY}"/>
      </bpmndi:BPMNEdge>\n`;
        }

        if (index === subDiagrams.length - 1) {
            const flowId = `Flow_end_${timestamp}`;
            const endX = currentX + taskWidth + elementSpacing;

            flows += `    <bpmn:sequenceFlow id="${flowId}" sourceRef="${taskId}" targetRef="EndEvent_${timestamp}"/>\n`;

            // Add edge for last task -> end
            edges += `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">
        <di:waypoint x="${currentX + taskWidth}" y="${startY}"/>
        <di:waypoint x="${endX}" y="${startY}"/>
      </bpmndi:BPMNEdge>\n`;
        }
    });

    const endX = startX + (subDiagrams.length + 1) * elementSpacing;

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_Combined_${timestamp}"
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Combined_${timestamp}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_${timestamp}" name="Start"/>
${tasks}
    <bpmn:endEvent id="EndEvent_${timestamp}" name="End"/>
${flows}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${timestamp}">
    <bpmndi:BPMNPlane id="BPMNPlane_${timestamp}" bpmnElement="Process_Combined_${timestamp}">
      <bpmndi:BPMNShape id="Shape_StartEvent_${timestamp}" bpmnElement="StartEvent_${timestamp}">
        <dc:Bounds x="${startX}" y="${startY - eventSize / 2}" width="${eventSize}" height="${eventSize}"/>
      </bpmndi:BPMNShape>
${shapes}
      <bpmndi:BPMNShape id="Shape_EndEvent_${timestamp}" bpmnElement="EndEvent_${timestamp}">
        <dc:Bounds x="${endX}" y="${startY - eventSize / 2}" width="${eventSize}" height="${eventSize}"/>
      </bpmndi:BPMNShape>
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}
