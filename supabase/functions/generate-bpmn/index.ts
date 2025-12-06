import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../_shared/metrics.ts';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../_shared/prompts.ts';
import { analyzePrompt, selectModel } from '../_shared/model-selection.ts';

/**
 * Check if XML appears to be truncated/incomplete
 */
function isXmlIncomplete(xml: string): boolean {
  const trimmed = xml.trim();
  
  // Check for incomplete waypoint tags (most common truncation point)
  // Pattern: <di:waypoint x="..." y="..." (missing closing /> or >)
  // Use multiline mode to catch incomplete tags at end of string
  if (/<di:waypoint\s+[^>]*$/m.test(trimmed)) {
    return true;
  }
  
  // Check for incomplete waypoint tags with partial attributes
  // Pattern: <di:waypoint x="123 y="456 (incomplete, missing quotes or closing)
  if (/<di:waypoint\s+[^>]*[xXyY]="[^"]*$/m.test(trimmed)) {
    return true;
  }
  
  // More specific: Check if it ends with <di:waypoint followed by just "x" or "y"
  // Pattern: <di:waypoint x or <di:waypoint y (very incomplete)
  if (/<di:waypoint\s+[xXyY]\s*$/m.test(trimmed)) {
    return true;
  }
  
  // Check for incomplete attribute values (unclosed quotes)
  const openQuotes = (trimmed.match(/="[^"]*$/gm) || []).length;
  if (openQuotes > 0) {
    return true;
  }
  
  // Check if XML ends abruptly (not with proper closing tags)
  if (!trimmed.endsWith('>') && !trimmed.endsWith('/>') && !trimmed.endsWith('</bpmn:definitions>')) {
    // But allow if it ends with whitespace before a tag
    if (!trimmed.match(/>\s*$/)) {
      return true;
    }
  }
  
  // Check if XML doesn't end with proper closing tag
  if (!trimmed.endsWith('</bpmn:definitions>') && trimmed.includes('<bpmn:definitions')) {
    // Check if it's just missing the closing tag (has all content)
    const lastTag = trimmed.lastIndexOf('>');
    if (lastTag > 0 && lastTag < trimmed.length - 10) {
      // There's content after the last tag, might be incomplete
      const afterLastTag = trimmed.substring(lastTag + 1).trim();
      if (afterLastTag && !afterLastTag.startsWith('<')) {
        return true;
      }
    }
  }
  
  // Final check: if the last 50 characters contain an incomplete waypoint tag
  const last50 = trimmed.substring(Math.max(0, trimmed.length - 50));
  if (/<di:waypoint\s+[^>]*$/.test(last50)) {
    return true;
  }
  
  // Very specific check: ends with <di:waypoint followed by just "x" or space and "x"
  // This catches cases like: <di:waypoint x
  if (trimmed.match(/<di:waypoint\s+x\s*$/)) {
    return true;
  }
  
  // Check if it ends with <di:waypoint and any partial attribute
  if (trimmed.match(/<di:waypoint\s+[^>]*[^/>]\s*$/)) {
    return true;
  }
  
  return false;
}

/**
 * Fix truncated/incomplete XML by removing incomplete tags and closing properly
 */
