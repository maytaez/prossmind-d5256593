/**
 * Infer lane assignments when flowNodeRefs are empty
 *
 * Gemini often doesn't populate flowNodeRefs in structure-only mode.
 * This utility infers which elements belong to which lane based on:
 * - Element names containing lane keywords
 * - Task types (e.g., serviceTask likely belongs to System lane)
 * - Sequential analysis of the process flow
 */

import { BPMNElement } from "./bpmn-json-schema.ts";

interface Lane {
  id: string;
  name: string;
  flowNodeRefs: string[];
}

interface BestMatch {
  lane: Lane;
  score: number;
}

/**
 * Infer lane assignments from element names and types
 */
export function inferLaneAssignments(lanes: Lane[], elements: BPMNElement[]): Lane[] {
  // If lanes already have flowNodeRefs, return as-is
  const hasFlowNodeRefs = lanes.some((lane) => lane.flowNodeRefs.length > 0);
  if (hasFlowNodeRefs) {
    return lanes;
  }

  console.log("[Lane Assignment] flowNodeRefs empty, inferring assignments...");

  // Create new lanes with inferred assignments
  const inferredLanes: Lane[] = lanes.map((lane) => ({
    ...lane,
    flowNodeRefs: [],
  }));

  // Build keyword mapping from lane names
  const laneKeywords = lanes.map((lane) => ({
    lane,
    keywords: extractKeywords(lane.name),
  }));

  // Assign each element to the best matching lane
  elements.forEach((element) => {
    const elementKeywords = extractKeywords(element.name || "");

    // Find best matching lane
    let bestMatch: BestMatch | null = null;

    laneKeywords.forEach(({ lane, keywords }) => {
      const score = calculateMatchScore(elementKeywords, keywords, element, lane);

      if (bestMatch === null || score > bestMatch.score) {
        bestMatch = { lane, score };
      }
    });

    // Assign to best matching lane (or first lane if no match)
    const match = bestMatch as BestMatch | null;
    if (match && match.score > 0) {
      const targetLane = inferredLanes.find((l) => l.id === match.lane.id);
      if (targetLane) {
        targetLane.flowNodeRefs.push(element.id);
        console.log(`[Lane Assignment] ${element.id} -> ${targetLane.name} (score: ${match.score})`);
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
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2); // Skip short words

  normalized.forEach((word) => keywords.add(word));

  return keywords;
}

/**
 * Calculate match score between element and lane
 */
function calculateMatchScore(
  elementKeywords: Set<string>,
  laneKeywords: Set<string>,
  element: BPMNElement,
  lane: Lane,
): number {
  let score = 0;

  const elementName = (element.name || "").toLowerCase();
  const laneNameLower = lane.name.toLowerCase();
  const elementType = element.type;

  // 1. Direct keyword matches (most important)
  elementKeywords.forEach((keyword) => {
    if (laneKeywords.has(keyword)) {
      score += 15; // High weight for direct matches
    }
  });

  // 2. Exact word matches (case-insensitive)
  const elementWords = elementName.split(/\s+/);
  const laneWords = laneNameLower.split(/\s+/);
  
  elementWords.forEach((word) => {
    if (word.length > 2 && laneWords.includes(word)) {
      score += 12; // Strong match
    }
  });

  // 3. Domain-specific keyword matching for common BPMN domains
  // Banking/Finance
  if (laneNameLower.includes("compliance") || laneNameLower.includes("risk")) {
    if (elementName.includes("due diligence") || elementName.includes("kyc") || 
        elementName.includes("sanctions") || elementName.includes("pep") ||
        elementName.includes("escalat") || elementName.includes("audit")) {
      score += 20;
    }
  }
  
  if (laneNameLower.includes("risk")) {
    if (elementName.includes("risk") || elementName.includes("score") || 
        elementName.includes("assess")) {
      score += 15;
    }
  }
  
  if (laneNameLower.includes("front office") || laneNameLower.includes("front")) {
    if (elementName.includes("customer") || elementName.includes("notify") ||
        elementName.includes("approve") || elementName.includes("account")) {
      score += 12;
    }
  }
  
  if (laneNameLower.includes("back office") || laneNameLower.includes("back")) {
    if (elementName.includes("capture") || elementName.includes("application") ||
        elementName.includes("sanctions") || elementName.includes("archive")) {
      score += 12;
    }
  }
  
  if (laneNameLower.includes("customer")) {
    if (elementName.includes("customer") || elementName.includes("notify") ||
        elementName.includes("request") || elementName.includes("send")) {
      score += 15;
    }
  }

  // 4. Element type heuristics
  // Service/Send tasks → likely belong to system/automated/back office lanes
  if (elementType === "serviceTask" || elementType === "sendTask" || elementType === "receiveTask") {
    if (laneNameLower.includes("system") || laneNameLower.includes("automated") || 
        laneNameLower.includes("service") || laneNameLower.includes("back office")) {
      score += 8;
    }
  }

  // User/Manual tasks → likely belong to human actor lanes (not system/automated)
  if (elementType === "userTask" || elementType === "manualTask") {
    if (!laneNameLower.includes("system") && !laneNameLower.includes("automated") && 
        !laneNameLower.includes("service")) {
      score += 5;
    }
    // Prefer compliance/risk/front office for user tasks
    if (laneNameLower.includes("compliance") || laneNameLower.includes("risk") ||
        laneNameLower.includes("front office")) {
      score += 3;
    }
  }

  // 5. Capitalization hints - proper nouns in element names often match lane names
  const elementNameOriginal = element.name || "";
  const elementWordsOriginal = elementNameOriginal.split(/\s+/);
  
  elementWordsOriginal.forEach((word) => {
    // Check if word is capitalized (likely a proper noun/actor name)
    if (word.length > 0 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      laneWords.forEach((laneWord) => {
        if (word.toLowerCase() === laneWord.toLowerCase()) {
          score += 10; // Good indicator of lane assignment
        }
      });
    }
  });

  // 6. Substring matching for compound words
  if (elementName.length > 3 && laneNameLower.length > 3) {
    // Check for significant substrings (4+ chars)
    for (let i = 0; i <= elementName.length - 4; i++) {
      const substring = elementName.substring(i, i + 4);
      if (laneNameLower.includes(substring)) {
        score += 3;
        break; // Only count once
      }
    }
  }

  // 7. Negative scoring - avoid mismatches
  // Don't assign customer-facing tasks to back office
  if (laneNameLower.includes("back office") && 
      (elementName.includes("notify customer") || elementName.includes("approve"))) {
    score -= 5;
  }

  return Math.max(0, score); // Ensure non-negative
}
