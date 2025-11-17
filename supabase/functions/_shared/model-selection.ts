/**
 * Model selection utilities with performance tracking
 */

export interface ModelSelectionCriteria {
  promptLength: number;
  hasMultiplePools: boolean;
  hasComplexGateways: boolean;
  hasSubprocesses: boolean;
  hasMultipleParticipants: boolean;
  hasErrorHandling: boolean;
  hasDataObjects: boolean;
  hasMessageFlows: boolean;
  diagramType: 'bpmn' | 'pid';
}

export interface ModelSelectionResult {
  model: string;
  maxTokens: number;
  temperature: number;
  complexityScore: number;
  reasoning: string;
}

/**
 * Calculate complexity score for prompt
 */
export function calculateComplexityScore(criteria: ModelSelectionCriteria): number {
  const {
    promptLength,
    hasMultiplePools,
    hasComplexGateways,
    hasSubprocesses,
    hasMultipleParticipants,
    hasErrorHandling,
    hasDataObjects,
    hasMessageFlows,
  } = criteria;

  return (
    (promptLength > 1500 ? 3 : promptLength > 800 ? 2 : promptLength > 400 ? 1 : 0) +
    (hasMultiplePools ? 2 : 0) +
    (hasComplexGateways ? 2 : 0) +
    (hasSubprocesses ? 1 : 0) +
    (hasMultipleParticipants ? 2 : 0) +
    (hasErrorHandling ? 1 : 0) +
    (hasDataObjects ? 1 : 0) +
    (hasMessageFlows ? 1 : 0)
  );
}

/**
 * Select appropriate model based on complexity
 */
export function selectModel(criteria: ModelSelectionCriteria): ModelSelectionResult {
  const complexityScore = calculateComplexityScore(criteria);
  const { diagramType } = criteria;

  // Use Pro model for complex diagrams or P&ID (threshold: 7)
  const useProModel = diagramType === 'pid' || complexityScore >= 7;

  if (useProModel) {
    return {
      model: 'google/gemini-2.5-pro',
      maxTokens: 16384,
      temperature: 0.3, // Lower temperature for Pro model (more deterministic)
      complexityScore,
      reasoning: `Using Pro model: ${diagramType === 'pid' ? 'P&ID requires Pro' : `Complexity score ${complexityScore} >= 7`}`,
    };
  } else {
    return {
      model: 'google/gemini-2.5-flash',
      maxTokens: 12288,
      temperature: 0.5, // Higher temperature for Flash (more creative)
      complexityScore,
      reasoning: `Using Flash model: Complexity score ${complexityScore} < 7`,
    };
  }
}

/**
 * Analyze prompt to extract selection criteria
 */
export function analyzePrompt(prompt: string, diagramType: 'bpmn' | 'pid' = 'bpmn'): ModelSelectionCriteria {
  const promptLower = prompt.toLowerCase();
  
  return {
    promptLength: prompt.length,
    hasMultiplePools: /pool|swimlane|lane/gi.test(prompt),
    hasComplexGateways: /gateway|parallel|exclusive|event-based/gi.test(prompt),
    hasSubprocesses: /subprocess|sub-process|sub process/gi.test(prompt),
    hasMultipleParticipants: /participant|actor|role|department/gi.test(prompt),
    hasErrorHandling: /error|exception|compensation/gi.test(prompt),
    hasDataObjects: /data object|artifact|document|attachment/gi.test(prompt),
    hasMessageFlows: /message flow|message event/gi.test(prompt),
    diagramType,
  };
}




