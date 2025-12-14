/**
 * Model selection utilities with performance tracking
 */

export interface ModelSelectionCriteria {
  promptLength: number;
  diagramType: 'bpmn' | 'pid';
  hasMultiplePools?: boolean;
  hasComplexGateways?: boolean;
  hasSubprocesses?: boolean;
  hasMultipleParticipants?: boolean;
  hasMultipleActors?: boolean;
  hasMultiplePaths?: boolean;
  hasComplexFeatures?: boolean;
  hasErrorHandling?: boolean;
  hasDataObjects?: boolean;
  hasMessageFlows?: boolean;
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
    hasMultiplePools = false,
    hasComplexGateways = false,
    hasSubprocesses = false,
    hasMultipleParticipants = false,
    hasMultipleActors = false,
    hasMultiplePaths = false,
    hasComplexFeatures = false,
    hasErrorHandling = false,
    hasDataObjects = false,
    hasMessageFlows = false,
  } = criteria;

  // Enhanced scoring: Very long prompts (3000+) are likely complex modeling agent prompts
  // These should get higher weight to ensure Pro model selection
  const lengthScore = promptLength > 3000 ? 5 : promptLength > 2000 ? 4 : promptLength > 1500 ? 3 : promptLength > 800 ? 2 : promptLength > 400 ? 1 : 0;

  return (
    lengthScore +
    (hasMultiplePools ? 2 : 0) +
    (hasComplexGateways ? 2 : 0) +
    (hasSubprocesses ? 1 : 0) +
    (hasMultipleParticipants ? 2 : 0) +
    (hasMultipleActors ? 2 : 0) +
    (hasMultiplePaths ? 1 : 0) +
    (hasComplexFeatures ? 2 : 0) +
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
  const { diagramType, promptLength } = criteria;

  // Use Pro model for:
  // 1. P&ID diagrams (always)
  // 2. Complexity score >= 7
  // 3. Very long prompts (3000+ chars) - likely complex modeling agent prompts
  // 4. Prompts with multiple complexity indicators
  const useProModel = diagramType === 'pid' ||
    complexityScore >= 7 ||
    promptLength > 3000 ||
    (promptLength > 2000 && complexityScore >= 5);

  if (useProModel) {
    return {
      model: 'google/gemini-2.5-pro',
      maxTokens: 20480, // Increased from 16384 to handle complex diagrams
      temperature: 0.3, // Lower temperature for Pro model (more deterministic)
      complexityScore,
      reasoning: `Using Pro model: ${diagramType === 'pid' ? 'P&ID requires Pro' :
        promptLength > 3000 ? `Very long prompt (${promptLength} chars)` :
          promptLength > 2000 && complexityScore >= 5 ? `Long prompt (${promptLength} chars) with complexity score ${complexityScore}` :
            `Complexity score ${complexityScore} >= 7`}`,
    };
  } else {
    return {
      model: 'google/gemini-2.5-flash',
      maxTokens: 12288,
      temperature: 0.5, // Higher temperature for Flash (more creative)
      complexityScore,
      reasoning: `Using Flash model: Complexity score ${complexityScore} < 7, prompt length ${promptLength}`,
    };
  }
}

/**
 * Analyze prompt to extract selection criteria
 */
export function analyzePrompt(prompt: string, diagramType: 'bpmn' | 'pid' = 'bpmn'): ModelSelectionCriteria {
  const promptLower = prompt.toLowerCase();

  // Enhanced pattern matching for modeling agent mode prompts
  // These prompts are very prescriptive and mention many BPMN concepts
  const hasMultiplePools = /pool|swimlane|lane|participant/gi.test(prompt);
  const hasComplexGateways = /gateway|parallel|exclusive|inclusive|event-based|decision|branch/gi.test(prompt);
  const hasSubprocesses = /subprocess|sub-process|sub process|callactivity|call activity/gi.test(prompt);
  const hasMultipleParticipants = /participant|actor|role|department|organization|team/gi.test(prompt);
  const hasErrorHandling = /error|exception|compensation|recovery|rollback|retry|boundary event/gi.test(prompt);
  const hasDataObjects = /data object|artifact|document|attachment|dataobject|datastore|annotation/gi.test(prompt);
  const hasMessageFlows = /message flow|message event|messageflow|intermediate.*event/gi.test(prompt);

  // Detect modeling agent mode prompts (they contain specific markers)
  const isModelingAgentMode = /variant|modelling agent|modeling agent|complexity tier|intermediate tier|advanced tier|basic tier/gi.test(prompt);

  // If it's a modeling agent mode prompt and mentions advanced/intermediate concepts, boost complexity
  const isAdvancedPrompt = isModelingAgentMode && (
    /advanced|intermediate|complex|multiple.*path|parallel.*branch|error.*handling|compliance|recovery/gi.test(prompt)
  );
  
  const hasMultipleActors = (prompt.match(/actor|participant|swimlane|pool|lane/gi) || []).length > 2;
  const hasComplexFeatures = (prompt.match(/subprocess|parallel|timer|boundary|escalate/gi) || []).length > 2;
  const hasMultiplePaths = (prompt.match(/gateway|decision|exclusive|parallel|inclusive/gi) || []).length > 1;
  
  return {
    promptLength: prompt.length,
    hasMultiplePools,
    hasComplexGateways: hasComplexGateways || isAdvancedPrompt,
    hasSubprocesses: hasSubprocesses || isAdvancedPrompt,
    hasMultipleParticipants: hasMultipleParticipants || isAdvancedPrompt,
    hasMultipleActors,
    hasMultiplePaths,
    hasComplexFeatures,
    hasErrorHandling: hasErrorHandling || isAdvancedPrompt,
    hasDataObjects: hasDataObjects || isAdvancedPrompt,
    hasMessageFlows: hasMessageFlows || isAdvancedPrompt,
    diagramType,
  };
}




