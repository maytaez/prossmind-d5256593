/**
 * Infer lane assignments when flowNodeRefs are empty
 * 
 * Gemini often doesn't populate flowNodeRefs in structure-only mode.
 * This utility infers which elements belong to which lane based on:
 * - Element names containing lane keywords
 * - Task types (e.g., serviceTask likely belongs to System lane)
 * - Sequential analysis of the process flow
 */

import { BPMNElement } from './bpmn-json-schema.ts';

interface Lane {
    id: string;
    name: string;
    flowNodeRefs: string[];
}

/**
 * Infer lane assignments from element names and types
 */
export function inferLaneAssignments(
    lanes: Lane[],
    elements: BPMNElement[]
): Lane[] {
    // If lanes already have flowNodeRefs, return as-is
    const hasFlowNodeRefs = lanes.some(lane => lane.flowNodeRefs.length > 0);
    if (hasFlowNodeRefs) {
        return lanes;
    }

    console.log('[Lane Assignment] flowNodeRefs empty, inferring assignments...');

    // Create new lanes with inferred assignments
    const inferredLanes: Lane[] = lanes.map(lane => ({
        ...lane,
        flowNodeRefs: []
    }));

    // Build keyword mapping from lane names
    const laneKeywords = lanes.map(lane => ({
        lane,
        keywords: extractKeywords(lane.name)
    }));

    // Assign each element to the best matching lane
    elements.forEach(element => {
        const elementKeywords = extractKeywords(element.name || '');

        // Find best matching lane
        interface BestMatch {
            lane: Lane;
            score: number;
        }
        let bestMatch: BestMatch | null = null;

        laneKeywords.forEach(({ lane, keywords }) => {
            const score = calculateMatchScore(elementKeywords, keywords, element, lane);

            if (bestMatch === null || score > bestMatch.score) {
                bestMatch = { lane, score };
            }
        });

        // Assign to best matching lane (or first lane if no match)
        if (bestMatch && bestMatch.score > 0) {
            const targetLane = inferredLanes.find(l => l.id === bestMatch!.lane.id);
            if (targetLane) {
                targetLane.flowNodeRefs.push(element.id);
                console.log(`[Lane Assignment] ${element.id} -> ${targetLane.name} (score: ${bestMatch.score})`);
            }
        } else {
            // Default to first lane
            if (inferredLanes.length > 0) {
                inferredLanes[0].flowNodeRefs.push(element.id);
                console.log(`[Lane Assignment] ${element.id} -> ${inferredLanes[0].name} (default)`);
            }
        }
    });

    return inferredLanes;
}

/**
 * Extract keywords from a name (lowercase, split by spaces/punctuation)
 */
function extractKeywords(name: string): Set<string> {
    const keywords = new Set<string>();

    // Normalize and split
    const normalized = name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2); // Skip short words

    normalized.forEach(word => keywords.add(word));

    return keywords;
}

/**
 * Calculate match score between element and lane
 */
function calculateMatchScore(
    elementKeywords: Set<string>,
    laneKeywords: Set<string>,
    element: BPMNElement,
    lane: Lane
): number {
    let score = 0;

    // 1. Direct keyword matches (most important)
    let keywordMatches = 0;
    elementKeywords.forEach(keyword => {
        if (laneKeywords.has(keyword)) {
            keywordMatches++;
            score += 10; // High weight for direct matches
        }
    });

    // 2. Element type heuristics (generic, not domain-specific)
    const elementType = element.type;
    const laneNameLower = lane.name.toLowerCase();

    // Service/Send tasks → likely belong to system/automated lanes
    if ((elementType === 'serviceTask' || elementType === 'sendTask' || elementType === 'receiveTask') &&
        (laneNameLower.includes('system') || laneNameLower.includes('automated') ||
            laneNameLower.includes('service'))) {
        score += 5;
    }

    // User/Manual tasks → likely belong to human actor lanes
    // (any lane that doesn't contain 'system', 'automated', 'service')
    if ((elementType === 'userTask' || elementType === 'manualTask') &&
        !laneNameLower.includes('system') &&
        !laneNameLower.includes('automated') &&
        !laneNameLower.includes('service')) {
        score += 3;
    }

    // 3. Capitalization hints - proper nouns in element names often match lane names
    // e.g., "Contact Patient" → "Patient" lane
    const elementName = element.name || '';
    const elementWords = elementName.split(/\s+/);
    const laneWords = lane.name.split(/\s+/);

    elementWords.forEach(word => {
        // Check if word is capitalized (likely a proper noun/actor name)
        if (word.length > 0 && word[0] === word[0].toUpperCase()) {
            laneWords.forEach(laneWord => {
                if (word.toLowerCase() === laneWord.toLowerCase()) {
                    score += 7; // Good indicator of lane assignment
                }
            });
        }
    });

    // 4. Substring matching for compound words
    // e.g., "Prescription" in element name matches "Pharmacy" lane if both contain "pharma"
    const elementNameLower = elementName.toLowerCase();
    if (elementNameLower.length > 3 && laneNameLower.length > 3) {
        // Check for significant substrings (4+ chars)
        for (let i = 0; i <= elementNameLower.length - 4; i++) {
            const substring = elementNameLower.substring(i, i + 4);
            if (laneNameLower.includes(substring)) {
                score += 2;
                break; // Only count once
            }
        }
    }

    return score;
}
