# BPMN Generation Workflow Refactor

## Overview

The BPMN generation workflow has been completely refactored to implement a robust pipeline with summarization, validation, and retry logic. This ensures high-quality, well-formed BPMN XML output even for complex or lengthy user prompts.

## Architecture

### Workflow Pipeline

```
User Prompt (Complex/Long)
    ↓
[Step 1] Summarization (Gemini Flash)
    ↓
Simplified Prompt
    ↓
[Step 2] BPMN Generation (Gemini 2.5 Pro)
    ↓
Raw BPMN XML
    ↓
[Step 3] XML Validation
    ↓
Valid? ──No──→ [Step 4] Retry with Error Context (Max 3 attempts)
    │
   Yes
    ↓
Final Valid BPMN XML
```

## Key Components

### 1. Summarization (`summarizeInputWithFlash`)

**Purpose**: Simplify complex/long prompts while preserving critical BPMN modeling information.

**When triggered**:
- Prompts longer than 1500 characters
- Prompts with more than 10 lines
- Only for non-modeling-agent-mode requests

**What it preserves**:
- ✅ All workflow steps and activities
- ✅ All decision points and conditions
- ✅ All participants, roles, departments, swimlanes
- ✅ All sequence flows and dependencies
- ✅ All exception handling and error paths
- ✅ All subprocesses and grouped activities
- ✅ All parallel/concurrent activities
- ✅ All message flows and events
- ✅ All data objects and artifacts

**Model**: `gemini-2.5-flash`
**Temperature**: 0.3 (low for consistency)
**Max Tokens**: 2048

### 2. BPMN Generation (`generateBpmnXmlWithGemini`)

**Purpose**: Generate BPMN XML using Gemini 2.5 Pro with optional retry context.

**Model**: `gemini-2.5-pro` (always)
**Temperature**: 0.3 (deterministic)
**Max Tokens**: 16384

**Features**:
- Handles retry context from validation errors
- Automatically sanitizes XML output
- Removes markdown code blocks
- Ensures proper formatting

### 3. XML Validation (`validateBpmnXml`)

**Purpose**: Comprehensive validation of BPMN XML structure and well-formedness.

**Validation Checks**:
1. ✅ XML declaration presence
2. ✅ BPMN definitions element
3. ✅ Balanced XML tags (opening/closing)
4. ✅ BPMN process element
5. ✅ Diagram interchange (DI) section
6. ✅ Self-closing `di:waypoint` tags
7. ✅ No invalid `flowNodeRef` elements
8. ✅ Correct namespace prefixes

**Returns**: `ValidationResult` with error details if invalid

### 4. Retry Logic (`retryBpmnGenerationIfNecessary`)

**Purpose**: Automatically retry generation with validation error context.

**Behavior**:
- Maximum 3 attempts
- Each retry includes previous validation error
- 1-second delay between retries
- Stops on first successful validation
- Throws error if all attempts fail

**Error Context Includes**:
- Validation error message
- Detailed error description
- Attempt number
- Specific instructions to fix the issue

## Function Signatures

### `summarizeInputWithFlash(userPrompt, googleApiKey)`
```typescript
interface SummarizationResult {
  summarizedPrompt: string;
  wasSummarized: boolean;
}
```

### `validateBpmnXml(xml)`
```typescript
interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}
```

### `generateBpmnXmlWithGemini(...)`
```typescript
async function generateBpmnXmlWithGemini(
  simplifiedPrompt: string,
  systemPrompt: string,
  diagramType: 'bpmn' | 'pid',
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  retryContext?: {
    error: string;
    errorDetails?: string;
    attemptNumber: number;
  }
): Promise<string>
```

### `retryBpmnGenerationIfNecessary(...)`
```typescript
async function retryBpmnGenerationIfNecessary(
  simplifiedPrompt: string,
  systemPrompt: string,
  diagramType: 'bpmn' | 'pid',
  languageCode: string,
  languageName: string,
  googleApiKey: string,
  maxTokens: number,
  temperature: number,
  maxAttempts: number = 3
): Promise<string>
```

## Benefits

### 1. **Improved Quality**
- Summarization reduces noise in complex prompts
- Validation ensures well-formed XML
- Retry logic fixes common errors automatically

### 2. **Better Performance**
- Flash model for fast summarization
- Pro model only for final generation
- Reduced token usage through summarization

### 3. **Resilience**
- Automatic error recovery
- Detailed error context for retries
- Graceful degradation if summarization fails

### 4. **Maintainability**
- Clean function abstractions
- Clear separation of concerns
- Comprehensive error handling
- Detailed logging

## Error Handling

### Summarization Errors
- Falls back to original prompt
- Logs warning but continues
- No user-facing error

### Generation Errors
- Caught and retried with context
- Maximum 3 attempts
- Detailed error messages

### Validation Errors
- Specific error messages
- Detailed error descriptions
- Used as context for retries

## Logging

The workflow includes comprehensive logging:

```
[Summarization] Summarizing prompt (length: 2500 chars)
[Summarization] Successfully summarized: 2500 -> 1200 chars
[Workflow] Starting BPMN generation with validation and retry logic
[Workflow] Using prompt: SUMMARIZED (1200 chars)
[BPMN Generation] Attempt 1/3
[BPMN Generation] Validation failed on attempt 1: Unclosed di:waypoint tags
[BPMN Generation] Retrying with error context...
[BPMN Generation] Attempt 2/3
[BPMN Generation] Successfully generated valid XML on attempt 2
[Workflow] Successfully generated valid BPMN XML
```

## Usage Example

The refactored workflow is automatically used for all BPMN generation requests. No changes needed in calling code.

**Request**:
```json
{
  "prompt": "Create a complex order-to-cash process with multiple departments...",
  "diagramType": "bpmn"
}
```

**Response**:
```json
{
  "bpmnXml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>...",
  "cached": false,
  "wasSummarized": true
}
```

## Testing

To test the new workflow:

1. **Complex Prompt Test**: Use a prompt from `example_prompts.txt`
   - Should trigger summarization
   - Should generate valid XML
   - Should pass validation

2. **Validation Error Test**: Monitor logs for retry attempts
   - Check if errors are properly caught
   - Verify retry logic works
   - Confirm final XML is valid

3. **Simple Prompt Test**: Use a short prompt (< 1500 chars)
   - Should skip summarization
   - Should generate directly
   - Should still validate

## Future Enhancements

1. **Adaptive Summarization**: Adjust summarization threshold based on model performance
2. **Validation Improvements**: Add more sophisticated XML parsing
3. **Error Classification**: Categorize errors for better retry strategies
4. **Metrics**: Track summarization effectiveness and retry rates
5. **Caching**: Cache summarized prompts for repeated requests

## Notes

- Summarization is skipped in modeling agent mode (which already handles complexity)
- Validation happens both during retry loop and as final check
- All generated XML is sanitized before validation
- Cache uses original prompt hash (not summarized version)