function fixIncompleteXml(xml: string): string {
  let fixed = xml.trim();
  
  // More aggressive: Find the last occurrence of an incomplete waypoint tag
  // and remove everything from that point onwards
  // Pattern: <di:waypoint followed by attributes but no closing />
  const incompleteWaypointRegex = /<di:waypoint\s+[^>]*$/m;
  let match = fixed.match(incompleteWaypointRegex);
  if (match) {
    const startIndex = fixed.lastIndexOf(match[0]);
    if (startIndex >= 0) {
      // Remove from the start of the incomplete tag
      fixed = fixed.substring(0, startIndex).trim();
    }
  }
  
  // Also check for the very specific case: <di:waypoint x (just "x" after the tag)
  const incompleteWaypointXRegex = /<di:waypoint\s+x\s*$/m;
  match = fixed.match(incompleteWaypointXRegex);
  if (match) {
    const startIndex = fixed.lastIndexOf(match[0]);
    if (startIndex >= 0) {
      fixed = fixed.substring(0, startIndex).trim();
    }
  }
  
  // Check for <di:waypoint followed by any incomplete attribute pattern
  const incompleteWaypointAnyRegex = /<di:waypoint\s+[^/>]*[^/>]\s*$/m;
  match = fixed.match(incompleteWaypointAnyRegex);
  if (match && !match[0].includes('/>') && !match[0].includes('>')) {
    const startIndex = fixed.lastIndexOf(match[0]);
    if (startIndex >= 0) {
      fixed = fixed.substring(0, startIndex).trim();
    }
  }
  
  // Also check for incomplete waypoint tags that might have partial attributes
  // Pattern: <di:waypoint x="123 (incomplete, no closing quote or />)
  const incompleteWaypointPartialRegex = /<di:waypoint\s+[xXyY]="[^"]*$/m;
  const partialMatch = fixed.match(incompleteWaypointPartialRegex);
  if (partialMatch) {
    const startIndex = fixed.lastIndexOf(partialMatch[0]);
    if (startIndex >= 0) {
      fixed = fixed.substring(0, startIndex).trim();
    }
  }
  
  // Remove incomplete attribute declarations at the end
  // Pattern: x="123 y="456 (incomplete quotes) - but only if not part of a complete tag
  fixed = fixed.replace(/[xXyY]="[^"]*$/gm, '');
  
  // Remove incomplete tags at the end (tags that don't close)
  // Pattern: <bpmndi:BPMNEdge (incomplete, no closing >)
  const lastIncompleteTag = fixed.match(/<[^/>]+$/);
  if (lastIncompleteTag) {
    const startIndex = fixed.lastIndexOf(lastIncompleteTag[0]);
    if (startIndex >= 0) {
      fixed = fixed.substring(0, startIndex).trim();
    }
  }
  
  // Find the last complete tag (ends with > or />)
  const lastCompleteTagIndex = Math.max(
    fixed.lastIndexOf('/>'),
    fixed.lastIndexOf('>')
  );
  
  if (lastCompleteTagIndex > 0) {
    // Remove everything after the last complete tag
    fixed = fixed.substring(0, lastCompleteTagIndex + 1).trim();
  }
  
  // Remove any trailing incomplete content (text after last >)
  const lastGreaterThan = fixed.lastIndexOf('>');
  if (lastGreaterThan >= 0 && lastGreaterThan < fixed.length - 1) {
    const afterLastTag = fixed.substring(lastGreaterThan + 1).trim();
    // If there's content after the last tag that doesn't look like valid XML, remove it
    if (afterLastTag && !afterLastTag.startsWith('<')) {
      fixed = fixed.substring(0, lastGreaterThan + 1).trim();
    }
  }
  
  return fixed;
}

/**
 * Ensure XML has all required closing tags
 */
