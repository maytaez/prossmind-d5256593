/* global Deno */
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../_shared/metrics.ts';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../_shared/prompts.ts';
import { analyzePrompt, selectModel } from '../_shared/model-selection.ts';
import { detectLanguage, getLanguageName } from '../_shared/language-detection.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
    toObject(): Record<string, string>;
  };
  serve: (handler: (req: Request) => Response | Promise<Response>) => Promise<void> | void;
};

declare const DOMParser: {
  new(): DOMParser;
};

declare const XMLSerializer: {
  new(): XMLSerializer;
};

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * Apply quick sanitization fixes for common LLM BPMN XML mistakes.
 */
function sanitizeBpmnXml(xml: string): string {
  if (!xml) {
    return xml;
  }

  let sanitized = xml.trim();

  // Strip anything that might precede the XML declaration (e.g., summaries, markdown)
  const xmlDeclarationIndex = sanitized.indexOf('<?xml');
  if (xmlDeclarationIndex > 0) {
    sanitized = sanitized.slice(xmlDeclarationIndex);
  }

  // If there's no XML declaration but we have definitions, prepend one
  if (xmlDeclarationIndex === -1 && /<\s*(?:bpmn:)?definitions\b/i.test(sanitized)) {
    sanitized = `${XML_DECLARATION}\n${sanitized}`;
  }

  // Fix namespace issues: bpmns: -> bpmn:
  sanitized = sanitized.replace(/bpmns:/gi, 'bpmn:');

  // Fix bpmndi namespace issues
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, 'bpmndi:BPMNShape');
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, 'bpmndi:BPMNEdge');

  // Normalize di:waypoint tags - ensure they are always self-closing and drop stray closing tags
  sanitized = sanitized
    // Convert <di:waypoint ...></di:waypoint> to self-closing
    .replace(/<\s*di:waypoint([^>]*?)>\s*<\/\s*di:waypoint\s*>/gi, '<di:waypoint$1/>')
    // Convert <di:waypoint ...> to self-closing when not already
    .replace(/<\s*di:waypoint([^>]*?)>(?!\s*<\/)/gi, (_match: string, attrs: string) => {
      const normalizedAttrs = attrs?.trim() ? ` ${attrs.trim().replace(/\s+/g, ' ')}` : '';
      return `<di:waypoint${normalizedAttrs}/>`;
    })
    // Remove any lingering closing tags
    .replace(/<\/\s*di:waypoint\s*>/gi, '');

  // Fix any remaining uppercase DI namespace variants (e.g., DI:waypoint)
  sanitized = sanitized
    .replace(/<\s*DI:waypoint([^>]*?)\/?>/g, (_match: string, attrs: string) => {
      const normalizedAttrs = attrs?.trim() ? ` ${attrs.trim().replace(/\s+/g, ' ')}` : '';
      return `<di:waypoint${normalizedAttrs}/>`;
    });

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

  return sanitized.trim();
}

/**
 * Parse and reserialize BPMN XML to guarantee well-formed output.
 * Also scrubs di:waypoint children so serialization produces self-closing tags.
 */
