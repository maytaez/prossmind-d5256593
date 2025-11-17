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

  try {
    const { prompt, diagramType = 'bpmn' } = await req.json();
    console.log('Generating BPMN for prompt:', prompt);

    // Generate hash for exact cache lookup
    const promptHash = await generateHash(`${prompt}:${diagramType}`);

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
    const { model, maxTokens, temperature, complexityScore } = modelSelection;
    modelUsed = model;
    
    console.log(`Using model: ${model} (complexity score: ${complexityScore}, max tokens: ${maxTokens}, reasoning: ${modelSelection.reasoning})`);

    // Check semantic cache if enabled and exact hash missed
    if (isSemanticCacheEnabled()) {
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
      if (response.status === 429) {
        console.error('Rate limit exceeded');
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Google Gemini API error:', response.status, errorText);
      throw new Error('Failed to generate BPMN');
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

    // Store in cache (async, don't wait)
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

    const responseTime = Date.now() - startTime;

    // Log performance metric
    await logPerformanceMetric({
      function_name: 'generate-bpmn',
      cache_type: cacheType,
      model_used: modelUsed,
      prompt_length: prompt.length,
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

  } catch (error) {
    errorOccurred = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-bpmn function:', error);
    
    const responseTime = Date.now() - startTime;
    await logPerformanceMetric({
      function_name: 'generate-bpmn',
      cache_type: cacheType,
      model_used: modelUsed,
      prompt_length: prompt?.length || 0,
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
