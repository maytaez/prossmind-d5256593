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

  // Enhanced scoring: Very long prompts (3000+) are likely complex modeling agent prompts
  // These should get higher weight to ensure Pro model selection
  const lengthScore = promptLength > 3000 ? 5 : promptLength > 2000 ? 4 : promptLength > 1500 ? 3 : promptLength > 800 ? 2 : promptLength > 400 ? 1 : 0;

  return (
    lengthScore +
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

  // Maximum output tokens for Gemini models:
  // Gemini 2.5 Pro: 65,536 tokens (theoretical max, use high value to prevent truncation)
  // Gemini 2.5 Flash: 8,192 tokens (typical limit)
  // Use high token limits to prevent truncation, especially for complex diagrams
  const PRO_MAX_OUTPUT_TOKENS = 65536; // Gemini 2.5 Pro maximum
  const FLASH_MAX_OUTPUT_TOKENS = 8192; // Gemini 2.5 Flash typical maximum
  
  if (useProModel) {
    // For Pro model, use very high token limit to handle complex BPMN diagrams
    // Diagrams with lanes, collaborations, and multiple subprocesses can be very large
    // Use higher token limits when complexity indicators suggest a large diagram
    const hasLanesOrCollaboration = criteria.hasMultipleParticipants || criteria.hasMultiplePools || criteria.hasMessageFlows;
    const hasComplexStructure = criteria.hasSubprocesses && (criteria.hasComplexGateways || criteria.hasErrorHandling);
    
    // Determine token limit based on complexity
    let proMaxTokens: number;
    if (complexityScore >= 8 || promptLength > 4000) {
      // Very complex: use absolute max
      proMaxTokens = PRO_MAX_OUTPUT_TOKENS;
    } else if (hasLanesOrCollaboration || hasComplexStructure || complexityScore >= 7) {
      // Complex with lanes/collaboration or high complexity: use 75% of max
      proMaxTokens = 49152; // 75% of 65536
    } else {
      // Moderately complex: use 50% of max
      proMaxTokens = 32768; // 50% of 65536
    }
    
    return {
      model: 'google/gemini-2.5-pro',
      maxTokens: proMaxTokens,
      temperature: 0.3, // Lower temperature for Pro model (more deterministic)
      complexityScore,
      reasoning: `Using Pro model: ${diagramType === 'pid' ? 'P&ID requires Pro' : 
                  promptLength > 3000 ? `Very long prompt (${promptLength} chars)` :
                  promptLength > 2000 && complexityScore >= 5 ? `Long prompt (${promptLength} chars) with complexity score ${complexityScore}` :
                  `Complexity score ${complexityScore} >= 7`}, maxTokens: ${proMaxTokens}${hasLanesOrCollaboration ? ' (lanes/collaboration detected)' : ''}`,
    };
  } else {
    // For Flash model, use maximum available tokens to prevent truncation
    // BPMN XML can be quite long, especially with lanes and subprocesses
    // Check if prompt suggests complex structure that might need more tokens
    const hasLanesOrCollaboration = criteria.hasMultipleParticipants || criteria.hasMultiplePools || criteria.hasMessageFlows;
    const flashMaxTokens = hasLanesOrCollaboration || criteria.hasSubprocesses 
      ? FLASH_MAX_OUTPUT_TOKENS  // Use max for complex diagrams
      : FLASH_MAX_OUTPUT_TOKENS; // Always use max for Flash to prevent truncation
    
    return {
      model: 'google/gemini-2.5-flash',
      maxTokens: flashMaxTokens,
      temperature: 0.5, // Higher temperature for Flash (more creative)
      complexityScore,
      reasoning: `Using Flash model: Complexity score ${complexityScore} < 7, prompt length ${promptLength}, maxTokens: ${flashMaxTokens}`,
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
  
  return {
    promptLength: prompt.length,
    hasMultiplePools,
    hasComplexGateways: hasComplexGateways || isAdvancedPrompt,
    hasSubprocesses: hasSubprocesses || isAdvancedPrompt,
    hasMultipleParticipants: hasMultipleParticipants || isAdvancedPrompt,
    hasErrorHandling: hasErrorHandling || isAdvancedPrompt,
    hasDataObjects: hasDataObjects || isAdvancedPrompt,
    hasMessageFlows: hasMessageFlows || isAdvancedPrompt,
    diagramType,
  };
}