function normalizeBpmnXml(xml: string): string {
  if (!xml) {
    return xml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const parserErrors = doc.getElementsByTagName("parsererror");
    if (parserErrors.length) {
      const errorText = parserErrors[0]?.textContent || "Unknown parser error";
      throw new Error(`BPMN XML parse error: ${errorText}`);
    }

    const waypointSelectors = [
      "di\\:waypoint",
      "bpmndi\\:waypoint",
      "waypoint",
      "di\\:Waypoint",
    ];

    waypointSelectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((node) => {
        // Remove any child nodes/text to ensure serializer emits <di:waypoint .../>
        while (node.firstChild) {
          node.removeChild(node.firstChild);
        }
      });
    });

    const serializer = new XMLSerializer();
    let normalized = serializer.serializeToString(doc);
    if (!normalized.startsWith(XML_DECLARATION)) {
      normalized = `${XML_DECLARATION}\n${normalized}`;
    }
    return normalized.trim();
  } catch (error) {
    console.warn("[normalizeBpmnXml] Failed to normalize BPMN XML:", error);
    return xml;
  }
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

    // Detect language from user prompt FIRST (before cache check)
    const detectedLanguageCode = detectLanguage(prompt);
    const detectedLanguageName = getLanguageName(detectedLanguageCode);
    console.log(`Detected language: ${detectedLanguageName} (${detectedLanguageCode})`);

    // Generate hash (needed for potential cache storage even if skipping cache lookup)
    let promptHash: string;
    try {
      // Include language in the hash to avoid returning cached English responses for non-English prompts
      promptHash = await generateHash(`${prompt}:${diagramType}:${detectedLanguageCode}`);
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
          JSON.stringify({ bpmnXml: exactCache.bpmnXml, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      const availableEnvVars = Object.keys(Deno.env.toObject()).filter(k => k.includes('GOOGLE') || k.includes('API'));
      console.error('Available env vars with GOOGLE/API:', availableEnvVars);
      throw new Error('Google API key not configured. Please set GOOGLE_API_KEY environment variable.');
    }

    // Use optimized prompts from shared module with language awareness
    let systemPrompt: string;
    let criteria: any;
    let modelSelection: any;
    let model: string;
    let maxTokens: number;
    let temperature: number;
    let complexityScore: number;

    try {
      systemPrompt = diagramType === 'pid'
        ? getPidSystemPrompt(detectedLanguageCode, detectedLanguageName)
        : getBpmnSystemPrompt(detectedLanguageCode, detectedLanguageName);

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
              bpmnXml: semanticCache.bpmnXml,
              cached: true,
              similarity: semanticCache.similarity,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (embeddingError) {
        console.warn('Semantic cache check failed, continuing with generation:', embeddingError);
        // Continue with normal generation if semantic cache fails
      }
    }

    // Map Lovable AI model names to Gemini model names
    const geminiModel = model.replace('google/', '');

    // Build messages array for Gemini format with language awareness
    let messages: Array<{ role: string; content: string }>;
    let systemMessage: any;
    let userMessages: Array<{ role: string; content: string }>;

    try {
      messages = buildMessagesWithExamples(systemPrompt, prompt, diagramType, detectedLanguageCode, detectedLanguageName);
      systemMessage = messages.find((m: any) => m.role === 'system');
      userMessages = messages.filter((m: any) => m.role === 'user');
    } catch (messageError) {
      console.error('Error building messages:', messageError);
      throw new Error(`Failed to build messages: ${messageError instanceof Error ? messageError.message : String(messageError)}`);
    }


    // Log the final user prompt for debugging
    if (detectedLanguageCode !== 'en') {
      console.log(`User prompt with language instruction: ${userMessages[userMessages.length - 1]?.content?.substring(0, 200)}...`);
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
        console.log('[API Response] Received from Gemini:', {
          hasCandidates: !!data.candidates,
          candidateCount: data.candidates?.length || 0,
          hasContent: !!data.candidates?.[0]?.content,
          hasParts: !!data.candidates?.[0]?.content?.parts,
          partCount: data.candidates?.[0]?.content?.parts?.length || 0,
          finishReason: data.candidates?.[0]?.finishReason,
          safetyRatings: data.candidates?.[0]?.safetyRatings
        });

        let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!bpmnXml) {
          console.error('[API Response] Failed to extract BPMN XML from response. Full response:', JSON.stringify(data, null, 2));
          throw new Error('No content generated from AI model');
        }

        console.log('[API Response] Extracted BPMN XML:', {
          length: bpmnXml.length,
          estimatedTokens: Math.ceil(bpmnXml.length / 4),
          first100Chars: bpmnXml.substring(0, 100)
        });

        // Clean up the response - remove markdown code blocks if present
        bpmnXml = bpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

        // Sanitize XML to fix common LLM mistakes
        bpmnXml = sanitizeBpmnXml(bpmnXml);
        bpmnXml = normalizeBpmnXml(bpmnXml);

        console.log('Cleaned BPMN XML:', bpmnXml);

        // Ensure XML declaration is at the beginning even if the model prefixed explanations
        const declarationIndex = bpmnXml.indexOf('<?xml');
        if (declarationIndex > 0) {
          console.warn('[Sanitize] Trimming text before XML declaration');
          bpmnXml = bpmnXml.slice(declarationIndex);
        } else if (declarationIndex === -1) {
          const defsIndex = bpmnXml.search(/<\s*(?:bpmn:)?definitions\b/i);
          if (defsIndex >= 0) {
            console.warn('[Sanitize] Missing XML declaration, injecting standard header');
            bpmnXml = `${XML_DECLARATION}\n${bpmnXml.slice(defsIndex)}`;
          } else {
            throw new Error('Generated content is not valid XML - no <?xml declaration or <definitions> block detected');
          }
        }

        // Validate XML structure before caching (only cache valid responses)
        const hasDefinitions = /<\s*bpmn:definitions\b/i.test(bpmnXml) || /<\s*definitions\b/i.test(bpmnXml);
        if (!hasDefinitions) {
          throw new Error('Generated BPMN XML is invalid or incomplete');
        }

        // Store in cache only after successful validation (async, don't wait) - skip if cache disabled
        // Use language-aware hash for cache storage
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
              // Use the same language-aware hash for storage
              await storeExactHashCache(promptHash, prompt, diagramType, bpmnXml, embedding);
            } catch (cacheError) {
              console.error('Failed to store in cache:', cacheError);
            }
          })();
        } else if (modelingAgentMode) {
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
