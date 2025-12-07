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
 * Analyze prompt complexity - OPTIMIZED for speed
 * Uses fast heuristics first, only calls AI for edge cases
 */
export async function analyzePromptComplexity(
    prompt: string,
    googleApiKey: string
): Promise<PromptAnalysis> {
    // FAST PATH: Use heuristics first
    const quickAnalysis = fallbackAnalysis(prompt);

    // If clearly simple or clearly complex, skip AI analysis
    if (quickAnalysis.complexity.score <= 5 || quickAnalysis.complexity.score >= 9) {
        console.log('[Prompt Analysis] Fast heuristic decision:', quickAnalysis.recommendation);
        return quickAnalysis;
    }

    // EDGE CASE: Only use AI for borderline cases (score 6-8)
    // This saves ~2-3 seconds for most requests
    console.log('[Prompt Analysis] Borderline complexity, using AI analysis...');

    const analysisPrompt = `Analyze this BPMN prompt complexity. Respond in JSON:
{
  "recommendation": "generate" | "simplify" | "split",
  "reasoning": "brief explanation"
}

Prompt: ${prompt.substring(0, 1000)}...`;  // Truncate for speed

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: analysisPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 512,
                        temperature: 0.1,
                        responseMimeType: 'application/json'
                    }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            return quickAnalysis;
        }

        const data = await response.json();
        const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!analysisText) {
            return quickAnalysis;
        }

        const aiResult = JSON.parse(analysisText);

        // Merge AI recommendation with heuristic analysis
        return {
            ...quickAnalysis,
            recommendation: aiResult.recommendation,
            reasoning: aiResult.reasoning
        };
    } catch (error) {
        console.warn('[Prompt Analysis] AI analysis timeout/error, using heuristics');
        return quickAnalysis;
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
 * Split a complex prompt into sub-prompts - OPTIMIZED for speed
 */
export async function splitPromptIntoSubPrompts(
    prompt: string,
    googleApiKey: string
): Promise<string[]> {
    // FAST FALLBACK: If prompt is very long, use simple split immediately
    if (prompt.length > 3000) {
        console.log('[Prompt Splitting] Using fast split for very long prompt');
        return fallbackSplit(prompt);
    }

    const splittingPrompt = `Split this BPMN workflow into 2-3 smaller sub-prompts. Each should be 500-1200 chars.

Respond in JSON:
{
  "subPrompts": ["prompt1", "prompt2", "prompt3"]
}

Prompt: ${prompt}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: splittingPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.2,
                        responseMimeType: 'application/json'
                    }
                }),
                signal: controller.signal
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            return fallbackSplit(prompt);
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) {
            return fallbackSplit(prompt);
        }

        const result = JSON.parse(resultText);
        console.log(`[Prompt Splitting] Split into ${result.subPrompts.length} sub-prompts`);

        return result.subPrompts;
    } catch (error) {
        console.warn('[Prompt Splitting] Timeout/error, using fallback');
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
