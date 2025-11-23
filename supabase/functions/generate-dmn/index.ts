import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../_shared/metrics.ts';
import { getDmnSystemPrompt, buildMessagesWithExamples } from '../_shared/prompts.ts';
import { analyzePrompt, selectModel } from '../_shared/model-selection.ts';

/**
 * Extract XML from response text, handling cases where there's text before the XML.
 */
function extractXmlFromResponse(text: string): string {
  // First, try to find XML declaration
  const xmlDeclMatch = text.match(/<\?xml[^>]*\?>/i);
  if (xmlDeclMatch) {
    const xmlStart = text.indexOf(xmlDeclMatch[0]);
    // Extract from XML declaration onwards
    return text.substring(xmlStart).trim();
  }
  
  // If no XML declaration, try to find <definitions> tag
  const definitionsMatch = text.match(/<definitions[^>]*>/i) || text.match(/<Definitions[^>]*>/i);
  if (definitionsMatch) {
    const xmlStart = text.indexOf(definitionsMatch[0]);
    // Prepend XML declaration and extract from definitions tag onwards
    const xmlContent = text.substring(xmlStart).trim();
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
  }
  
  // If neither found, return the original text (will be caught by validation)
  return text.trim();
}

/**
 * Apply quick sanitization fixes for common LLM DMN XML mistakes.
 */
