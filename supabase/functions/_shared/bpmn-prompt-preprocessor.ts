// BPMN Prompt Preprocessor
// Preprocesses prompts to extract structured information for better BPMN generation

export interface Lane {
  name: string;
  role?: string;
}

export interface ProcessStep {
  name: string;
  lane?: string;
  type?: string;
  description?: string;
}

export interface PreprocessedPrompt {
  originalPrompt: string;
  cleanedPrompt: string;
  lanes: Lane[];
  processSteps: ProcessStep[];
  metadata?: Record<string, unknown>;
}

/**
 * Preprocesses a BPMN prompt using AI to extract structured information
 * @param prompt - The original user prompt
 * @param apiKey - Google API key for AI processing
 * @returns Structured prompt data with lanes and process steps
 */
export async function preprocessBpmnPrompt(
  prompt: string,
  apiKey: string
): Promise<PreprocessedPrompt> {
  // TODO: Implement AI-based preprocessing using the API key
  // For now, return a basic structure
  
  const cleanedPrompt = prompt.trim();
  
  return {
    originalPrompt: prompt,
    cleanedPrompt,
    lanes: [],
    processSteps: [],
  };
}

/**
 * Converts a preprocessed structured prompt into an enhanced text prompt
 * @param structured - The preprocessed prompt data
 * @returns Enhanced prompt string for BPMN generation
 */
export function structuredPromptToEnhancedPrompt(
  structured: PreprocessedPrompt
): string {
  // TODO: Implement enhanced prompt generation
  // For now, return the cleaned prompt
  
  if (structured.lanes.length === 0 && structured.processSteps.length === 0) {
    return structured.cleanedPrompt;
  }

  let enhanced = structured.cleanedPrompt;

  if (structured.lanes.length > 0) {
    const laneNames = structured.lanes.map((l) => l.name).join(", ");
    enhanced += `\n\nLanes/Participants: ${laneNames}`;
  }

  if (structured.processSteps.length > 0) {
    const stepNames = structured.processSteps.map((s) => s.name).join(" → ");
    enhanced += `\n\nProcess Flow: ${stepNames}`;
  }

  return enhanced;
}
