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
    recommendation: "generate" | "simplify" | "split";
    simplifiedPrompt?: string;
    subPrompts?: string[];
    reasoning: string;
}

/**
 * Analyze prompt complexity using Gemini Flash with timeout protection
 */
export async function analyzePromptComplexity(
    prompt: string,
    googleApiKey: string,
    languageCode: string = 'en',
    languageName: string = 'English'
): Promise<PromptAnalysis> {
    // Quick heuristic check first - if clearly simple, skip AI analysis
    const quickCheck = quickComplexityCheck(prompt);
    if (quickCheck.recommendation === "generate") {
        console.log("[Prompt Analysis] Quick check: simple prompt, skipping AI analysis");
        return quickCheck;
    }

    const languageInstruction = languageCode === 'en'
        ? `CRITICAL: The user's prompt is in ENGLISH. When simplifying or splitting, maintain ENGLISH language for all text.`
        : `CRITICAL: The user's prompt is in ${languageName} (${languageCode}). When simplifying or splitting, maintain ${languageName} language for all text. DO NOT translate to English or French.`;

    const analysisPrompt = `You are a BPMN complexity analyzer. Analyze this BPMN generation prompt and determine if it's too complex for single-diagram generation.

${languageInstruction}

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
        // Add timeout protection - if analysis takes > 5 seconds, use fallback
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: analysisPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 4096,
                        temperature: 0.1, // Lower temperature for faster, more deterministic results
                        responseMimeType: "application/json",
                    },
                }),
                signal: controller.signal,
            },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn("[Prompt Analysis] Failed, using fallback heuristics");
            return fallbackAnalysis(prompt);
        }

        const data = await response.json();
        const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!analysisText) {
            return fallbackAnalysis(prompt);
        }

        const analysis: PromptAnalysis = JSON.parse(analysisText);
        console.log("[Prompt Analysis]", {
            complexity: analysis.complexity.score,
            recommendation: analysis.recommendation,
            reasoning: analysis.reasoning,
        });

        return analysis;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.warn('[Prompt Analysis] Timeout (5s), using fallback heuristics');
        } else {
            console.error('[Prompt Analysis] Error:', error);
        }
        return fallbackAnalysis(prompt);
    }
}

/**
 * Quick complexity check without AI - for obviously simple prompts
 * Enhanced with aggressive pattern detection for timeout prevention
 */
function quickComplexityCheck(prompt: string): PromptAnalysis {
    const actors = (prompt.match(/actor|participant|role|department|system|service/gi) || []).length;
    const length = prompt.length;

    // Enhanced business process actor detection
    const businessActors = (prompt.match(/customer|client|user|manager|underwriter|reviewer|approver|senior|admin|operator|agent|analyst|specialist|engineer|auditor|officer|lead|team/gi) || []).length;
    const totalActors = actors + businessActors;

    // Check for high-complexity BPMN keywords
    const complexKeywords = (prompt.match(/swimlane|pool|lane|timer|boundary|escalate|recertification|parallel|subprocess|nested|compensation|error handling|exception|message flow|signal|conditional/gi) || []).length;

    // Business process complexity indicators
    const businessKeywords = (prompt.match(/approval|verify|review|validate|countersign|authorize|confirm|check|assess|evaluate/gi) || []).length;

    // Timer and event keywords (ENHANCED for timeout detection)
    const timerKeywords = (prompt.match(/timeout|auto-cancel|auto-reject|auto-close|escalate|escalation|wait|delay|days?|hours?|minutes?|deadline|expire|within|after/gi) || []).length;

    // Loop and iteration keywords
    const loopKeywords = (prompt.match(/loop|retry|re-upload|resubmit|repeat|until|again|iterate|stay in|cycle/gi) || []).length;

    // Customer journey & support workflow keywords (NEW - for ticket systems, support workflows)
    const supportWorkflowKeywords = (prompt.match(/ticket|support|queue|routing|categorize|category|priority|high priority|low priority|medium priority|request|portal|submission|workflow|notification|notify|message|alert|response/gi) || []).length;

    // Gateway and routing keywords (NEW - indicates complex branching)
    const gatewayKeywords = (prompt.match(/exclusive gateway|gateway|route|based on|if\s|then\s|else\s|otherwise|depending on|categorize|assign to|send to|trigger/gi) || []).length;

    // Multi-department/multi-actor indicators (NEW)
    const multiActorKeywords = (prompt.match(/different|multiple|various|several|team|teams|department|across|between/gi) || []).length;

    const totalComplexityIndicators = complexKeywords + businessKeywords + timerKeywords + loopKeywords + supportWorkflowKeywords + gatewayKeywords + multiActorKeywords;

    // AGGRESSIVE EARLY DETECTION: Support ticket workflows and customer journeys
    // These almost always need splitting due to multiple actors + routing + timers
    if (supportWorkflowKeywords >= 3 && (totalActors >= 2 || timerKeywords >= 1 || gatewayKeywords >= 1)) {
        console.log(`[Quick Check] Support workflow detected: ${supportWorkflowKeywords} support keywords, ${totalActors} actors, ${timerKeywords} timers`);
        return {
            isComplex: true,
            complexity: {
                score: 9,
                actors: totalActors,
                processes: supportWorkflowKeywords + gatewayKeywords,
                gateways: gatewayKeywords + 2,
                events: timerKeywords + 2,
                estimatedXmlSize: 120000
            },
            recommendation: 'split',
            reasoning: 'Support/ticket workflow detected with multiple actors and routing - high timeout risk'
        };
    }

    // AGGRESSIVE: 3+ actors with any complexity = split (was 5+ before)
    if (totalActors >= 3 && (timerKeywords >= 1 || gatewayKeywords >= 2 || complexKeywords >= 2)) {
        console.log(`[Quick Check] Multi-actor complex workflow: ${totalActors} actors, ${timerKeywords} timers, ${gatewayKeywords} gateways`);
        return {
            isComplex: true,
            complexity: {
                score: 8,
                actors: totalActors,
                processes: totalActors * 2,
                gateways: gatewayKeywords + 1,
                events: timerKeywords + 2,
                estimatedXmlSize: 100000
            },
            recommendation: 'split',
            reasoning: `Multi-actor workflow (${totalActors} actors) with complex features - high timeout risk`
        };
    }

    // If it's short, has few actors, and no complex keywords, it's likely simple
    if (length < 300 && totalActors <= 1 && totalComplexityIndicators === 0) {
        return {
            isComplex: false,
            complexity: {
                score: 2,
                actors: totalActors,
                processes: 1,
                gateways: 1,
                events: 2,
                estimatedXmlSize: length * 30
            },
            recommendation: 'generate',
            reasoning: 'Simple workflow detected via quick check'
        };
    }

    // Otherwise use fallback heuristic analysis
    return fallbackAnalysis(prompt);
}

/**
 * Fallback analysis using simple heuristics
 * Enhanced with aggressive timeout prevention
 */
export function fallbackAnalysis(prompt: string): PromptAnalysis {
    // Enhanced actor detection with business roles
    const actors = (prompt.match(/actor|participant|role|department|system|service|engine|bureau|portal|customer|manager|team|owner/gi) || []).length;
    const businessActors = (prompt.match(/underwriter|reviewer|approver|senior|admin|operator|agent|analyst|specialist|engineer|auditor|officer|client|user|lead/gi) || []).length;
    const totalActors = actors + businessActors;

    const processes = (prompt.match(/process|workflow|flow|procedure|task|step|activity|provisioning|deprovisioning|approval|review|recertification/gi) || []).length;
    const gateways = (prompt.match(/gateway|parallel|exclusive|inclusive|decision|branch|if|else|otherwise|based on|where required|conditional/gi) || []).length;
    const events = (prompt.match(/event|timer|message|signal|error|boundary|start|end|intermediate|wait|trigger|initiation|termination|escalate|chase|periodic/gi) || []).length;

    // Enhanced timer/timeout detection
    const timerEvents = (prompt.match(/timeout|auto-cancel|auto-reject|auto-close|deadline|expire|wait|delay|days?|hours?|minutes?|within|after|escalation/gi) || []).length;

    // Loop and retry detection
    const loops = (prompt.match(/loop|retry|re-upload|resubmit|repeat|until|again|iterate|stay in|cycle/gi) || []).length;

    const swimlanes = (prompt.match(/swimlane|pool|lane|across/gi) || []).length;
    const subprocesses = (prompt.match(/subprocess|nested|include/gi) || []).length;

    // Enhanced complex features detection (NEW - support workflow patterns)
    const complexFeatures = (prompt.match(/timer event|boundary event|message flow|compensation|error handling|escalation|approval|access management|provisioning|deprovisioning|recertification|automated|confirmation|verify|validate|countersign|authorize|ticket|support|queue|routing|categorize|priority|notification|notify/gi) || []).length;

    const length = prompt.length;

    // Enhanced complexity score calculation (1-10) - MORE AGGRESSIVE
    const score = Math.min(10, Math.floor(
        (totalActors * 2.0) +         // Increased weight on actors (was 1.5)
        (processes * 0.5) +
        (gateways * 2.0) +            // Increased weight on gateways (was 1.8)
        (events * 1.2) +
        (timerEvents * 3.0) +         // Increased weight on timer events (was 2.5)
        (loops * 2.5) +
        (swimlanes * 2.5) +
        (subprocesses * 2.0) +
        (complexFeatures * 1.8) +     // Increased weight (was 1.5)
        (length / 300)                // More sensitive to length (was /350)
    ));

    // Estimate XML size (rough approximation)
    const estimatedXmlSize = length * 50;

    let recommendation: "generate" | "simplify" | "split" = "generate";
    let reasoning = "Simple workflow, can generate directly";

    // MORE AGGRESSIVE SPLITTING - Lower thresholds
    // Enhanced detection for business processes with multiple actors and complex features
    if (estimatedXmlSize > 70000 ||                                   // Lowered from 80000
        totalActors > 3 ||                                            // Lowered from 4
        score > 6 ||                                                  // Lowered from 7
        (totalActors >= 3 && (gateways >= 2 || timerEvents >= 1 || loops >= 1)) ||  // More aggressive
        (gateways >= 3 && totalActors >= 2) ||                       // Lowered from 4/2
        complexFeatures > 3 ||                                        // Lowered from 4
        timerEvents >= 2 ||
        loops >= 2) {
        recommendation = 'split';
        reasoning = `Complex workflow detected (${totalActors} actors, ${gateways} gateways, ${timerEvents} timer events, ${loops} loops, ${complexFeatures} complex features, score ${score}). Splitting for better results and timeout prevention.`;
    } else if (totalActors > 2 || score > 4 || (gateways > 2 && events > 2) || complexFeatures > 2) {
        recommendation = 'simplify';
        reasoning = `Moderately complex workflow (${totalActors} actors, ${gateways} gateways, ${complexFeatures} complex features, score ${score}). Simplifying to core flow.`;
    }

    return {
        isComplex: score > 4,
        complexity: {
            score,
            actors: totalActors,
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
    googleApiKey: string,
    languageCode: string = 'en',
    languageName: string = 'English'
): Promise<string> {
    const languageInstruction = languageCode === 'en'
        ? `⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️
The user's prompt is in ENGLISH. You MUST return the simplified prompt in ENGLISH ONLY.
DO NOT translate to French, German, Spanish, or any other language.
Preserve English terminology exactly.`
        : `⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️
The user's prompt is in ${languageName} (${languageCode}).
You MUST return the simplified prompt in ${languageName} ONLY.
DO NOT translate to English, French, or any other language.
Preserve ${languageName} terminology exactly.`;

    const simplificationPrompt = `You are a BPMN prompt simplifier. Simplify this complex BPMN prompt while preserving the core workflow logic.

${languageInstruction}

SIMPLIFICATION RULES:
1. Keep all main actors/participants
2. Keep core workflow steps (tasks, gateways, events)
3. Remove detailed descriptions and explanations
4. Consolidate similar steps
5. Remove optional exception handling (can be added via refinement later)
6. Focus on the happy path
7. Keep it under 1500 characters
8. MAINTAIN THE SAME LANGUAGE AS THE ORIGINAL PROMPT

Return ONLY the simplified prompt in ${languageName}, no explanations.

ORIGINAL PROMPT:
${prompt}`;

    try {
        // Add timeout protection - if simplification takes > 5 seconds, use original
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: simplificationPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.1,
                    },
                }),
                signal: controller.signal,
            },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn("[Prompt Simplification] Failed, using original");
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
        if (error instanceof Error && error.name === "AbortError") {
            console.warn("[Prompt Simplification] Timeout, using original prompt");
        } else {
            console.error("[Prompt Simplification] Error:", error);
        }
        return prompt;
    }
}

/**
 * Split a complex prompt into sub-prompts using Gemini Flash
 */
export async function splitPromptIntoSubPrompts(
    prompt: string,
    googleApiKey: string,
    languageCode: string = 'en',
    languageName: string = 'English'
): Promise<string[]> {
    const languageInstruction = languageCode === 'en'
        ? `⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️
The user's prompt is in ENGLISH. You MUST return ALL sub-prompts in ENGLISH ONLY.
DO NOT translate to French, German, Spanish, or any other language.
Each sub-prompt must be in ENGLISH.`
        : `⚠️ CRITICAL LANGUAGE REQUIREMENT ⚠️
The user's prompt is in ${languageName} (${languageCode}).
You MUST return ALL sub-prompts in ${languageName} ONLY.
DO NOT translate to English, French, or any other language.
Each sub-prompt must be in ${languageName}.`;

    const splittingPrompt = `You are a BPMN prompt splitter. Split this complex BPMN workflow into 2-4 smaller, self-contained sub-prompts.

${languageInstruction}

SPLITTING STRATEGY:
1. Split by process phase (e.g., Input → Processing → Output)
2. Split by actor/participant (e.g., Customer Flow, System Flow, Admin Flow)
3. Split by subprocess (e.g., Main Flow, Exception Handling, Notifications)
4. Each sub-prompt should be complete and generate a valid BPMN diagram
5. Preserve all actors, events, gateways, and flows from the original
6. Each sub-prompt should be 500-1500 characters
7. MAINTAIN THE SAME LANGUAGE (${languageName}) AS THE ORIGINAL PROMPT IN ALL SUB-PROMPTS

Respond in JSON format:
{
  "subPrompts": [
    "Sub-prompt 1 description in ${languageName}...",
    "Sub-prompt 2 description in ${languageName}...",
    ...
  ],
  "splitStrategy": "brief explanation of how you split it"
}

ORIGINAL PROMPT:
${prompt}`;

    try {
        // Add timeout protection - if splitting takes > 7 seconds, use fallback
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${googleApiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: splittingPrompt }] }],
                    generationConfig: {
                        maxOutputTokens: 4096,
                        temperature: 0.1,
                        responseMimeType: "application/json",
                    },
                }),
                signal: controller.signal,
            },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn("[Prompt Splitting] Failed, using fallback");
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
        if (error instanceof Error && error.name === "AbortError") {
            console.warn("[Prompt Splitting] Timeout, using fallback split");
        } else {
            console.error("[Prompt Splitting] Error:", error);
        }
        return fallbackSplit(prompt);
    }
}

/**
 * Fallback prompt splitting (simple split by length)
 */
export function fallbackSplit(prompt: string): string[] {
    // Simple split: divide into 3 parts
    const sentences = prompt.split(/[.!?]\s+/);
    const third = Math.ceil(sentences.length / 3);

    return [
        sentences.slice(0, third).join(". ") + ".",
        sentences.slice(third, third * 2).join(". ") + ".",
        sentences.slice(third * 2).join(". ") + ".",
    ].filter((s) => s.length > 50);
}
