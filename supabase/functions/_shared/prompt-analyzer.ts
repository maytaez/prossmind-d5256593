/**
 * Intelligent Prompt Analyzer and Simplifier
 * Uses Gemini Flash to analyze BPMN prompt complexity and automatically simplify or split if needed
 */

export interface PromptAnalysis {
    isComplex: boolean;
    complexity: {
        score: number;
        actors: number;
        processes: number;
        gateways: number;
        events: number;
        estimatedXmlSize: number;
    };
    recommendation: 'generate' | 'simplify' | 'split';
    simplifiedPrompt?: string;
    subPrompts?: string[];
    reasoning: string;
}

/**
 * Analyze prompt complexity using Gemini Flash
 */
export async function analyzePromptComplexity(
    prompt: string,
    googleApiKey: string
): Promise<PromptAnalysis> {
    const analysisPrompt = `You are a BPMN complexity analyzer. Analyze this BPMN generation prompt and determine if it's too complex for single-diagram generation.

COMPLEXITY CRITERIA:
- Simple: 1-3 actors, 5-10 tasks, 1-2 gateways, basic flow
- Moderate: 3-5 actors, 10-20 tasks, 3-5 gateways, some parallel flows
- Complex: 5+ actors, 20+ tasks, 5+ gateways, multiple subprocesses, timers, boundary events
- Very Complex: 7+ actors, 30+ tasks, extensive swimlanes, nested subprocesses, multiple exception paths

RULES:
1. If estimated XML size > 100,000 characters → SPLIT into sub-prompts
2. If 5+ actors with complex interactions → SPLIT by actor/phase
3. If 3-5 actors with moderate complexity → SIMPLIFY (remove details, focus on core flow)
4. If simple workflow → GENERATE as-is

Respond in JSON format:
{
  "isComplex": boolean,
  "complexity": {
    "score": number (1-10),
    "actors": number,
    "processes": number,
    "gateways": number,
    "events": number,
    "estimatedXmlSize": number
  },
  "recommendation": "generate" | "simplify" | "split",
  "simplifiedPrompt": "simplified version if recommendation is simplify",
  "subPrompts": ["prompt1", "prompt2", ...] if recommendation is split,
  "reasoning": "brief explanation"
}

PROMPT TO ANALYZE:
${prompt}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: analysisPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 4096,
                        temperature: 0.3,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!response.ok) {
            console.warn('[Prompt Analysis] Failed, using fallback heuristics');
            return fallbackAnalysis(prompt);
        }

        const data = await response.json();
        const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!analysisText) {
            return fallbackAnalysis(prompt);
        }

        const analysis: PromptAnalysis = JSON.parse(analysisText);
        console.log('[Prompt Analysis]', {
            complexity: analysis.complexity.score,
            recommendation: analysis.recommendation,
            reasoning: analysis.reasoning
        });

        return analysis;
    } catch (error) {
        console.error('[Prompt Analysis] Error:', error);
        return fallbackAnalysis(prompt);
    }
}

/**
 * Fallback analysis using simple heuristics
 */
function fallbackAnalysis(prompt: string): PromptAnalysis {
    const actors = (prompt.match(/actor|participant|role|department|system|service/gi) || []).length;
    const processes = (prompt.match(/process|workflow|flow|procedure/gi) || []).length;
    const gateways = (prompt.match(/gateway|parallel|exclusive|inclusive|decision|branch|if|else/gi) || []).length;
    const events = (prompt.match(/event|timer|message|signal|error|boundary/gi) || []).length;
    const length = prompt.length;

    // Estimate complexity score (1-10)
    const score = Math.min(10, Math.floor(
        (actors * 1.5) +
        (processes * 0.5) +
        (gateways * 1.2) +
        (events * 1.0) +
        (length / 500)
    ));

    // Estimate XML size (rough approximation)
    const estimatedXmlSize = length * 45; // ~45 chars of XML per char of prompt

    let recommendation: 'generate' | 'simplify' | 'split' = 'generate';
    let reasoning = 'Simple workflow, can generate directly';

    if (estimatedXmlSize > 100000 || actors > 6 || score > 8) {
        recommendation = 'split';
        reasoning = `Very complex workflow (${actors} actors, score ${score}). Splitting into sub-prompts for better results.`;
    } else if (actors > 4 || score > 6) {
        recommendation = 'simplify';
        reasoning = `Moderately complex workflow (${actors} actors, score ${score}). Simplifying to core flow.`;
    }

    return {
        isComplex: score > 6,
        complexity: {
            score,
            actors,
            processes,
            gateways,
            events,
            estimatedXmlSize
        },
        recommendation,
        reasoning
    };
}

/**
 * Simplify a complex prompt using Gemini Flash
 */
export async function simplifyPrompt(
    prompt: string,
    googleApiKey: string
): Promise<string> {
    const simplificationPrompt = `You are a BPMN prompt simplifier. Simplify this complex BPMN prompt while preserving the core workflow logic.

SIMPLIFICATION RULES:
1. Keep all main actors/participants
2. Keep core workflow steps (tasks, gateways, events)
3. Remove detailed descriptions and explanations
4. Consolidate similar steps
5. Remove optional exception handling (can be added via refinement later)
6. Focus on the happy path
7. Keep it under 1500 characters

Return ONLY the simplified prompt, no explanations.

ORIGINAL PROMPT:
${prompt}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: simplificationPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.3
                    }
                })
            }
        );

        if (!response.ok) {
            console.warn('[Prompt Simplification] Failed, using original');
            return prompt;
        }

        const data = await response.json();
        const simplified = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (simplified && simplified.length < prompt.length * 0.9) {
            console.log(`[Prompt Simplification] ${prompt.length} → ${simplified.length} chars`);
            return simplified;
        }

        return prompt;
    } catch (error) {
        console.error('[Prompt Simplification] Error:', error);
        return prompt;
    }
}

