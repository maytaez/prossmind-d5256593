/**
 * Prompt Router
 * Determines whether to use multi-stage pipeline or direct generation
 */

export interface RoutingOptions {
  forceMultiStage?: boolean;
  forceDirect?: boolean;
  promptLength?: number;
}

/**
 * Determine if prompt should use multi-stage pipeline
 */
export function shouldUseMultiStage(
  prompt: string,
  options: RoutingOptions = {}
): boolean {
  // User override
  if (options.forceMultiStage === true) return true;
  if (options.forceDirect === true) return false;

  const promptLength = options.promptLength || prompt.length;

  // Simple prompts: use direct generation
  // Complex prompts: use multi-stage pipeline

  // Count actors/participants
  const swimlanePattern = /swimlane[s]?\s+(?:for|with|including)\s+([^.,]+(?:,\s*[^.,]+)*)/gi;
  const swimlaneMatches = [...prompt.matchAll(swimlanePattern)];
  let explicitSwimlanes = 0;

  for (const match of swimlaneMatches) {
    if (match[1]) {
      const swimlaneList = match[1].split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      explicitSwimlanes += swimlaneList.length;
    }
  }

  const actors = (prompt.match(/actor|participant|swimlane|pool|lane|department|system|service/gi) || []).length;
  const complexity = (prompt.match(/subprocess|parallel|timer|boundary|escalate|event|gateway|decision/gi) || []).length;

  const totalActors = explicitSwimlanes > 0 ? explicitSwimlanes : actors;

  // Multi-stage criteria:
  // 1. Long prompts (> 500 chars)
  // 2. Multiple actors (>= 3)
  // 3. Complex features (gateways, subprocesses, etc.)
  // 4. Combination of moderate complexity

  const isLong = promptLength > 500;
  const hasMultipleActors = totalActors >= 3;
  const hasComplexFeatures = complexity >= 2;
  const isModeratelyComplex = totalActors >= 2 && complexity >= 1;

  return isLong || hasMultipleActors || hasComplexFeatures || isModeratelyComplex;
}
