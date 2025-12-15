/**
 * Stage 1: Semantic Extraction
 * Extracts structured semantic data from normalized input using Gemini Flash
 */

import type { NormalizedInput, SemanticCore } from "./types/semantic-core.ts";

const SEMANTIC_EXTRACTION_PROMPT = `You are a business process analyst. Extract semantic information from the process description.

Extract:
1. Process metadata (name, domain)
2. Actors (who performs actions - external users, human roles, systems)
3. Activities (what actions are performed - with actor, action, object, semantic type)
4. Decisions (decision points with outcomes)
5. Control flow (sequence, conditions, parallel flows)

CRITICAL RULES:
- Return ONLY valid JSON matching the exact schema below
- Use unique IDs for all actors, activities, and decisions (format: actor_1, act_1, dec_1)
- Actor types must be: "external", "human", or "system"
- Activity semantic types must be: "user_action", "decision_preparation", "automated_action", or "notification"
- Control flow "from" and "to" must reference activity/decision IDs
- Include all activities mentioned in the description
- Identify all decision points and their outcomes

Return ONLY valid JSON matching this schema:
{
  "process_metadata": {
    "name": "Process Name",
    "domain": "Domain (optional)"
  },
  "actors": [
    {
      "id": "actor_1",
      "name": "Actor Name",
      "type": "external|human|system"
    }
  ],
  "activities": [
    {
      "id": "act_1",
      "actor": "actor_1",
      "action": "Action verb",
      "object": "Object of action",
      "semantic_type": "user_action|decision_preparation|automated_action|notification"
    }
  ],
  "decisions": [
    {
      "id": "dec_1",
      "question": "Decision question",
      "based_on": "act_1",
      "outcomes": ["outcome1", "outcome2"]
    }
  ],
  "control_flow": [
    {
      "from": "act_1",
      "to": "act_2",
      "type": "sequence|parallel|conditional",
      "condition": "optional condition text"
    }
  ]
}`;

/**
 * Extract semantic information from normalized input using Gemini Flash
 */
export async function extractSemantics(
  normalizedInput: NormalizedInput,
  apiKey: string,
  retryCount: number = 0
): Promise<SemanticCore> {
  const maxRetries = 2;
  
  try {
    const languageInstruction = normalizedInput.language.code !== "en"
      ? `\n\nIMPORTANT: The process description is in ${normalizedInput.language.name}. Extract all information preserving the original language. Use ${normalizedInput.language.name} for all names, labels, and text.`
      : "";

    const prompt = `${SEMANTIC_EXTRACTION_PROMPT}${languageInstruction}

Process Description:
${normalizedInput.content}

Extract the semantic information and return ONLY the JSON object.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.1, // Low temperature for structured output
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
    let semanticCore: SemanticCore;
    try {
      semanticCore = JSON.parse(jsonText);
    } catch (parseError) {
      // Try to extract JSON from text if wrapped
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        semanticCore = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse JSON: ${parseError}`);
      }
    }

    // Validate required fields
    if (!semanticCore.process_metadata || !semanticCore.process_metadata.name) {
      throw new Error("Missing process_metadata.name");
    }
    if (!Array.isArray(semanticCore.actors)) {
      throw new Error("Missing or invalid actors array");
    }
    if (!Array.isArray(semanticCore.activities)) {
      throw new Error("Missing or invalid activities array");
    }
    if (!Array.isArray(semanticCore.decisions)) {
      semanticCore.decisions = [];
    }
    if (!Array.isArray(semanticCore.control_flow)) {
      semanticCore.control_flow = [];
    }

    // Validate actor references in activities
    const actorIds = new Set(semanticCore.actors.map(a => a.id));
    for (const activity of semanticCore.activities) {
      if (!actorIds.has(activity.actor)) {
        console.warn(`Activity ${activity.id} references unknown actor ${activity.actor}`);
      }
    }

    return semanticCore;
  } catch (error) {
    console.error(`[Semantic Extraction] Error (attempt ${retryCount + 1}):`, error);
    
    if (retryCount < maxRetries) {
      // Retry with stricter prompt
      const stricterPrompt = `${SEMANTIC_EXTRACTION_PROMPT}

CRITICAL: Previous attempt failed. Ensure:
1. All required fields are present
2. All actor IDs in activities exist in actors array
3. All IDs in control_flow exist in activities or decisions
4. JSON is valid and complete

Process Description:
${normalizedInput.content}

Return ONLY valid JSON.`;

      return extractSemantics(
        { ...normalizedInput, content: stricterPrompt },
        apiKey,
        retryCount + 1
      );
    }
    
    throw error;
  }
}