/**
 * Split a complex prompt into sub-prompts using Gemini Flash
 */
export async function splitPromptIntoSubPrompts(
    prompt: string,
    googleApiKey: string
): Promise<string[]> {
    const splittingPrompt = `You are a BPMN prompt splitter. Split this complex BPMN workflow into 2-4 smaller, self-contained sub-prompts.

SPLITTING STRATEGY:
1. Split by process phase (e.g., Input → Processing → Output)
2. Split by actor/participant (e.g., Customer Flow, System Flow, Admin Flow)
3. Split by subprocess (e.g., Main Flow, Exception Handling, Notifications)
4. Each sub-prompt should be complete and generate a valid BPMN diagram
5. Preserve all actors, events, gateways, and flows from the original
6. Each sub-prompt should be 500-1500 characters

Respond in JSON format:
{
  "subPrompts": [
    "Sub-prompt 1 description...",
    "Sub-prompt 2 description...",
    ...
  ],
  "splitStrategy": "brief explanation of how you split it"
}

ORIGINAL PROMPT:
${prompt}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: splittingPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 4096,
                        temperature: 0.3,
                        responseMimeType: 'application/json'
                    }
                })
            }
        );

        if (!response.ok) {
            console.warn('[Prompt Splitting] Failed, using fallback');
            return fallbackSplit(prompt);
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            return fallbackSplit(prompt);
        }

        const result = JSON.parse(resultText);
        console.log(`[Prompt Splitting] Split into ${result.subPrompts.length} sub-prompts:`, result.splitStrategy);

        return result.subPrompts;
    } catch (error) {
        console.error('[Prompt Splitting] Error:', error);
        return fallbackSplit(prompt);
    }
}

/**
 * Fallback prompt splitting (simple split by length)
 */
function fallbackSplit(prompt: string): string[] {
    // Simple split: divide into 3 parts
    const sentences = prompt.split(/[.!?]\s+/);
    const third = Math.ceil(sentences.length / 3);

    return [
        sentences.slice(0, third).join('. ') + '.',
        sentences.slice(third, third * 2).join('. ') + '.',
        sentences.slice(third * 2).join('. ') + '.'
    ].filter(s => s.length > 50);
}
