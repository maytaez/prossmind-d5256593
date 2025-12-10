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

    // Simplified combine prompt for faster processing
    const combinePrompt = `Combine these ${subDiagrams.length} BPMN diagrams into ONE cohesive diagram.

ORIGINAL WORKFLOW:
${originalPrompt.substring(0, 500)}...

SUB-DIAGRAMS:
${subDiagrams.map((xml, i) => `\n=== Diagram ${i + 1} ===\n${xml.substring(0, 1000)}...\n`).join('\n')}

INSTRUCTIONS:
1. Merge all elements into a single <bpmn:process>
2. Connect sub-processes with sequence flows
3. Ensure unique IDs (add suffix like _combined_1, _combined_2)
4. Keep it simple - focus on the main flow
5. Return ONLY valid BPMN 2.0 XML

Return the complete combined BPMN XML:`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: combinePrompt }] }],
                generationConfig: {
                    maxOutputTokens: 16384,
                    temperature: 0.2,
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

    return combinedXml;
}

function simpleMergeDiagrams(subDiagrams: string[], diagramType: string): string {
    // Fallback: Create a simple sequential diagram
    const timestamp = Date.now();
    let tasks = '';
    let flows = '';

    subDiagrams.forEach((_, index) => {
        const taskId = `Task_${index}_${timestamp}`;
        tasks += `    <bpmn:task id="${taskId}" name="Sub-process ${index + 1}"/>\n`;

        if (index === 0) {
            flows += `    <bpmn:sequenceFlow id="Flow_start_${timestamp}" sourceRef="StartEvent_${timestamp}" targetRef="${taskId}"/>\n`;
        } else {
            const prevTaskId = `Task_${index - 1}_${timestamp}`;
            flows += `    <bpmn:sequenceFlow id="Flow_${index}_${timestamp}" sourceRef="${prevTaskId}" targetRef="${taskId}"/>\n`;
        }

        if (index === subDiagrams.length - 1) {
            flows += `    <bpmn:sequenceFlow id="Flow_end_${timestamp}" sourceRef="${taskId}" targetRef="EndEvent_${timestamp}"/>\n`;
        }
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   id="Definitions_Combined_${timestamp}">
  <bpmn:process id="Process_Combined_${timestamp}" isExecutable="false">
    <bpmn:startEvent id="StartEvent_${timestamp}" name="Start"/>
${tasks}
    <bpmn:endEvent id="EndEvent_${timestamp}" name="End"/>
${flows}
  </bpmn:process>
</bpmn:definitions>`;
}
