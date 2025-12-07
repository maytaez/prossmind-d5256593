import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../_shared/metrics.ts';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../_shared/prompts.ts';
import { analyzePrompt, selectModel } from '../_shared/model-selection.ts';
import { detectLanguage, getLanguageName } from '../_shared/language-detection.ts';
import { optimizeBpmnDI, estimateTokenCount, needsDIOptimization } from '../_shared/bpmn-di-optimizer.ts';
import { analyzePromptComplexity, simplifyPrompt, splitPromptIntoSubPrompts } from '../_shared/prompt-analyzer.ts';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorDetails?: string;
}

interface SummarizationResult {
  summarizedPrompt: string;
  wasSummarized: boolean;
}

function sanitizeBpmnXml(xml: string): string {
  let sanitized = xml;
  sanitized = sanitized.replace(/bpmns:/gi, 'bpmn:');
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, 'bpmndi:BPMNShape');
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, 'bpmndi:BPMNEdge');
  sanitized = sanitized.replace(/<\/\s*di:waypoint\s*>/gi, '');
  sanitized = sanitized.replace(/<(\s*)di:waypoint\s*([^>]*?)>/gi, (match: string, whitespace: string, attrs: string) => {
    if (match.includes('/>')) return match;
    const cleanAttrs = attrs.trim();
    return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
  });
  sanitized = sanitized.replace(/<(\s*)di:waypoint\s*([^>]*?)\s*\n\s*>/gi, (_match: string, whitespace: string, attrs: string) => {
    return `<${whitespace}di:waypoint ${attrs.trim().replace(/\s+/g, ' ')}/>`;
  });
  sanitized = sanitized.replace(/<(\s*)di:waypoint([^>]*?)([^\/])>/gi, (_match: string, whitespace: string, attrs: string) => {
    const cleanAttrs = attrs.trim();
    return cleanAttrs ? `<${whitespace}di:waypoint ${cleanAttrs}/>` : `<${whitespace}di:waypoint/>`;
  });
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmns:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\/\s*bpmn:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\/\s*bpmns:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, '');
  return sanitized.trim();
}

