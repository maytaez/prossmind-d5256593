# Gemini 3 Model Selection for Complex Prompts

## Overview

The model selection logic has been enhanced to automatically detect complex prompts (similar to those in `example_prompts.txt`) and use **Gemini 3 API** instead of Gemini 2.5 Pro for these cases.

## Changes Made

### 1. Complex Prompt Detection

Added `isComplexExamplePrompt()` function that detects prompts matching the complexity pattern from `example_prompts.txt`:

**Detection Criteria:**
- **Explicit swimlane mentions**: Prompts that explicitly mention "swimlane", "swim lane", "include swimlanes", etc.
- **End-to-end processes**: Prompts describing lifecycle processes, "from X to Y", "covering X to Y"
- **Multiple departments**: Prompts mentioning multiple departments/roles together (e.g., "Sales, Warehouse, Logistics, Finance")
- **Requirement lists**: Prompts with bullet points or numbered lists of requirements
- **Multiple complex concepts**: Prompts mentioning 4+ of: parallel processing, exception handling, subprocesses, message events, gateways, escalation
- **Complex process names**: Order-to-Cash, Procure-to-Pay, lifecycle management, compliance processes, audit cycles
- **Explicit multiple participants**: Prompts listing multiple participants/departments explicitly

**Scoring System:**
- Each indicator adds 2-3 points
- Score >= 5 triggers Gemini 3 selection

### 2. Model Selection Logic

Updated `selectModel()` function with three-tier selection:

1. **Gemini 3 Pro** (`google/gemini-3.0-pro`):
   - Complex example prompts (pattern detected)
   - Very high complexity (score >= 8)
   - Very long prompts (3000+ chars) with high complexity (score >= 6)

2. **Gemini 2.5 Pro** (`google/gemini-2.5-pro`):
   - P&ID diagrams (always)
   - High complexity (score >= 7) but not matching Gemini 3 criteria
   - Very long prompts (3000+ chars)
   - Long prompts (2000+ chars) with complexity score >= 5

3. **Gemini 2.5 Flash** (`google/gemini-2.5-flash`):
   - Standard complexity prompts (score < 7)

### 3. Updated Function Signatures

- `selectModel()` now accepts `prompt` parameter (optional, defaults to empty string)
- Updated call sites in `generate-bpmn/index.ts` and `generate-dmn/index.ts` to pass prompt

## Example Prompts That Trigger Gemini 3

Based on `example_prompts.txt`, these types of prompts will use Gemini 3:

1. **End-to-End Order-to-Cash Cycle**
   - Multiple swimlanes (Sales, Warehouse, Logistics, Accounts Receivable, Finance)
   - Parallel processing
   - Exception handling
   - Subprocesses
   - Message events

2. **Procure-to-Pay (P2P) Workflow**
   - Approval matrix
   - Conditional gateways
   - Parallel tasks
   - Subprocesses
   - Escalation subprocess

3. **Corporate Tax Filing and Compliance**
   - Multiple departments (Finance, HR, Legal)
   - Validation gateways
   - Parallel subprocesses
   - Escalation processes

4. **Construction Project Lifecycle Management**
   - Multiple workflows
   - Quality control
   - Financial control subprocess
   - Exception handling
   - Regulatory reporting

5. **Insurance Claim Assessment**
   - Multiple teams (claims, legal)
   - Parallel investigation
   - Conditional paths
   - Payment processing

And similar complex prompts...

## Model Name Note

The model name `google/gemini-3.0-pro` is used internally. When making API calls, the `google/` prefix is stripped automatically, so the API receives `gemini-3.0-pro`.

**Important**: If the actual Gemini 3 API model name differs (e.g., `gemini-3-pro`, `gemini-pro-3.0`), update line 88 in `model-selection.ts`.

## Testing

To test the implementation:

1. Use a complex prompt from `example_prompts.txt`
2. Check the logs for model selection reasoning
3. Verify that `gemini-3.0-pro` is used in the API call
4. Confirm the generated BPMN quality is improved

## Logging

The model selection includes detailed reasoning in logs:
- `[Model Selection] Criteria:` - Shows detected complexity indicators
- `[Model Selection] Initial Selection:` - Shows selected model and reasoning
- `[Model Selection] Final Configuration:` - Shows final model, tokens, temperature

Example log output:
```
[Model Selection] Using Gemini 3 Pro model: Complex example prompt pattern detected
```

## Benefits

1. **Better Quality**: Gemini 3 provides superior handling of complex, multi-faceted processes
2. **Automatic Detection**: No manual configuration needed - system automatically detects complexity
3. **Cost Optimization**: Still uses Gemini 2.5 Flash/Pro for simpler prompts
4. **Backward Compatible**: Existing prompts continue to work as before

## Future Enhancements

1. Fine-tune complexity scoring based on real-world usage
2. Add more complex prompt patterns as they're identified
3. Consider A/B testing to validate Gemini 3 improvements
4. Add metrics to track model selection distribution

