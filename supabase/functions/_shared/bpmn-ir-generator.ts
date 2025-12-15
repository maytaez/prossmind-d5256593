/**
 * Stage 2: BPMN IR Generation
 * Converts semantic core to BPMN Intermediate Representation using Gemini Pro
 */

import type { SemanticCore } from "./types/semantic-core.ts";
import type { BpmnIR, TemplateConstraints, EnterpriseStyleProfile, Pattern } from "./types/bpmn-ir.ts";

const BPMN_IR_GENERATION_PROMPT = `You are a BPMN 2.0 modeling expert. Convert the semantic process data into BPMN Intermediate Representation (IR).

Your task:
1. Convert semantic actors to BPMN lanes (one lane per actor)
2. Convert semantic activities to BPMN nodes (tasks, events)
3. Convert semantic decisions to BPMN gateways (exclusive gateways)
4. Convert semantic control flow to BPMN flows (sequence flows)
5. Apply template constraints and style profile rules

BPMN IR Structure:
- Process: id and name
- Lanes: one per actor from semantic core
- Nodes: start_event, user_task, service_task, exclusive_gateway, end_event
- Flows: sequence flows connecting nodes with conditions for gateway outcomes

CRITICAL RULES:
- Return ONLY valid JSON matching the exact schema
- Use unique IDs for all elements (format: lane_1, node_1, flow_1)
- Map each semantic actor to exactly one lane
- Map each semantic activity to exactly one task node
- Map each semantic decision to exactly one exclusive gateway
- All flows must reference valid node IDs
- Gateway flows must include condition text for each outcome
- Apply naming conventions from style profile
- Follow structure rules from template constraints

Return ONLY valid JSON matching this schema:
{
  "process": {
    "id": "process_id",
    "name": "Process Name"
  },
  "lanes": [
    {
      "id": "lane_1",
      "name": "Lane Name",
      "actor_ref": "actor_1"
    }
  ],
  "nodes": [
    {
      "id": "node_1",
      "type": "start_event|user_task|service_task|exclusive_gateway|end_event",
      "name": "Node Name",
      "lane": "lane_1",
      "properties": {}
    }
  ],
  "flows": [
    {
      "from": "node_1",
      "to": "node_2",
      "condition": "optional condition",
      "name": "optional flow name"
    }
  ]
}`;

/**
 * Derive template constraints from semantic core
 */
export function deriveTemplateConstraints(semanticCore: SemanticCore): TemplateConstraints {
  const decisionCount = semanticCore.decisions.length;
  const endEventCount = Math.max(1, decisionCount + 1); // At least one end, more if decisions

  return {
    required_elements: {
      start_event: 1,
      xor_gateway: decisionCount > 0 ? decisionCount : undefined,
      end_events: endEventCount,
    },
    structure_rules: [
      decisionCount > 0 ? "decision_after_review" : "",
      "explicit_rejection_path",
    ].filter(Boolean),
  };
}

/**
 * Generate BPMN IR from semantic core using Gemini Pro
 */
export async function generateBpmnIR(
  semanticCore: SemanticCore,
  templateConstraints: TemplateConstraints,
  styleProfile: EnterpriseStyleProfile,
  patterns: Pattern[],
  apiKey: string,
  retryCount: number = 0,
  validationFeedback?: string[]
): Promise<BpmnIR> {
  const maxRetries = 2;

  try {
    const patternsText = patterns.length > 0
      ? `\n\nRetrieved Patterns (for reference):\n${JSON.stringify(patterns, null, 2)}`
      : "";

    const feedbackText = validationFeedback && validationFeedback.length > 0
      ? `\n\nVALIDATION FEEDBACK (fix these issues):\n${validationFeedback.join("\n")}`
      : "";

    const prompt = `${BPMN_IR_GENERATION_PROMPT}

Semantic Core:
${JSON.stringify(semanticCore, null, 2)}

Template Constraints:
${JSON.stringify(templateConstraints, null, 2)}

Enterprise Style Profile:
${JSON.stringify(styleProfile, null, 2)}${patternsText}${feedbackText}

Generate BPMN IR and return ONLY the JSON object.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.2, // Low temperature for structured output
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${errorText}`);
    }

    const data = await response.json();
    let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Clean up JSON if wrapped in markdown
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Parse JSON
    let bpmnIR: BpmnIR;
    try {
      bpmnIR = JSON.parse(jsonText);
    } catch (parseError) {
      // Try to extract JSON from text if wrapped
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        bpmnIR = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse JSON: ${parseError}`);
      }
    }

    // Validate required fields
    if (!bpmnIR.process || !bpmnIR.process.id || !bpmnIR.process.name) {
      throw new Error("Missing or invalid process definition");
    }
    if (!Array.isArray(bpmnIR.lanes)) {
      throw new Error("Missing or invalid lanes array");
    }
    if (!Array.isArray(bpmnIR.nodes)) {
      throw new Error("Missing or invalid nodes array");
    }
    if (!Array.isArray(bpmnIR.flows)) {
      bpmnIR.flows = [];
    }

    // Validate lane references in nodes
    const laneIds = new Set(bpmnIR.lanes.map(l => l.id));
    for (const node of bpmnIR.nodes) {
      if (!laneIds.has(node.lane)) {
        console.warn(`Node ${node.id} references unknown lane ${node.lane}`);
      }
    }

    // Validate flow references
    const nodeIds = new Set(bpmnIR.nodes.map(n => n.id));
    for (const flow of bpmnIR.flows) {
      if (!nodeIds.has(flow.from)) {
        throw new Error(`Flow references unknown source node: ${flow.from}`);
      }
      if (!nodeIds.has(flow.to)) {
        throw new Error(`Flow references unknown target node: ${flow.to}`);
      }
    }

    return bpmnIR;
  } catch (error) {
    console.error(`[BPMN IR Generation] Error (attempt ${retryCount + 1}):`, error);

    if (retryCount < maxRetries) {
      // Retry with explicit error feedback
      const errorFeedback = [
        `Previous attempt failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "Ensure all required fields are present",
        "Ensure all lane references in nodes are valid",
        "Ensure all flow source/target references are valid node IDs",
      ];
      return generateBpmnIR(
        semanticCore,
        templateConstraints,
        styleProfile,
        patterns,
        apiKey,
        retryCount + 1,
        errorFeedback
      );
    }

    throw error;
  }
}

/**
 * Generate BPMN IR with validation feedback (for retries after validation)
 */
export async function generateBpmnIRWithFeedback(
  semanticCore: SemanticCore,
  templateConstraints: TemplateConstraints,
  styleProfile: EnterpriseStyleProfile,
  patterns: Pattern[],
  validationIssues: string[],
  apiKey: string
): Promise<BpmnIR> {
  return generateBpmnIR(
    semanticCore,
    templateConstraints,
    styleProfile,
    patterns,
    apiKey,
    0,
    validationIssues
  );
}