async function summarizeInputWithFlash(userPrompt: string, googleApiKey: string): Promise<SummarizationResult> {
  const shouldSummarize = userPrompt.length > 1500 || userPrompt.split('\n').length > 10;
  if (!shouldSummarize) return { summarizedPrompt: userPrompt, wasSummarized: false };
  console.log(`[Summarization] Summarizing prompt (length: ${userPrompt.length} chars)`);
  const summarizationPrompt = `You are a business process modeling assistant. Summarize and simplify the following prompt while preserving ALL critical information for BPMN 2.0 diagram generation.\n\nPreserve: workflow steps, decision points, participants/roles, sequence flows, exception handling, subprocesses, parallel activities, message flows, data objects.\n\nSimplify by: removing redundant explanations, consolidating similar concepts, using concise language.\n\nReturn ONLY the simplified prompt.\n\nOriginal prompt:\n${userPrompt}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: summarizationPrompt }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.3 } }),
    });
    if (!response.ok) { console.warn('[Summarization] Failed'); return { summarizedPrompt: userPrompt, wasSummarized: false }; }
    const data = await response.json();
    const summarized = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || userPrompt;
    if (summarized && summarized.length < userPrompt.length * 0.8) {
      console.log(`[Summarization] Success: ${userPrompt.length} -> ${summarized.length} chars`);
      return { summarizedPrompt: summarized, wasSummarized: true };
    }
    return { summarizedPrompt: userPrompt, wasSummarized: false };
  } catch (error) { console.warn('[Summarization] Error:', error); return { summarizedPrompt: userPrompt, wasSummarized: false }; }
}

function validateBpmnXml(xml: string): ValidationResult {
  if (!xml || typeof xml !== 'string') return { isValid: false, error: 'Invalid XML: empty or non-string input' };
  if (!xml.trim().startsWith('<?xml')) return { isValid: false, error: 'Missing XML declaration' };
  if (!xml.includes('<bpmn:definitions') && !xml.includes('<bpmn:Definitions') && !xml.includes('<definitions')) return { isValid: false, error: 'Missing BPMN definitions element' };
  if (!xml.includes('<bpmn:process') && !xml.includes('<process')) return { isValid: false, error: 'Missing BPMN process element' };
  if (!xml.includes('<bpmndi:BPMNDiagram') && !xml.includes('<bpmndi:BPMNPlane')) return { isValid: false, error: 'Missing BPMN diagram interchange' };
  const unclosedWaypoints = xml.match(/<di:waypoint[^>]*[^\/]>/gi);
  if (unclosedWaypoints && unclosedWaypoints.length > 0) return { isValid: false, error: 'Unclosed di:waypoint tags', errorDetails: `Found ${unclosedWaypoints.length} unclosed tags` };
  if (xml.includes('bpmns:') && !xml.includes('xmlns:bpmns=')) return { isValid: false, error: 'Invalid namespace prefix bpmns:' };
  return { isValid: true };
}

async function generateBpmnXmlWithGemini(simplifiedPrompt: string, systemPrompt: string, diagramType: 'bpmn' | 'pid', languageCode: string, languageName: string, googleApiKey: string, maxTokens: number, temperature: number, retryContext?: { error: string; errorDetails?: string; attemptNumber: number }): Promise<string> {
  let generationPrompt = simplifiedPrompt;
  if (retryContext) {
    generationPrompt = `${simplifiedPrompt}\n\n⚠️ CRITICAL: Previous BPMN XML failed validation: ${retryContext.error}${retryContext.errorDetails ? `\nDetails: ${retryContext.errorDetails}` : ''}\n\nFix: ensure all tags closed, di:waypoint self-closing, no invalid elements, proper namespaces.`;
  }
  const messages = buildMessagesWithExamples(systemPrompt, generationPrompt, diagramType, languageCode, languageName);
  const systemMessage = messages.find((m: any) => m.role === 'system');
  const userMessages = messages.filter((m: any) => m.role === 'user');
  console.log('[GEMINI REQUEST] Sending to Gemini 2.5 Pro');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${googleApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: userMessages.map((m: any) => ({ role: 'user', parts: [{ text: m.content }] })), systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined, generationConfig: { maxOutputTokens: maxTokens, temperature: temperature } }),
  });
  if (!response.ok) { const errorText = await response.text(); throw new Error(`Gemini API error: ${errorText}`); }
  const data = await response.json();
  let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!bpmnXml) throw new Error('No content generated from Gemini 2.5 Pro');
  bpmnXml = bpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();
  bpmnXml = sanitizeBpmnXml(bpmnXml);

  // Optimize BPMN DI to prevent truncation
  const beforeOptimization = bpmnXml.length;
  const estimatedTokens = estimateTokenCount(bpmnXml);

  // Use aggressive optimization if we're close to or over the token limit
  const aggressive = estimatedTokens > maxTokens * 0.8;
  if (needsDIOptimization(bpmnXml, maxTokens) || aggressive) {
    console.log(`[BPMN DI Optimization] Before: ${beforeOptimization} chars (~${estimatedTokens} tokens), aggressive: ${aggressive}`);
    bpmnXml = optimizeBpmnDI(bpmnXml, aggressive);
    const afterOptimization = bpmnXml.length;
    const reduction = ((beforeOptimization - afterOptimization) / beforeOptimization * 100).toFixed(1);
    console.log(`[BPMN DI Optimization] After: ${afterOptimization} chars (~${estimateTokenCount(bpmnXml)} tokens), reduced: ${reduction}%`);
  }

  console.log('[GEMINI RESPONSE] Final length:', bpmnXml.length);
  return bpmnXml;
}

async function retryBpmnGenerationIfNecessary(simplifiedPrompt: string, systemPrompt: string, diagramType: 'bpmn' | 'pid', languageCode: string, languageName: string, googleApiKey: string, maxTokens: number, temperature: number, maxAttempts: number = 3): Promise<string> {
  let lastValidationError: ValidationResult | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[BPMN Generation] Attempt ${attempt}/${maxAttempts}`);
    try {
      const bpmnXml = await generateBpmnXmlWithGemini(simplifiedPrompt, systemPrompt, diagramType, languageCode, languageName, googleApiKey, maxTokens, temperature, lastValidationError ? { error: lastValidationError.error || 'Validation failed', errorDetails: lastValidationError.errorDetails, attemptNumber: attempt } : undefined);
      const validation = validateBpmnXml(bpmnXml);
      if (validation.isValid) { console.log(`[BPMN Generation] Valid XML on attempt ${attempt}`); return bpmnXml; }
      lastValidationError = validation;
      console.warn(`[BPMN Generation] Validation failed attempt ${attempt}:`, validation.error);
      if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) { console.error(`[BPMN Generation] Error attempt ${attempt}:`, error); if (attempt === maxAttempts) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  throw new Error(`Failed to generate valid BPMN XML after ${maxAttempts} attempts. Last error: ${lastValidationError?.error || 'Unknown'}`);
}

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const startTime = Date.now();
  let cacheType: 'exact_hash' | 'semantic' | 'none' = 'none';
  let similarityScore: number | undefined;
  let modelUsed: string | undefined;
  let prompt: string | undefined;
  let promptLength = 0;
  try {
    let requestData;
    try { requestData = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    prompt = requestData.prompt;
    const diagramType = requestData.diagramType || 'bpmn';
    const skipCache = requestData.skipCache === true;
    const modelingAgentMode = requestData.modelingAgentMode === true;
    if (!prompt) throw new Error('Prompt is required');
    promptLength = prompt.length;
    console.log('Generating BPMN for prompt:', prompt);
    const detectedLanguageCode = modelingAgentMode ? 'en' : detectLanguage(prompt);
    const detectedLanguageName = modelingAgentMode ? 'English' : getLanguageName(detectedLanguageCode);
    console.log(`Language: ${detectedLanguageName} (${detectedLanguageCode})`);

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) throw new Error('Google API key not configured');

    // INTELLIGENT PROMPT ANALYSIS - Fast heuristics only (no AI calls to avoid timeout)
    let finalPromptToGenerate = prompt;
    let wasSimplified = false;
    let wasSplit = false;
    let subPrompts: string[] = [];


    if (!modelingAgentMode && promptLength > 1000) {  // Lowered from 1500
      console.log('[Prompt Analysis] Analyzing complexity with fast heuristics...');
      console.log(`[Prompt Analysis] Prompt length: ${promptLength}, modelingAgentMode: ${modelingAgentMode}`);

      // Use ONLY fast heuristics (no AI calls)
      const actors = (prompt.match(/actor|participant|role|department|system|service/gi) || []).length;
      const gateways = (prompt.match(/gateway|parallel|exclusive|inclusive|decision|branch|if|else/gi) || []).length;
      const events = (prompt.match(/event|timer|message|signal|error|boundary/gi) || []).length;
      const complexityScore = Math.min(10, Math.floor((actors * 1.5) + (gateways * 1.2) + (events * 1.0) + (promptLength / 500)));

      console.log(`[Prompt Analysis] Complexity score: ${complexityScore} (actors: ${actors}, gateways: ${gateways}, events: ${events}, length: ${promptLength})`);

      // MORE AGGRESSIVE: Split if ANY of these conditions are met
      if (complexityScore >= 8 || promptLength > 2000 || actors > 5 || gateways > 5) {  // Lowered thresholds
        // SPLIT - Return immediately without generating
        console.log(`[Prompt Analysis] SPLIT decision - too complex for single diagram`);
        console.log(`[Prompt Analysis] Criteria: score=${complexityScore}>=8, length=${promptLength}>2000, actors=${actors}>5, gateways=${gateways}>5`);

        // Simple split by sections (no AI call)
        const sentences = prompt.split(/\.\s+/);
        const third = Math.ceil(sentences.length / 3);

        subPrompts = [
          "Generate a BPMN 2.0 diagram for the initial phase: " + sentences.slice(0, third).join('. ') + '.',
          "Generate a BPMN 2.0 diagram for the processing phase: " + sentences.slice(third, third * 2).join('. ') + '.',
          "Generate a BPMN 2.0 diagram for the final phase: " + sentences.slice(third * 2).join('. ') + '.'
        ].filter(s => s.length > 100);

        console.log(`[Prompt Analysis] Created ${subPrompts.length} sub-prompts`);

        // Return split response immediately
        return new Response(JSON.stringify({
          requiresSplit: true,
          subPrompts,
          analysis: {
            complexity: { score: complexityScore, actors, gateways, events, estimatedXmlSize: promptLength * 45 },
            reasoning: `Very complex workflow (score: ${complexityScore}, ${actors} actors, ${promptLength} chars). Split into ${subPrompts.length} sub-prompts for better results.`
          },
          message: `This workflow is too complex for a single diagram. It has been split into ${subPrompts.length} sub-prompts for better results.`
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } else if (complexityScore >= 7 || promptLength > 2000) {
        // SIMPLIFY - Remove details but keep core flow
        console.log(`[Prompt Analysis] SIMPLIFY decision`);

        // Simple simplification: keep first sentence of each section
        const simplified = prompt
          .split(/\.\s+/)
          .filter((s, i) => i % 2 === 0 || s.includes('actor') || s.includes('flow'))
          .join('. ') + '.';

        finalPromptToGenerate = simplified.substring(0, 1500);
        wasSimplified = true;
        promptLength = finalPromptToGenerate.length;
        console.log(`[Prompt Analysis] Simplified: ${prompt.length} → ${finalPromptToGenerate.length} chars`);
      } else {
        console.log(`[Prompt Analysis] Complexity acceptable (score: ${complexityScore}), generating directly`);
      }
    }

    let promptHash: string;
    try { promptHash = await generateHash(`${finalPromptToGenerate}:${diagramType}:${detectedLanguageCode}`); } catch { throw new Error('Failed to generate prompt hash'); }
    if (!skipCache && !modelingAgentMode) {
      let exactCache; try { exactCache = await checkExactHashCache(promptHash, diagramType); } catch { exactCache = null; }
      if (exactCache) { cacheType = 'exact_hash'; await logPerformanceMetric({ function_name: 'generate-bpmn', cache_type: 'exact_hash', prompt_length: prompt.length, response_time_ms: Date.now() - startTime, cache_hit: true, error_occurred: false }); return new Response(JSON.stringify({ bpmnXml: exactCache.bpmnXml, cached: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
    }
    const criteria = analyzePrompt(finalPromptToGenerate, diagramType);
    const modelSelection = selectModel(criteria);
    let { model, temperature, maxTokens } = modelSelection;
    const { complexityScore } = modelSelection;

    // For very complex prompts, generate without DI to prevent truncation
    // The client will add layout using auto-layout algorithms
    const useNoDI = promptLength > 3000 || complexityScore >= 9;
    const useCompactDI = !useNoDI && (promptLength > 2000 || complexityScore >= 7);

    const systemPrompt = diagramType === 'pid'
      ? getPidSystemPrompt(detectedLanguageCode, detectedLanguageName)
      : getBpmnSystemPrompt(detectedLanguageCode, detectedLanguageName, false, false, useCompactDI, useNoDI);

    console.log(`[Model Selection] ${model} with ${maxTokens} tokens (complexity: ${complexityScore}, compactDI: ${useCompactDI}, noDI: ${useNoDI})`);
    if (modelingAgentMode) temperature = model === 'google/gemini-2.5-pro' ? Math.min(temperature + 0.1, 0.4) : Math.min(temperature + 0.2, 0.7);
    modelUsed = model;
    if (!skipCache && !modelingAgentMode && isSemanticCacheEnabled()) {
      try {
        const embedding = await generateEmbedding(finalPromptToGenerate);
        const semanticCache = await checkSemanticCache(embedding, diagramType, getSemanticSimilarityThreshold());
        if (semanticCache) { cacheType = 'semantic'; similarityScore = semanticCache.similarity; await logPerformanceMetric({ function_name: 'generate-bpmn', cache_type: 'semantic', prompt_length: promptLength, complexity_score: complexityScore, response_time_ms: Date.now() - startTime, cache_hit: true, similarity_score: semanticCache.similarity, error_occurred: false }); return new Response(JSON.stringify({ bpmnXml: semanticCache.bpmnXml, cached: true, similarity: semanticCache.similarity, wasSimplified }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
      } catch { /* continue */ }
    }

    // Use the analyzed/simplified prompt for generation
    const bpmnXml = await retryBpmnGenerationIfNecessary(finalPromptToGenerate, systemPrompt, diagramType, detectedLanguageCode, detectedLanguageName, GOOGLE_API_KEY, maxTokens, temperature, 3);
    modelUsed = 'google/gemini-2.5-pro';
    const finalValidation = validateBpmnXml(bpmnXml);
    if (!finalValidation.isValid) throw new Error(`Final validation failed: ${finalValidation.error}`);
    if (!skipCache && !modelingAgentMode) { (async () => { try { let embedding: number[] | undefined; if (isSemanticCacheEnabled()) { try { embedding = await generateEmbedding(finalPromptToGenerate); } catch { /* ignore */ } } await storeExactHashCache(promptHash, finalPromptToGenerate, diagramType, bpmnXml, embedding); } catch { /* ignore */ } })(); }
    await logPerformanceMetric({ function_name: 'generate-bpmn', cache_type: cacheType, model_used: modelUsed, prompt_length: promptLength, complexity_score: complexityScore, response_time_ms: Date.now() - startTime, cache_hit: cacheType !== 'none', similarity_score: similarityScore, error_occurred: false });
    return new Response(JSON.stringify({
      bpmnXml,
      cached: false,
      wasSimplified,
      originalPromptLength: wasSimplified ? prompt.length : undefined,
      simplifiedPromptLength: wasSimplified ? finalPromptToGenerate.length : undefined
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-bpmn:', errorMessage);
    try { await logPerformanceMetric({ function_name: 'generate-bpmn', cache_type: cacheType, model_used: modelUsed, prompt_length: promptLength, response_time_ms: Date.now() - startTime, cache_hit: false, error_occurred: true, error_message: errorMessage }); } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