function ensureXmlComplete(xml: string): string {
  let complete = xml.trim();
  
  // Count opening and closing tags for major BPMN elements
  // Note: We need to count self-closing tags separately
  const tagPairs: { [key: string]: { open: RegExp; selfClosing: RegExp; close: string } } = {
    'definitions': { 
      open: /<bpmn:definitions(?![^>]*\/>)/gi, 
      selfClosing: /<bpmn:definitions[^>]*\/>/gi,
      close: '</bpmn:definitions>' 
    },
    'process': { 
      open: /<bpmn:process(?![^>]*\/>)/gi, 
      selfClosing: /<bpmn:process[^>]*\/>/gi,
      close: '</bpmn:process>' 
    },
    'collaboration': { 
      open: /<bpmn:collaboration(?![^>]*\/>)/gi, 
      selfClosing: /<bpmn:collaboration[^>]*\/>/gi,
      close: '</bpmn:collaboration>' 
    },
    'diagram': { 
      open: /<bpmndi:BPMNDiagram(?![^>]*\/>)/gi, 
      selfClosing: /<bpmndi:BPMNDiagram[^>]*\/>/gi,
      close: '</bpmndi:BPMNDiagram>' 
    },
    'plane': { 
      open: /<bpmndi:BPMNPlane(?![^>]*\/>)/gi, 
      selfClosing: /<bpmndi:BPMNPlane[^>]*\/>/gi,
      close: '</bpmndi:BPMNPlane>' 
    },
  };
  
  // Check and close missing tags (in reverse order of nesting)
  const closingOrder = ['plane', 'diagram', 'process', 'collaboration', 'definitions'];
  
  for (const tagName of closingOrder) {
    const tagInfo = tagPairs[tagName];
    const openMatches = complete.match(tagInfo.open);
    const selfClosingMatches = complete.match(tagInfo.selfClosing);
    const closeMatches = complete.match(new RegExp(tagInfo.close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
    
    const openCount = openMatches ? openMatches.length : 0;
    const selfClosingCount = selfClosingMatches ? selfClosingMatches.length : 0;
    const closeCount = closeMatches ? closeMatches.length : 0;
    
    // Total opened = explicitly opened (not self-closing) + self-closing
    // Total closed = explicitly closed + self-closing
    const totalOpened = openCount + selfClosingCount;
    const totalClosed = closeCount + selfClosingCount;
    
    if (totalOpened > totalClosed) {
      // Add missing closing tags
      const missing = totalOpened - totalClosed;
      for (let i = 0; i < missing; i++) {
        complete += '\n' + tagInfo.close;
      }
    }
  }
  
  return complete;
}

/**
 * Apply quick sanitization fixes for common LLM BPMN XML mistakes.
 */
function sanitizeBpmnXml(xml: string): string {
  let sanitized = xml;

  // First, check if XML is incomplete and try to fix it
  if (isXmlIncomplete(sanitized)) {
    console.warn('Detected incomplete XML, attempting to fix...');
    sanitized = fixIncompleteXml(sanitized);
  }

  // Fix namespace issues: bpmns: -> bpmn:
  sanitized = sanitized.replace(/bpmns:/gi, 'bpmn:');

  // Fix bpmndi namespace issues
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, 'bpmndi:BPMNShape');
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, 'bpmndi:BPMNEdge');

  // Fix truncated waypoint tags first (incomplete attributes at end of string)
  // Pattern: <di:waypoint x="123 y="456 (incomplete, no closing)
  sanitized = sanitized.replace(/<di:waypoint\s+[^>]*$/gm, '');
  
  // Fix unclosed di:waypoint tags - they should be self-closing
  // Pattern: <di:waypoint x="..." y="..."> should become <di:waypoint x="..." y="..."/>
  // Match opening tags that don't end with /> and convert them to self-closing
  sanitized = sanitized.replace(/<(\s*)di:waypoint\s+([^>]*?)>/gi, (match: string, whitespace: string, attrs: string) => {
    // If it doesn't end with />, make it self-closing
    if (!match.trim().endsWith('/>')) {
      // Clean up attributes - remove incomplete attribute values
      const cleanAttrs = attrs.replace(/[xXyY]="[^"]*$/g, '').trim();
      if (cleanAttrs) {
        return `<${whitespace}di:waypoint ${cleanAttrs}/>`;
      }
      return `<${whitespace}di:waypoint/>`;
    }
    return match;
  });
  
  // Fix any remaining unclosed waypoint tags without attributes (shouldn't happen but be safe)
  sanitized = sanitized.replace(/<(\s*)di:waypoint\s*>/gi, '<$1di:waypoint/>');

  // Remove invalid tags that don't exist in BPMN 2.0 (flowNodeRef is not a valid element)
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmns:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\/\s*bpmn:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\/\s*bpmns:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?\s*>/gi, '');

  // Fix XML declaration issues
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');

  // Fix unescaped ampersands
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  // Remove orphaned closing tags (tags that don't have matching opening tags)
  sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, '');

  // Ensure XML is complete with all closing tags
  sanitized = ensureXmlComplete(sanitized);

  return sanitized.trim();
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let cacheType: 'exact_hash' | 'semantic' | 'none' = 'none';
  let similarityScore: number | undefined;
  let modelUsed: string | undefined;
  let errorOccurred = false;
  let errorMessage: string | undefined;
  let prompt: string | undefined;
  let promptLength = 0;

  try {
    // Parse request body with error handling
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    prompt = requestData.prompt;
    const diagramType = requestData.diagramType || 'bpmn';
    const skipCache = requestData.skipCache === true; // Check if caching should be skipped
    const modelingAgentMode = requestData.modelingAgentMode === true; // Modeling agent mode flag
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    
    promptLength = prompt.length;
    console.log('Generating BPMN for prompt:', prompt);
    console.log('Request flags - skipCache:', skipCache, 'modelingAgentMode:', modelingAgentMode, 'diagramType:', diagramType);
    
    // Generate hash (needed for potential cache storage even if skipping cache lookup)
    let promptHash: string;
    try {
      promptHash = await generateHash(`${prompt}:${diagramType}`);
    } catch (hashError) {
      console.error('Failed to generate hash:', hashError);
      throw new Error('Failed to generate prompt hash');
    }
    
    if (skipCache || modelingAgentMode) {
      console.log('Cache disabled for this request (modeling agent mode)');
    } else {
      // Check exact hash cache first
      let exactCache;
      try {
        exactCache = await checkExactHashCache(promptHash, diagramType);
      } catch (cacheError) {
        console.warn('Cache check failed, continuing with generation:', cacheError);
        exactCache = null;
      }
      if (exactCache) {
        console.log('Exact hash cache hit');
        
        // Validate cached XML before returning it
        let cachedXml = exactCache.bpmnXml;
        
        // Log the end of the XML for debugging
        const xmlEnd = cachedXml.trim().substring(Math.max(0, cachedXml.length - 100));
        console.log('[Cache Validation] Checking exact cache XML, last 100 chars:', xmlEnd);
        
        // Check if XML is incomplete or invalid
        const isIncomplete = isXmlIncomplete(cachedXml);
        const hasProperEnding = cachedXml.trim().endsWith('</bpmn:definitions>');
        
        if (isIncomplete || !hasProperEnding) {
          console.warn('[Cache Validation] Exact cached XML is invalid or incomplete:', {
            isIncomplete,
            hasProperEnding,
            xmlLength: cachedXml.length,
            last50Chars: cachedXml.trim().substring(Math.max(0, cachedXml.length - 50))
          });
          
          // Try to fix the cached XML
          cachedXml = sanitizeBpmnXml(cachedXml);
          
          // Check again if it's still invalid
          const stillIncomplete = isXmlIncomplete(cachedXml);
          const stillNoEnding = !cachedXml.trim().endsWith('</bpmn:definitions>');
          
          if (stillIncomplete || stillNoEnding) {
            console.warn('[Cache Validation] Exact cached XML could not be fixed, will regenerate:', {
              stillIncomplete,
              stillNoEnding,
              fixedXmlLength: cachedXml.length,
              last50Chars: cachedXml.trim().substring(Math.max(0, cachedXml.length - 50))
            });
            // Continue to generation instead of returning invalid cache
            exactCache = null;
          } else {
            console.log('[Cache Validation] Exact cached XML fixed successfully');
          }
        }
        
        if (exactCache) {
          cacheType = 'exact_hash';
          const responseTime = Date.now() - startTime;
          
          await logPerformanceMetric({
            function_name: 'generate-bpmn',
            cache_type: 'exact_hash',
            prompt_length: prompt.length,
            response_time_ms: responseTime,
            cache_hit: true,
            error_occurred: false,
          });

          return new Response(
            JSON.stringify({ bpmnXml: cachedXml, cached: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      const availableEnvVars = Object.keys(Deno.env.toObject()).filter(k => k.includes('GOOGLE') || k.includes('API'));
      console.error('Available env vars with GOOGLE/API:', availableEnvVars);
      throw new Error('Google API key not configured. Please set GOOGLE_API_KEY environment variable.');
    }

    // Use optimized prompts from shared module
    let systemPrompt: string;
    let criteria: any;
    let modelSelection: any;
    let model: string;
    let maxTokens: number;
    let temperature: number;
    let complexityScore: number;
    
    try {
      systemPrompt = diagramType === 'pid' ? getPidSystemPrompt() : getBpmnSystemPrompt();
      
      // Determine model based on prompt complexity using shared utility
      criteria = analyzePrompt(prompt, diagramType);
      modelSelection = selectModel(criteria);
      ({ model, maxTokens, temperature, complexityScore } = modelSelection);
    } catch (promptError) {
      console.error('Error in prompt/model selection:', promptError);
      throw new Error(`Failed to prepare prompts: ${promptError instanceof Error ? promptError.message : String(promptError)}`);
    }
    
    // Comprehensive logging for model selection
    console.log('[Model Selection] Criteria:', {
      promptLength: criteria.promptLength,
      hasMultiplePools: criteria.hasMultiplePools,
      hasComplexGateways: criteria.hasComplexGateways,
      hasSubprocesses: criteria.hasSubprocesses,
      hasMultipleParticipants: criteria.hasMultipleParticipants,
      hasErrorHandling: criteria.hasErrorHandling,
      hasDataObjects: criteria.hasDataObjects,
      hasMessageFlows: criteria.hasMessageFlows,
      diagramType: criteria.diagramType
    });
    
    console.log('[Model Selection] Initial Selection:', {
      model,
      maxTokens,
      temperature,
      complexityScore,
      reasoning: modelSelection.reasoning
    });
    
    // Adjust temperature for modeling agent mode
    // For complex prompts (Pro model), use lower temperature for more deterministic outputs
    // For simpler prompts (Flash model), slightly increase for variation
    const originalTemperature = temperature;
    if (modelingAgentMode) {
      if (model === 'google/gemini-2.5-pro') {
        // Pro model: Keep temperature low (0.3-0.4) for complex, prescriptive prompts
        // This ensures more accurate adherence to complex requirements
        temperature = Math.min(temperature + 0.1, 0.4);
        console.log(`[Model Selection] Slightly increased temperature from ${originalTemperature} to ${temperature} for Pro model (modeling agent mode)`);
      } else {
        // Flash model: Moderate increase for variation (0.5 -> 0.7)
        temperature = Math.min(temperature + 0.2, 0.7);
        console.log(`[Model Selection] Increased temperature from ${originalTemperature} to ${temperature} for Flash model (modeling agent mode variation)`);
      }
    }
    
    modelUsed = model;
    
    console.log(`[Model Selection] Final Configuration: ${model} (complexity score: ${complexityScore}, max tokens: ${maxTokens}, temperature: ${temperature}, reasoning: ${modelSelection.reasoning})`);

    // Check semantic cache if enabled and exact hash missed (skip if cache disabled)
    if (!skipCache && !modelingAgentMode && isSemanticCacheEnabled()) {
      try {
        const embedding = await generateEmbedding(prompt);
        const semanticCache = await checkSemanticCache(
          embedding,
          diagramType,
          getSemanticSimilarityThreshold()
        );

        if (semanticCache) {
          console.log(`Semantic cache hit (similarity: ${semanticCache.similarity})`);
          
          // Validate cached XML before returning it
          let cachedXml = semanticCache.bpmnXml;
          
          // Log the end of the XML for debugging
          const xmlEnd = cachedXml.trim().substring(Math.max(0, cachedXml.length - 100));
          console.log('[Cache Validation] Checking semantic cache XML, last 100 chars:', xmlEnd);
          
          // Check if XML is incomplete or invalid
          const isIncomplete = isXmlIncomplete(cachedXml);
          const hasProperEnding = cachedXml.trim().endsWith('</bpmn:definitions>');
          
          if (isIncomplete || !hasProperEnding) {
            console.warn('[Cache Validation] Semantic cached XML is invalid or incomplete:', {
              isIncomplete,
              hasProperEnding,
              xmlLength: cachedXml.length,
              last50Chars: cachedXml.trim().substring(Math.max(0, cachedXml.length - 50))
            });
            
            // Try to fix the cached XML
            cachedXml = sanitizeBpmnXml(cachedXml);
            
            // Check again if it's still invalid
            const stillIncomplete = isXmlIncomplete(cachedXml);
            const stillNoEnding = !cachedXml.trim().endsWith('</bpmn:definitions>');
            
            if (stillIncomplete || stillNoEnding) {
              console.warn('[Cache Validation] Semantic cached XML could not be fixed, will regenerate:', {
                stillIncomplete,
                stillNoEnding,
                fixedXmlLength: cachedXml.length,
                last50Chars: cachedXml.trim().substring(Math.max(0, cachedXml.length - 50))
              });
              // Continue to generation instead of returning invalid cache
              // Don't return, let it fall through to generation
            } else {
              console.log('[Cache Validation] Semantic cached XML fixed successfully');
            }
          }
          
          // Only return if we have valid XML
          const finalIsIncomplete = isXmlIncomplete(cachedXml);
          const finalHasEnding = cachedXml.trim().endsWith('</bpmn:definitions>');
          
          if (!finalIsIncomplete && finalHasEnding) {
            cacheType = 'semantic';
            similarityScore = semanticCache.similarity;
            const responseTime = Date.now() - startTime;

            await logPerformanceMetric({
              function_name: 'generate-bpmn',
              cache_type: 'semantic',
              prompt_length: prompt.length,
              complexity_score: complexityScore,
              response_time_ms: responseTime,
              cache_hit: true,
              similarity_score: semanticCache.similarity,
              error_occurred: false,
            });

            return new Response(
              JSON.stringify({
                bpmnXml: cachedXml,
                cached: true,
                similarity: semanticCache.similarity,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            console.warn('Semantic cache XML invalid, skipping cache and regenerating');
          }
        }
      } catch (embeddingError) {
        console.warn('Semantic cache check failed, continuing with generation:', embeddingError);
        // Continue with normal generation if semantic cache fails
      }
    }

    // Map Lovable AI model names to Gemini model names
    const geminiModel = model.replace('google/', '');
    
    // Build messages array for Gemini format
    let messages: Array<{ role: string; content: string }>;
    let systemMessage: any;
    let userMessages: Array<{ role: string; content: string }>;
    
    try {
      messages = buildMessagesWithExamples(systemPrompt, prompt, diagramType);
      systemMessage = messages.find((m: any) => m.role === 'system');
      userMessages = messages.filter((m: any) => m.role === 'user');
    } catch (messageError) {
      console.error('Error building messages:', messageError);
      throw new Error(`Failed to build messages: ${messageError instanceof Error ? messageError.message : String(messageError)}`);
    }
    
    // Retry mechanism for handling transient API failures
    // Reduce retries for modeling agent mode to avoid rate limits when generating multiple variants in parallel
    const maxRetries = modelingAgentMode ? 2 : 3;
    const baseDelay = 1000; // 1 second
    let lastError: string | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: userMessages.map((m: any) => ({
                role: 'user',
                parts: [{ text: m.content }]
              })),
              systemInstruction: systemMessage ? {
                parts: [{ text: systemMessage.content }]
              } : undefined,
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: temperature
              }
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[API Error] Google Gemini API error:', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 500), // Limit error text length
            attempt: attempt + 1,
            maxRetries,
            model: modelUsed,
            promptLength: promptLength
          });
          
          // Rate limit - don't retry
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Google API rate limit exceeded. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Service overloaded - retry with backoff
          if (response.status === 503) {
            lastError = 'Google Gemini service is temporarily overloaded.';
            if (attempt < maxRetries - 1) {
              continue; // Retry
            }
            return new Response(
              JSON.stringify({ error: `${lastError} Please try again in a moment.` }),
              { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Other errors - don't retry
          return new Response(
            JSON.stringify({ error: `Google API error: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const finishReason = data.candidates?.[0]?.finishReason;
        console.log('[API Response] Received from Gemini:', {
          hasCandidates: !!data.candidates,
          candidateCount: data.candidates?.length || 0,
          hasContent: !!data.candidates?.[0]?.content,
          hasParts: !!data.candidates?.[0]?.content?.parts,
          partCount: data.candidates?.[0]?.content?.parts?.length || 0,
          finishReason: finishReason,
          safetyRatings: data.candidates?.[0]?.safetyRatings
        });
        
        let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!bpmnXml) {
          console.error('[API Response] Failed to extract BPMN XML from response. Full response:', JSON.stringify(data, null, 2));
          throw new Error('No content generated from AI model');
        }
        
        // Check if response was truncated due to token limit
        const isTruncatedByFinishReason = finishReason === 'MAX_TOKENS' || finishReason === 'OTHER';
        if (isTruncatedByFinishReason) {
          console.warn('[API Response] Response may be truncated (finishReason:', finishReason, ')');
        }
        
        console.log('[API Response] Extracted BPMN XML:', {
          length: bpmnXml.length,
          estimatedTokens: Math.ceil(bpmnXml.length / 4),
          first100Chars: bpmnXml.substring(0, 100),
          last100Chars: bpmnXml.substring(Math.max(0, bpmnXml.length - 100)),
          finishReason: finishReason
        });

        // Clean up the response - remove markdown code blocks if present
        bpmnXml = bpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

        // Quick check for incomplete XML BEFORE sanitization
        // IMPORTANT: Check for incomplete XML regardless of finishReason, as sometimes
        // the model stops without setting finishReason correctly
        const rawIsIncomplete = isXmlIncomplete(bpmnXml);
        const rawNoEnding = !bpmnXml.trim().endsWith('</bpmn:definitions>');
        const isIncomplete = rawIsIncomplete || rawNoEnding;
        
        // If XML is incomplete (regardless of finishReason), retry with higher maxTokens
        if (isIncomplete && attempt < maxRetries - 1) {
          const currentMaxTokens = maxTokens;
          // Gemini 2.5 Pro supports up to 65,536 output tokens
          // Gemini 2.5 Flash supports up to 8,192 output tokens
          const maxAllowedTokens = model === 'google/gemini-2.5-pro' ? 65536 : 8192;
          
          if (currentMaxTokens < maxAllowedTokens) {
            // Increase maxTokens more aggressively for incomplete XML
            // For Pro model: jump to at least 50% of max, or 1.5x current (whichever is higher)
            // For Flash model: use max available
            let newMaxTokens: number;
            if (model === 'google/gemini-2.5-pro') {
              const minTokens = Math.max(32768, Math.floor(currentMaxTokens * 1.5));
              newMaxTokens = Math.min(minTokens, maxAllowedTokens);
            } else {
              // Flash model: use max available
              newMaxTokens = maxAllowedTokens;
            }
            
            console.warn(`[Retry] XML incomplete (finishReason: ${finishReason}, incomplete: ${rawIsIncomplete}, noEnding: ${rawNoEnding}), retrying with higher maxTokens: ${currentMaxTokens} -> ${newMaxTokens}`);
            maxTokens = newMaxTokens;
            continue; // Retry with higher token limit
          } else {
            console.error('[Validation] XML incomplete but already at max tokens:', {
              finishReason,
              currentMaxTokens,
              maxAllowedTokens,
              attempt,
              maxRetries,
              rawIsIncomplete,
              rawNoEnding,
              last100Chars: bpmnXml.substring(Math.max(0, bpmnXml.length - 100))
            });
            throw new Error(`Generated BPMN XML was incomplete (maxTokens: ${currentMaxTokens} already at maximum). The diagram is too complex. Please try simplifying your prompt.`);
          }
        } else if (isIncomplete && attempt >= maxRetries - 1) {
          // All retries exhausted
          console.error('[Validation] XML incomplete after all retries:', {
            finishReason,
            maxTokens,
            attempt,
            maxRetries,
            rawIsIncomplete,
            rawNoEnding,
            last100Chars: bpmnXml.substring(Math.max(0, bpmnXml.length - 100))
          });
          throw new Error(`Generated BPMN XML was incomplete after ${maxRetries} attempts. The diagram may be too complex. Please try simplifying your prompt.`);
        }

        // Sanitize XML to fix common LLM mistakes
        bpmnXml = sanitizeBpmnXml(bpmnXml);

        console.log('Cleaned BPMN XML:', {
          length: bpmnXml.length,
          last200Chars: bpmnXml.substring(Math.max(0, bpmnXml.length - 200))
        });

        // Validate XML structure before caching (only cache valid responses)
        if (!bpmnXml.startsWith('<?xml')) {
          throw new Error('Generated content is not valid XML - missing XML declaration');
        }
        
        if (!bpmnXml.includes('<bpmn:definitions') && !bpmnXml.includes('<bpmn:Definitions')) {
          throw new Error('Generated BPMN XML is invalid or incomplete');
        }
        
        // Check if XML is still incomplete after sanitization
        const sanitizedIsIncomplete = isXmlIncomplete(bpmnXml);
        const sanitizedNoEnding = !bpmnXml.trim().endsWith('</bpmn:definitions>');
        const stillIncomplete = sanitizedIsIncomplete || sanitizedNoEnding;
        
        if (stillIncomplete) {
          console.error('[Validation] XML is still incomplete after sanitization');
          console.error('[Validation] Last 500 chars:', bpmnXml.substring(Math.max(0, bpmnXml.length - 500)));
          
          // Retry with higher tokens if we haven't exhausted retries
          if (attempt < maxRetries - 1) {
            const currentMaxTokens = maxTokens;
            // Gemini 2.5 Pro supports up to 65,536 output tokens
            // Gemini 2.5 Flash supports up to 8,192 output tokens
            const maxAllowedTokens = model === 'google/gemini-2.5-pro' ? 65536 : 8192;
            
            if (currentMaxTokens < maxAllowedTokens) {
              // Increase maxTokens more aggressively
              let newMaxTokens: number;
              if (model === 'google/gemini-2.5-pro') {
                const minTokens = Math.max(32768, Math.floor(currentMaxTokens * 1.5));
                newMaxTokens = Math.min(minTokens, maxAllowedTokens);
              } else {
                // Flash model: use max available
                newMaxTokens = maxAllowedTokens;
              }
              
              console.warn(`[Retry] XML incomplete after sanitization, retrying with higher maxTokens: ${currentMaxTokens} -> ${newMaxTokens}`);
              maxTokens = newMaxTokens;
              continue; // Retry with higher token limit
            } else {
              console.error('[Validation] XML incomplete after sanitization but already at max tokens');
              throw new Error(`Generated BPMN XML was incomplete (maxTokens: ${currentMaxTokens} already at maximum). The diagram is too complex. Please try simplifying your prompt.`);
            }
          } else {
            // All retries exhausted
            throw new Error(`Generated BPMN XML was incomplete after ${maxRetries} attempts. The diagram may be too complex. Please try simplifying your prompt.`);
          }
        }
        
        // Final validation: ensure XML ends with proper closing tags
        const trimmed = bpmnXml.trim();
        if (!trimmed.endsWith('</bpmn:definitions>')) {
          console.warn('[Validation] XML does not end with </bpmn:definitions>, checking if it can be fixed...');
          // Try to add missing closing tag if it's just missing
          if (trimmed.includes('<bpmn:definitions') && !trimmed.includes('</bpmn:definitions>')) {
            bpmnXml = trimmed + '\n</bpmn:definitions>';
            console.log('[Validation] Added missing </bpmn:definitions> tag');
          }
        }

        // Store in cache only after successful validation (async, don't wait) - skip if cache disabled
        if (!skipCache && !modelingAgentMode) {
          (async () => {
            try {
              let embedding: number[] | undefined;
              if (isSemanticCacheEnabled()) {
                try {
                  embedding = await generateEmbedding(prompt);
                } catch (e) {
                  console.warn('Failed to generate embedding for cache storage:', e);
                }
              }
              await storeExactHashCache(promptHash, prompt, diagramType, bpmnXml, embedding);
            } catch (cacheError) {
              console.error('Failed to store in cache:', cacheError);
            }
          })();
        } else {
          console.log('Skipping cache storage (modeling agent mode)');
        }

        const responseTime = Date.now() - startTime;

        // Log performance metric
        await logPerformanceMetric({
          function_name: 'generate-bpmn',
          cache_type: cacheType,
          model_used: modelUsed,
          prompt_length: promptLength,
          complexity_score: complexityScore,
          response_time_ms: responseTime,
          cache_hit: cacheType !== 'none',
          similarity_score: similarityScore,
          error_occurred: false,
        });

        return new Response(
          JSON.stringify({ bpmnXml, cached: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError) {
        console.error(`[API Request] Fetch attempt ${attempt + 1}/${maxRetries} failed:`, {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          stack: fetchError instanceof Error ? fetchError.stack : undefined,
          attempt: attempt + 1,
          maxRetries,
          willRetry: attempt < maxRetries - 1
        });
        lastError = fetchError instanceof Error ? fetchError.message : 'Network error';
        if (attempt < maxRetries - 1) {
          continue; // Retry
        }
      }
    }
    
    // If we get here, all retries failed
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);

  } catch (error) {
    errorOccurred = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Enhanced error logging
    console.error('Error in generate-bpmn function:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      promptLength,
      diagramType: prompt ? 'unknown' : 'unknown',
      modelUsed,
      cacheType
    });
    
    // Log error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    }
    
    const responseTime = Date.now() - startTime;
    
    // Try to log performance metric, but don't fail if it errors
    try {
      await logPerformanceMetric({
        function_name: 'generate-bpmn',
        cache_type: cacheType,
        model_used: modelUsed,
        prompt_length: promptLength,
        response_time_ms: responseTime,
        cache_hit: false,
        error_occurred: true,
        error_message: errorMessage,
      });
    } catch (metricError) {
      console.error('Failed to log performance metric:', metricError);
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
