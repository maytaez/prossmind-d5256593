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

        // Generate all sub-diagrams in parallel
        const subDiagramPromises = subPrompts.map(async (subPrompt, index) => {
            console.log(`[Combined] Generating sub-diagram ${index + 1}/${subPrompts.length}`);

            try {
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Sub-diagram generation timeout')), 45000);
                });

                const generationPromise = generateSingleDiagram(subPrompt, diagramType, GOOGLE_API_KEY);
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
            setTimeout(() => reject(new Error('Overall generation timeout')), 120000);
        });

        let subDiagramResults: Array<{ xml: string; prompt: string; index: number }>;
        try {
            subDiagramResults = await Promise.race([
                Promise.all(subDiagramPromises),
                overallTimeout
            ]);
        } catch (error) {
            console.error('[Combined] Overall timeout or failure:', error);
            throw new Error('Failed to generate sub-diagrams within time limit');
        }

        console.log(`[Combined] All ${subDiagramResults.length} sub-diagrams generated, combining...`);

        // Use intelligent merge that preserves sub-diagram content
        const combinedBpmn = intelligentMergeDiagrams(subDiagramResults, originalPrompt);

        console.log(`[Combined] Success! Combined diagram: ${combinedBpmn.length} chars`);

        return new Response(
            JSON.stringify({
                bpmnXml: combinedBpmn,
                subDiagramCount: subDiagramResults.length,
                message: `Successfully combined ${subDiagramResults.length} sub-diagrams`
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
        ? 'You are a BPMN 2.0 expert. Generate valid, complete BPMN XML with diagram interchange (DI).'
        : 'You are a P&ID expert. Generate valid BPMN XML representing a P&ID.';

    const userPrompt = `${systemPrompt}

Generate a ${diagramType.toUpperCase()} diagram for:
${prompt}

REQUIREMENTS:
1. Include complete BPMN 2.0 XML structure
2. Include diagram interchange (bpmndi:BPMNDiagram) with coordinates
3. Use descriptive task names based on the prompt
4. Return ONLY the XML, no markdown formatting

Generate the diagram:`;

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

function intelligentMergeDiagrams(
    subDiagramResults: Array<{ xml: string; prompt: string; index: number }>,
    originalPrompt: string
): string {
    const timestamp = Date.now();
    let subProcesses = '';
    let subProcessShapes = '';
    let flows = '';
    let edges = '';

    const startX = 100;
    const startY = 200;
    const subProcessWidth = 400;
    const subProcessHeight = 300;
    const verticalSpacing = 350;
    const eventSize = 36;

    subDiagramResults.forEach((result, index) => {
        const subProcessId = `SubProcess_${index}_${timestamp}`;
        const currentY = startY + (index * verticalSpacing);

        // Create an expanded subprocess for each sub-diagram
        // Extract the actual content from the sub-diagram XML
        const subProcessContent = extractProcessContent(result.xml, index, timestamp);

        subProcesses += `    <bpmn:subProcess id="${subProcessId}" name="${result.prompt.substring(0, 80)}">
${subProcessContent}
    </bpmn:subProcess>\n`;

        // Add subprocess shape
        subProcessShapes += `      <bpmndi:BPMNShape id="Shape_${subProcessId}" bpmnElement="${subProcessId}" isExpanded="true">
        <dc:Bounds x="${startX + 150}" y="${currentY}" width="${subProcessWidth}" height="${subProcessHeight}"/>
      </bpmndi:BPMNShape>\n`;

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
            const prevY = startY + ((index - 1) * verticalSpacing);

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

    const endY = startY + (subDiagramResults.length * verticalSpacing);

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
      <bpmndi:BPMNShape id="Shape_EndEvent_${timestamp}" bpmnElement="EndEvent_${timestamp}">
        <dc:Bounds x="${startX + 150 + subProcessWidth / 2 - eventSize / 2}" y="${endY}" width="${eventSize}" height="${eventSize}"/>
      </bpmndi:BPMNShape>
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function extractProcessContent(xml: string, index: number, timestamp: number): string {
    // Simple extraction: get content between <bpmn:process> tags
    const processMatch = xml.match(/<bpmn:process[^>]*>([\s\S]*?)<\/bpmn:process>/);

    if (processMatch && processMatch[1]) {
        // Make IDs unique by adding suffix
        let content = processMatch[1];
        content = content.replace(/id="([^"]+)"/g, `id="$1_sub${index}_${timestamp}"`);
        content = content.replace(/sourceRef="([^"]+)"/g, `sourceRef="$1_sub${index}_${timestamp}"`);
        content = content.replace(/targetRef="([^"]+)"/g, `targetRef="$1_sub${index}_${timestamp}"`);
        content = content.replace(/bpmnElement="([^"]+)"/g, `bpmnElement="$1_sub${index}_${timestamp}"`);
        return content;
    }

    // Fallback: create simple content
    return `      <bpmn:startEvent id="Start_sub${index}_${timestamp}" name="Start"/>
      <bpmn:task id="Task_sub${index}_${timestamp}" name="Process Step ${index + 1}"/>
      <bpmn:endEvent id="End_sub${index}_${timestamp}" name="End"/>
      <bpmn:sequenceFlow id="Flow1_sub${index}_${timestamp}" sourceRef="Start_sub${index}_${timestamp}" targetRef="Task_sub${index}_${timestamp}"/>
      <bpmn:sequenceFlow id="Flow2_sub${index}_${timestamp}" sourceRef="Task_sub${index}_${timestamp}" targetRef="End_sub${index}_${timestamp}"/>`;
}
