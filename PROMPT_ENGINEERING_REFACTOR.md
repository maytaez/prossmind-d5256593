# BPMN Prompt Engineering Refactor

## Overview

This document describes the refactoring of BPMN generation prompts based on the principles and structure from `prompt_engineering.py`. The refactoring improves prompt quality, maintainability, and follows best practices for LLM prompt engineering.

## Key Changes

### 1. Structured Prompt Building

Following the pattern from `prompt_engineering.py`, prompts are now built using modular functions:

- **`addBpmnRole()`** - Defines the expert role (similar to `add_role()` in prompt_engineering.py)
- **`addBpmnKnowledge()`** - Comprehensive BPMN 2.0 knowledge (similar to `add_knowledge()`)
- **`addNegativePrompting()`** - Common mistakes to avoid (similar to `negative_prompting()`)
- **`addProcessDescription()`** - Adds the process description (similar to `add_process_description()`)
- **`addCodeGenerationInstructions()`** - Output format instructions (similar to `code_generation()`)

### 2. Comprehensive BPMN Knowledge

The `addBpmnKnowledge()` function now includes detailed information about:

- **Events**: startEvent, endEvent, intermediate events, boundary events
- **Activities**: task, userTask, serviceTask, manualTask, scriptTask, etc.
- **Gateways**: exclusiveGateway (XOR), parallelGateway (AND), inclusiveGateway (OR)
- **Subprocesses**: Embedded, Call Activity, Event Subprocess, Ad-Hoc, Transaction
- **Sequence Flows**: Connection rules and conditional flows
- **Message Flows**: Cross-pool communication
- **Pools and Lanes**: Resource awareness and participant modeling
- **Data Objects**: Data representation in processes
- **Layout Requirements**: Hierarchical layout, orthogonal routing, spacing
- **Validation Rules**: XML structure, element relationships, bounds

### 3. Negative Prompting

The `addNegativePrompting()` function explicitly lists common mistakes to avoid:

- Gateway errors (wrong gateway types, missing gateways)
- Subprocess errors (missing subprocesses, incorrect nesting)
- XML structure errors (invalid elements, namespace issues, unclosed tags)
- Layout errors (overlapping elements, poor spacing)
- Flow errors (orphan flows, invalid references)
- Label errors (paraphrasing, translation issues)
- Validation errors (invalid bounds, missing waypoints)

### 4. Enhanced Few-Shot Learning

Examples now include error explanations (similar to `add_few_shots()` in prompt_engineering.py):

- **`getBpmnExample()`** - Includes common errors to avoid
- **`getGermanBpmnExample()`** - Language-specific example with error explanations
- **`buildMessagesWithExamples()`** - Automatically includes error explanations in conversation

### 5. Conversation Management

New functions for managing iterative refinement:

- **`createBpmnConversation()`** - Creates initial conversation (similar to `create_conversation()`)
- **`updateBpmnConversation()`** - Updates conversation with feedback (similar to `update_conversation()`)
- **`getBpmnSelfImprovementPrompt()`** - Prompts for model self-improvement
- **`getBpmnSelfImprovementPromptShort()`** - Short version for quick improvements
- **`getDescriptionSelfImprovementPrompt()`** - Improves process descriptions before modeling

## Benefits

1. **Better Model Quality**: Comprehensive knowledge and negative prompting reduce common errors
2. **Maintainability**: Modular structure makes it easy to update specific sections
3. **Consistency**: Follows proven patterns from prompt_engineering.py
4. **Extensibility**: Easy to add new knowledge sections or error patterns
5. **Iterative Improvement**: Built-in support for feedback loops and refinement

## Usage Example

```typescript
// Create initial prompt
const systemPrompt = getBpmnSystemPrompt('en', 'English', false, true);

// Build conversation with examples
const messages = buildMessagesWithExamples(
  systemPrompt,
  'Create an order process with approval',
  'bpmn',
  'en',
  'English'
);

// Update with feedback
const updatedMessages = updateBpmnConversation(
  messages,
  'Add error handling for payment failures'
);
```

## Comparison with prompt_engineering.py

| prompt_engineering.py | prompts.ts | Purpose |
|----------------------|------------|---------|
| `add_role()` | `addBpmnRole()` | Define expert role |
| `add_knowledge()` | `addBpmnKnowledge()` | Provide modeling language knowledge |
| `add_knowledge_about_resources()` | Included in `addBpmnKnowledge()` | Resource awareness (pools/lanes) |
| `negative_prompting()` | `addNegativePrompting()` | List common mistakes |
| `add_few_shots()` | `buildMessagesWithExamples()` | Few-shot learning with errors |
| `create_conversation()` | `createBpmnConversation()` | Initial conversation setup |
| `update_conversation()` | `updateBpmnConversation()` | Feedback incorporation |
| `model_self_improvement_prompt()` | `getBpmnSelfImprovementPrompt()` | Self-improvement prompts |

## Future Enhancements

1. **More Examples**: Add examples for complex scenarios (loops, error handling, subprocesses)
2. **Domain-Specific Knowledge**: Add industry-specific BPMN patterns
3. **Validation Rules**: Expand validation rules based on common errors
4. **Performance Optimization**: Cache frequently used prompt components
5. **A/B Testing**: Compare prompt variations for effectiveness

## Notes

- The refactoring maintains backward compatibility with existing code
- Language support is preserved and enhanced
- All existing tests should continue to pass
- The new structure makes it easier to add new diagram types (DMN, CMMN, etc.)

