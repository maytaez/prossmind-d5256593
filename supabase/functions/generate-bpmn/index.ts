import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../_shared/metrics.ts';
import { getBpmnSystemPrompt, getPidSystemPrompt, buildMessagesWithExamples } from '../_shared/prompts.ts';
import { analyzePrompt, selectModel } from '../_shared/model-selection.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
    const requestData = await req.json();
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
    const promptHash = await generateHash(`${prompt}:${diagramType}`);
    
    if (skipCache || modelingAgentMode) {
      console.log('Cache disabled for this request (modeling agent mode)');
    } else {
      // Check exact hash cache first
      const exactCache = await checkExactHashCache(promptHash, diagramType);
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
      console.error('GOOGLE_API_KEY not found');
      throw new Error('Google API key not configured');
    }

    // Use optimized prompts from shared module
    const systemPrompt = diagramType === 'pid' ? getPidSystemPrompt() : getBpmnSystemPrompt();

    // Determine model based on prompt complexity using shared utility
    const criteria = analyzePrompt(prompt, diagramType);
    const modelSelection = selectModel(criteria);
    let { model, maxTokens, temperature, complexityScore } = modelSelection;
    
    // Increase temperature for modeling agent mode to add variation
    if (modelingAgentMode && temperature < 0.9) {
      temperature = Math.min(temperature + 0.3, 1.0);
      console.log(`Increased temperature to ${temperature} for modeling agent mode variation`);
    }
    
    modelUsed = model;
    
    console.log(`Using model: ${model} (complexity score: ${complexityScore}, max tokens: ${maxTokens}, temperature: ${temperature}, reasoning: ${modelSelection.reasoning})`);

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
    
    // Build messages array for Gemini format
    const messages = buildMessagesWithExamples(systemPrompt, prompt, diagramType);
    const systemMessage = messages.find((m: any) => m.role === 'system');
    const userMessages = messages.filter((m: any) => m.role === 'user');
    
    // Retry mechanism for handling transient API failures
    const maxRetries = 3;
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
          console.error('Google Gemini API error:', response.status, errorText);
          
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
        console.log('AI Response received');
        
        let bpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!bpmnXml) {
          console.error('Failed to extract BPMN XML from response. Full response:', JSON.stringify(data));
          throw new Error('No content generated from AI model');
        }

        // Clean up the response - remove markdown code blocks if present
        bpmnXml = bpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

        console.log('Cleaned BPMN XML:', bpmnXml);

        // Validate XML structure before caching (only cache valid responses)
        if (!bpmnXml.startsWith('<?xml')) {
          throw new Error('Generated content is not valid XML - missing XML declaration');
        }
        
        if (!bpmnXml.includes('<bpmn:definitions') && !bpmnXml.includes('<bpmn:Definitions')) {
          throw new Error('Generated BPMN XML is invalid or incomplete');
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
        console.error(`Fetch attempt ${attempt + 1} failed:`, fetchError);
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
    console.error('Error in generate-bpmn function:', error);
    
    const responseTime = Date.now() - startTime;
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

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