function sanitizeDmnXml(xml: string): string {
  let sanitized = xml;

  // Fix namespace issues
  sanitized = sanitized.replace(/dmn:/gi, '');
  
  // Fix unclosed tags - ensure all tags are properly closed
  sanitized = sanitized.replace(/<(\w+)([^>]*?)>/g, (match, tag, attrs) => {
    // Skip if it's a closing tag or already self-closing
    if (match.includes('</') || match.trim().endsWith('/>')) {
      return match;
    }
    // For known self-closing tags, ensure they're self-closing
    const selfClosingTags = ['inputEntry', 'outputEntry', 'text'];
    if (selfClosingTags.includes(tag)) {
      return `<${tag}${attrs}/>`;
    }
    return match;
  });

  // Fix unescaped ampersands
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  // Fix XML declaration issues
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');

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
    const skipCache = requestData.skipCache === true;
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }
    
    promptLength = prompt.length;
    console.log('Generating DMN for prompt:', prompt);
    
    // Generate hash
    let promptHash: string;
    try {
      promptHash = await generateHash(`${prompt}:dmn`);
    } catch (hashError) {
      console.error('Failed to generate hash:', hashError);
      throw new Error('Failed to generate prompt hash');
    }
    
    if (!skipCache) {
      // Check exact hash cache first
      let exactCache;
      try {
        exactCache = await checkExactHashCache(promptHash, 'dmn');
      } catch (cacheError) {
        console.warn('Cache check failed, continuing with generation:', cacheError);
        exactCache = null;
      }
      if (exactCache) {
        console.log('Exact hash cache hit');
        cacheType = 'exact_hash';
        const responseTime = Date.now() - startTime;
        
        await logPerformanceMetric({
          function_name: 'generate-dmn',
          cache_type: 'exact_hash',
          prompt_length: prompt.length,
          response_time_ms: responseTime,
          cache_hit: true,
          error_occurred: false,
        });

        return new Response(
          JSON.stringify({ dmnXml: exactCache.bpmnXml, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY not found in environment variables');
      throw new Error('Google API key not configured. Please set GOOGLE_API_KEY environment variable.');
    }

    // Use DMN system prompt
    const systemPrompt = getDmnSystemPrompt();
    
    // Determine model based on prompt complexity
    const criteria = analyzePrompt(prompt, 'bpmn'); // Use BPMN criteria for now
    const modelSelection = selectModel(criteria);
    const { model, maxTokens, temperature } = modelSelection;
    modelUsed = model;
    
    console.log(`[Model Selection] Using ${model} for DMN generation`);

    // Check semantic cache if enabled
    if (!skipCache && isSemanticCacheEnabled()) {
      try {
        const embedding = await generateEmbedding(prompt);
        const semanticCache = await checkSemanticCache(
          embedding,
          'dmn',
          getSemanticSimilarityThreshold()
        );

        if (semanticCache) {
          console.log(`Semantic cache hit (similarity: ${semanticCache.similarity})`);
          cacheType = 'semantic';
          similarityScore = semanticCache.similarity;
          const responseTime = Date.now() - startTime;

          await logPerformanceMetric({
            function_name: 'generate-dmn',
            cache_type: 'semantic',
            prompt_length: prompt.length,
            response_time_ms: responseTime,
            cache_hit: true,
            similarity_score: semanticCache.similarity,
            error_occurred: false,
          });

          return new Response(
            JSON.stringify({
              dmnXml: semanticCache.bpmnXml,
              cached: true,
              similarity: semanticCache.similarity,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (embeddingError) {
        console.warn('Semantic cache check failed, continuing with generation:', embeddingError);
      }
    }

    // Map model name to Gemini model name
    const geminiModel = model.replace('google/', '');
    
    // Build messages array for Gemini format
    const messages = buildMessagesWithExamples(systemPrompt, prompt, 'dmn');
    const systemMessage = messages.find((m: any) => m.role === 'system');
    const userMessages = messages.filter((m: any) => m.role === 'user');
    
    // Retry mechanism
    const maxRetries = 3;
    const baseDelay = 1000;
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
            errorText: errorText.substring(0, 500),
            attempt: attempt + 1,
            maxRetries,
            model: modelUsed,
            promptLength: promptLength
          });
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ error: 'Google API rate limit exceeded. Please try again later.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          if (response.status === 503) {
            lastError = 'Google Gemini service is temporarily overloaded.';
            if (attempt < maxRetries - 1) {
              continue;
            }
            return new Response(
              JSON.stringify({ error: `${lastError} Please try again in a moment.` }),
              { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ error: `Google API error: ${errorText}` }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        let rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!rawResponse) {
          console.error('[API Response] Failed to extract DMN XML from response. Full response:', JSON.stringify(data, null, 2));
          throw new Error('No content generated from AI model');
        }

        console.log('[API Response] Raw response (first 500 chars):', rawResponse.substring(0, 500));

        // Clean up the response - remove markdown code blocks if present
        rawResponse = rawResponse.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

        // Extract XML from response (handles cases where there's text before XML)
        let dmnXml = extractXmlFromResponse(rawResponse);

        // Sanitize XML to fix common LLM mistakes
        dmnXml = sanitizeDmnXml(dmnXml);

        console.log('[API Response] Extracted DMN XML (first 500 chars):', dmnXml.substring(0, 500));

        // Validate XML structure
        if (!dmnXml.startsWith('<?xml')) {
          console.error('[Validation Error] Missing XML declaration. First 200 chars:', dmnXml.substring(0, 200));
          throw new Error('Generated content is not valid XML - missing XML declaration');
        }
        
        if (!dmnXml.includes('<definitions') && !dmnXml.includes('<Definitions')) {
          console.error('[Validation Error] Missing definitions tag. First 200 chars:', dmnXml.substring(0, 200));
          throw new Error('Generated DMN XML is invalid or incomplete - missing definitions element');
        }

        // Store in cache (async, don't wait)
        if (!skipCache) {
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
              await storeExactHashCache(promptHash, prompt, 'dmn', dmnXml, embedding);
            } catch (cacheError) {
              console.error('Failed to store in cache:', cacheError);
            }
          })();
        }

        const responseTime = Date.now() - startTime;

        // Log performance metric
        await logPerformanceMetric({
          function_name: 'generate-dmn',
          cache_type: cacheType,
          model_used: modelUsed,
          prompt_length: promptLength,
          response_time_ms: responseTime,
          cache_hit: cacheType !== 'none',
          similarity_score: similarityScore,
          error_occurred: false,
        });

        return new Response(
          JSON.stringify({ dmnXml, cached: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (fetchError) {
        console.error(`[API Request] Fetch attempt ${attempt + 1}/${maxRetries} failed:`, {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          attempt: attempt + 1,
          maxRetries,
          willRetry: attempt < maxRetries - 1
        });
        lastError = fetchError instanceof Error ? fetchError.message : 'Network error';
        if (attempt < maxRetries - 1) {
          continue;
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);

  } catch (error) {
    errorOccurred = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Error in generate-dmn function:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      promptLength,
      modelUsed,
      cacheType
    });
    
    const responseTime = Date.now() - startTime;
    
    try {
      await logPerformanceMetric({
        function_name: 'generate-dmn',
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
