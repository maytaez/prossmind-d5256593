/**
 * BPMN Prompt Preprocessor
 *
 * Uses Gemini Flash to analyze and structure user prompts for better BPMN generation.
 * Extracts: lanes, process steps, decision points, events, and flow logic.
 */

export interface StructuredPrompt {
  lanes: string[];
  processSteps: ProcessStep[];
  decisionPoints: DecisionPoint[];
  events: EventDefinition[];
  flows: FlowDefinition[];
  metadata: {
    processName: string;
    complexity: "simple" | "moderate" | "complex";
  };
}

export interface ProcessStep {
  id: string;
  lane: string;
  name: string;
  type: "user_task" | "service_task" | "send_task" | "receive_task" | "manual_task";
  description?: string;
}

export interface DecisionPoint {
  id: string;
  lane: string;
  question: string;
  type: "exclusive" | "inclusive" | "parallel" | "event_based";
  outcomes: Array<{
    condition: string;
    target: string;
  }>;
}

export interface EventDefinition {
  id: string;
  lane: string;
  name: string;
  type: "start" | "end" | "intermediate_throw" | "intermediate_catch" | "boundary" | "timer" | "message" | "signal";
  attachedTo?: string;
}

export interface FlowDefinition {
  from: string;
  to: string;
  condition?: string;
}

/**
 * Preprocess user prompt using Gemini Flash
 */
export async function preprocessBpmnPrompt(userPrompt: string, googleApiKey: string): Promise<StructuredPrompt> {
  const systemPrompt = `You are a BPMN process analyst. Analyze user prompts and extract structured process information.

Your task is to extract:
1. **Swimlanes/Lanes**: Identify all actors, roles, or systems (e.g., "Patient", "Physician", "System")
2. **Process Steps**: Tasks and activities with their assigned lanes
3. **Decision Points**: Gateways where the process branches (exclusive, parallel, event-based)
4. **Events**: Start events, end events, message events, timer events, etc.
5. **Flow Logic**: How steps, decisions, and events connect

Return ONLY valid JSON matching this schema:
{
  "lanes": ["Lane1", "Lane2", ...],
  "processSteps": [
    {
      "id": "step_1",
      "lane": "Lane1",
      "name": "Task name",
      "type": "user_task|service_task|send_task|receive_task",
      "description": "Optional details"
    }
  ],
  "decisionPoints": [
    {
      "id": "gateway_1",
      "lane": "Lane1",
      "question": "What to decide?",
      "type": "exclusive|inclusive|parallel|event_based",
      "outcomes": [
        {"condition": "Yes", "target": "step_2"},
        {"condition": "No", "target": "step_3"}
      ]
    }
  ],
  "events": [
    {
      "id": "start_1",
      "lane": "Lane1",
      "name": "Process started",
      "type": "start|end|intermediate_throw|intermediate_catch|timer|message|signal"
    }
  ],
  "flows": [
    {"from": "start_1", "to": "step_1"},
    {"from": "step_1", "to": "gateway_1"}
  ],
  "metadata": {
    "processName": "Process Title",
    "complexity": "simple|moderate|complex"
  }
}

CRITICAL RULES:
- Use clear, descriptive IDs (step_1, gateway_1, event_1)
- Assign every element to a lane
- Ensure all flows reference valid IDs
- Return ONLY JSON, no markdown, no explanations`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `Analyze this BPMN process description and extract structured information:\n\n${userPrompt}` },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Flash API error: ${errorText}`);
  }

  const data = await response.json();
  let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Clean JSON (remove markdown formatting if present)
  jsonText = jsonText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const structured: StructuredPrompt = JSON.parse(jsonText);
    console.log(
      `[Prompt Preprocessor] Extracted ${structured.lanes.length} lanes, ${structured.processSteps.length} steps`,
    );
    return structured;
  } catch (error) {
    console.error("[Prompt Preprocessor] Failed to parse JSON:", error);
    throw new Error(`Invalid JSON from Flash: ${error.message}`);
  }
}

/**
 * Convert structured prompt to enhanced natural language prompt for BPMN generation
 */
export function structuredPromptToEnhancedPrompt(structured: StructuredPrompt): string {
  let prompt = `Create a BPMN 2.0 diagram for: "${structured.metadata.processName}"\n\n`;

  // Lanes
  prompt += `## Swimlanes\n`;
  structured.lanes.forEach((lane, i) => {
    prompt += `${i + 1}. ${lane}\n`;
  });

  // Process flow
  prompt += `\n## Process Flow\n\n`;

  // Group steps by lane for clarity
  const stepsByLane = new Map<string, ProcessStep[]>();
  structured.processSteps.forEach((step) => {
    if (!stepsByLane.has(step.lane)) {
      stepsByLane.set(step.lane, []);
    }
    stepsByLane.get(step.lane)!.push(step);
  });

  structured.lanes.forEach((lane) => {
    const steps = stepsByLane.get(lane) || [];
    if (steps.length > 0) {
      prompt += `### ${lane} Lane:\n`;
      steps.forEach((step) => {
        prompt += `- [${step.type.replace(/_/g, " ")}] ${step.name}\n`;
        if (step.description) {
          prompt += `  ${step.description}\n`;
        }
      });
      prompt += `\n`;
    }
  });

  // Decision points
  if (structured.decisionPoints.length > 0) {
    prompt += `## Decision Points\n`;
    structured.decisionPoints.forEach((dp) => {
      prompt += `- ${dp.question} (${dp.type} gateway in ${dp.lane})\n`;
      dp.outcomes.forEach((outcome) => {
        prompt += `  → ${outcome.condition}: ${outcome.target}\n`;
      });
    });
    prompt += `\n`;
  }

  // Events
  if (structured.events.length > 0) {
    prompt += `## Events\n`;
    structured.events.forEach((event) => {
      prompt += `- ${event.name} (${event.type} in ${event.lane})\n`;
    });
  }

  return prompt;
}
