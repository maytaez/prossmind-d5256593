import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { generateHash, checkVisionCache, storeVisionCache, checkSemanticImageCache } from '../_shared/cache.ts';
import { logPerformanceMetric } from '../_shared/metrics.ts';
import { generateEmbedding, isSemanticCacheEnabled } from '../_shared/embeddings.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { imageBase64, diagramType = 'bpmn' } = await req.json();

    if (!imageBase64) {
      throw new Error('No image data provided');
    }
    
    console.log(`Processing ${diagramType.toUpperCase()} diagram`);

    // Create job record immediately
    const { data: job, error: jobError } = await supabase
      .from('vision_bpmn_jobs')
      .insert({
        user_id: user.id,
        image_data: imageBase64,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create job:', jobError);
      throw new Error('Failed to create processing job');
    }

    console.log('Job created:', job.id);

    // Start background processing
    const processJob = async () => {
      const startTime = Date.now();
      
      try {
        // Update status to processing
        await supabase
          .from('vision_bpmn_jobs')
          .update({ status: 'processing' })
          .eq('id', job.id);

        console.log('Processing document for BPMN generation for user:', user.id);

        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        
        if (!GOOGLE_API_KEY) {
          throw new Error('Google API key not configured');
        }

        // Determine if this is an image or text/document
        const isImage = imageBase64.startsWith('data:image/');
        const isPDF = imageBase64.startsWith('data:application/pdf');
        const isDocument = imageBase64.startsWith('data:application/vnd.openxmlformats') || 
                           imageBase64.startsWith('data:application/msword');
        const isText = imageBase64.startsWith('data:text/');

        // Generate image hash for caching (for images and PDFs)
        let imageHash: string | null = null;
        let bpmnXml = '';
        let cacheHit = false;
        let cacheType: 'exact_hash' | 'semantic' | 'none' = 'none';
        let selectedModel = 'gemini-2.5-pro'; // Track which model succeeded

        if (isImage || isPDF || isDocument) {
          // Extract base64 data (remove data URL prefix) and normalize
          const base64Data = imageBase64.includes(',') 
            ? imageBase64.split(',')[1].trim().replace(/\s+/g, '')
            : imageBase64.trim().replace(/\s+/g, '');
          
          imageHash = await generateHash(`${base64Data}:${diagramType}`);
          console.log('Generated image hash for cache lookup:', imageHash.substring(0, 16) + '...');

          // Check exact hash cache first
          const visionCache = await checkVisionCache(imageHash, diagramType);
          if (visionCache) {
            console.log('✅ EXACT VISION CACHE HIT - Found cached data for image hash:', imageHash.substring(0, 16) + '...');
            console.log('Cache entry ID:', visionCache.cacheId);
            cacheHit = true;
            cacheType = 'exact_hash';

            // If we have cached BPMN XML, use it and skip generation
            if (visionCache.bpmnXml) {
              console.log('✅ Using cached BPMN XML directly');
              bpmnXml = visionCache.bpmnXml;
              
              await supabase
                .from('vision_bpmn_jobs')
                .update({
                  bpmn_xml: visionCache.bpmnXml,
                  status: 'completed',
                  model_used: 'cached',
                  completed_at: new Date().toISOString()
                })
                .eq('id', job.id);

              const responseTime = Date.now() - startTime;
              await logPerformanceMetric({
                function_name: 'vision-to-bpmn',
                cache_type: cacheType,
                response_time_ms: responseTime,
                cache_hit: true,
                model_used: 'cached',
                error_occurred: false,
              });
              
              console.log('Job completed from exact cache:', job.id, 'in', responseTime, 'ms');
              return; // Exit early with cached result
            }
          } else {
            console.log('❌ Exact vision cache miss - No cached data found for hash:', imageHash.substring(0, 16) + '...');
            
            // Try semantic similarity search if enabled
            if (isSemanticCacheEnabled() && isImage && LOVABLE_API_KEY) {
              console.log('🔍 Attempting semantic image cache search...');
              try {
                // Generate embedding from image description for semantic search
                // First, get a quick description of the image
                const descriptionPrompt = `Describe this image briefly in 2-3 sentences focusing on: processes, workflows, diagrams, symbols, connections, and flow patterns.`;
                
                const semanticController = new AbortController();
                const semanticTimeoutId = setTimeout(() => semanticController.abort(), 15000); // 15s timeout
                
                const quickDescResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    model: 'google/gemini-2.5-flash',
                    messages: [
                      {
                        role: 'user',
                        content: [
                          { type: 'text', text: descriptionPrompt },
                          { type: 'image_url', image_url: { url: imageBase64 } }
                        ]
                      }
                    ],
                    max_tokens: 200
                  }),
                  signal: semanticController.signal
                });
                
                clearTimeout(semanticTimeoutId);

                if (quickDescResponse.ok) {
                  const descData = await quickDescResponse.json();
                  const imageDescription = descData.choices?.[0]?.message?.content || '';
                  
                  if (imageDescription) {
                    console.log('Generated image description for embedding:', imageDescription.substring(0, 100) + '...');
                    
                    // Generate embedding from description
                    const embedding = await generateEmbedding(imageDescription);
                    
                    // Check semantic cache
                    const semanticCache = await checkSemanticImageCache(embedding, diagramType, 0.80);
                    
                    if (semanticCache && semanticCache.bpmnXml) {
                      console.log('✅ SEMANTIC VISION CACHE HIT - Found similar image! Similarity:', semanticCache.similarity);
                      console.log('Cache entry ID:', semanticCache.cacheId);
                      cacheHit = true;
                      cacheType = 'semantic';
                      bpmnXml = semanticCache.bpmnXml;
                      
                      await supabase
                        .from('vision_bpmn_jobs')
                        .update({
                          bpmn_xml: semanticCache.bpmnXml,
                          status: 'completed',
                          model_used: 'cached',
                          completed_at: new Date().toISOString()
                        })
                        .eq('id', job.id);

                      const responseTime = Date.now() - startTime;
                      await logPerformanceMetric({
                        function_name: 'vision-to-bpmn',
                        cache_type: cacheType,
                        response_time_ms: responseTime,
                        cache_hit: true,
                        similarity_score: semanticCache.similarity,
                        model_used: 'cached',
                        error_occurred: false,
                      });
                      
                      console.log('Job completed from semantic cache:', job.id, 'in', responseTime, 'ms');
                      return; // Exit early with cached result
                    } else {
                      console.log('❌ Semantic vision cache miss - No similar images found');
                    }
                  }
                }
              } catch (embedError) {
                console.error('Error in semantic image cache search:', embedError);
                // Continue with normal generation if semantic search fails
              }
            }
          }

          // Prompts for generation
          const bpmnDirectPrompt = `Generate a professional BPMN 2.0 XML diagram directly from this image.

## OUTPUT: Return ONLY valid BPMN 2.0 XML starting with <?xml version="1.0" encoding="UTF-8"?>. No markdown, no explanations.

## STRUCTURE:
- Infer swimlanes from visual clusters/headers
- Create single unified flow (one Start, one End)
- Use gateways (diamonds) for any branching/decisions
- Preserve exact text from image (including typos)
- Connect all elements logically (top→bottom or left→right)

## ELEMENTS:
- Start Event: Circle labeled "Start Process"
- End Event: Bold circle labeled "End Process"  
- Tasks: Rectangles with extracted text
- Gateways: Diamonds with yes/no labels
- Swimlanes: One per major topic/group

Return ONLY the XML, no other text.`;

          const pidDirectPrompt = `Generate a complete P&ID diagram in BPMN 2.0 XML format directly from this image.

## OUTPUT: Return ONLY valid BPMN 2.0 XML with pid:type, pid:symbol, pid:category attributes. No markdown, no explanations.

## EXTRACT:
- Equipment: Tanks (TK-), Pumps (P-), Heat Exchangers (E-), Reactors (R-), Columns (C-), Compressors (K-)
- Valves: Gate, globe, ball, butterfly, check, control, safety (with ISA symbols)
- Instruments: FIC, TIC, PIC, LIC, PT, FT, TT, LT (ISA tags)
- Piping: Flow directions, line numbers, connections

## ATTRIBUTES:
- Equipment: pid:type="equipment" pid:symbol="tank|pump|valve|..." pid:category="mechanical|control|instrument"
- Connections: Use sequenceFlow for process lines, messageFlow for signals

Return ONLY the XML, no other text.`;

          const directPrompt = diagramType === 'pid' ? pidDirectPrompt : bpmnDirectPrompt;
          const systemPrompt = diagramType === 'pid' 
            ? `You are a P&ID expert. Generate complete BPMN 2.0 XML with pid:type, pid:symbol, pid:category attributes for P&ID elements.`
            : `You are a BPMN 2.0 expert. Generate valid BPMN 2.0 XML with horizontal swimlanes and decision gateways.`;

          // Fallback chain: Gemini Pro -> Gemini Flash (native) -> Lovable AI (GPT-5) -> Lovable AI (Gemini Flash)
          
          // Try Gemini 2.0 Flash Thinking (Pro-level)
          try {
            console.log('Attempting with gemini-2.0-flash-thinking-exp-01-21...');
            const directController = new AbortController();
            const directTimeoutId = setTimeout(() => directController.abort(), 120000);
            
            const modelEndpoint = 'gemini-2.0-flash-thinking-exp-01-21';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${GOOGLE_API_KEY}`;
            
            const directRequestBody = {
              contents: [{
                parts: [
                  { text: `${systemPrompt}\n\n${directPrompt}` },
                  {
                    inline_data: {
                      mime_type: imageBase64.split(';')[0].split(':')[1],
                      data: imageBase64.split(',')[1]
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 32768,
              }
            };

            const directResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(directRequestBody),
              signal: directController.signal
            });

            clearTimeout(directTimeoutId);

            if (directResponse.ok) {
              const directResult = await directResponse.json();
              bpmnXml = directResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (bpmnXml) {
                console.log('✅ Success with gemini-2.0-flash-thinking-exp-01-21');
                selectedModel = 'gemini-2.5-pro';
              } else {
                throw new Error('Empty response from primary model');
              }
            } else {
              throw new Error(`Primary model failed: ${directResponse.status}`);
            }
          } catch (primaryErr) {
            console.error('Primary model failed:', primaryErr);
            
            // Fallback 1: Try Gemini 2.5 Flash (native API)
            try {
              console.log('Falling back to gemini-2.5-flash (native)...');
              const fallbackController = new AbortController();
              const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 90000);
              
              const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
              
              const fallbackRequestBody = {
                contents: [{
                  parts: [
                    { text: `${systemPrompt}\n\n${directPrompt}` },
                    {
                      inline_data: {
                        mime_type: imageBase64.split(';')[0].split(':')[1],
                        data: imageBase64.split(',')[1]
                      }
                    }
                  ]
                }],
                generationConfig: {
                  temperature: 0.5,
                  maxOutputTokens: 12288,
                }
              };

              const fallbackResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fallbackRequestBody),
                signal: fallbackController.signal
              });

              clearTimeout(fallbackTimeoutId);

              if (fallbackResponse.ok) {
                const fallbackResult = await fallbackResponse.json();
                bpmnXml = fallbackResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (bpmnXml) {
                  console.log('✅ Success with gemini-2.5-flash (native)');
                  selectedModel = 'gemini-2.5-flash';
                } else {
                  throw new Error('Empty response from Gemini Flash');
                }
              } else {
                throw new Error(`Gemini Flash failed: ${fallbackResponse.status}`);
              }
            } catch (flashErr) {
              console.error('Gemini Flash failed:', flashErr);
              
              // Fallback 2: Try Lovable AI with OpenAI GPT-5
              if (LOVABLE_API_KEY) {
                try {
                  console.log('Falling back to Lovable AI (openai/gpt-5)...');
                  const lovableController = new AbortController();
                  const lovableTimeoutId = setTimeout(() => lovableController.abort(), 90000);

                  const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'openai/gpt-5',
                      messages: [
                        { role: 'system', content: systemPrompt },
                        {
                          role: 'user',
                          content: [
                            { type: 'text', text: directPrompt },
                            { type: 'image_url', image_url: { url: imageBase64 } }
                          ]
                        }
                      ],
                      max_completion_tokens: 16000
                    }),
                    signal: lovableController.signal
                  });

                  clearTimeout(lovableTimeoutId);

                  if (lovableResponse.ok) {
                    const lovableResult = await lovableResponse.json();
                    bpmnXml = lovableResult.choices?.[0]?.message?.content || '';
                    if (bpmnXml) {
                      console.log('✅ Success with Lovable AI (openai/gpt-5)');
                      selectedModel = 'openai/gpt-5';
                    } else {
                      throw new Error('Empty response from Lovable AI GPT-5');
                    }
                  } else {
                    throw new Error(`Lovable AI GPT-5 failed: ${lovableResponse.status}`);
                  }
                } catch (lovableErr) {
                  console.error('Lovable AI GPT-5 failed:', lovableErr);
                  
                  // Fallback 3: Try Lovable AI with Gemini Flash as last resort
                  try {
                    console.log('Falling back to Lovable AI (google/gemini-2.5-flash) as last resort...');
                    const lastController = new AbortController();
                    const lastTimeoutId = setTimeout(() => lastController.abort(), 90000);

                    const lastResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: 'google/gemini-2.5-flash',
                        messages: [
                          { role: 'system', content: systemPrompt },
                          {
                            role: 'user',
                            content: [
                              { type: 'text', text: directPrompt },
                              { type: 'image_url', image_url: { url: imageBase64 } }
                            ]
                          }
                        ],
                        max_tokens: 12000
                      }),
                      signal: lastController.signal
                    });

                    clearTimeout(lastTimeoutId);

                    if (lastResponse.ok) {
                      const lastResult = await lastResponse.json();
                      bpmnXml = lastResult.choices?.[0]?.message?.content || '';
                      if (bpmnXml) {
                        console.log('✅ Success with Lovable AI (google/gemini-2.5-flash)');
                        selectedModel = 'google/gemini-2.5-flash';
                      } else {
                        throw new Error('Empty response from Lovable AI Gemini Flash');
                      }
                    } else {
                      throw new Error(`All fallbacks exhausted: ${lastResponse.status}`);
                    }
                  } catch (lastErr) {
                    console.error('All AI models failed:', lastErr);
                    throw new Error('All AI models failed to generate diagram. Please try again later or with a simpler image.');
                  }
                }
              } else {
                throw new Error('Gemini models failed and Lovable AI not configured');
              }
            }
          }

          console.log('Direct BPMN generation complete');

          if (!bpmnXml) {
            throw new Error('Failed to generate BPMN XML from image');
          }
        } else if (isText) {
          // Handle plain text input - analyze and generate
          const textContent = imageBase64.startsWith('data:text/plain')
            ? decodeURIComponent(escape(atob(imageBase64.split(',')[1])))
            : imageBase64;

          // Analyze text complexity for model selection
          const complexityMetrics = {
            wordCount: textContent.split(/\s+/).length,
            lineCount: textContent.split('\n').length,
            hasDecisionPoints: /\b(if|else|whether|decide|choose|branch|condition|check)\b/i.test(textContent),
            hasMultipleLanes: textContent.match(/lane|swimlane|category|phase|stage/gi)?.length || 0,
            taskCount: textContent.match(/task|step|activity|action/gi)?.length || 0
          };
          
          const complexityScore = 
            (complexityMetrics.wordCount > 500 ? 2 : complexityMetrics.wordCount > 250 ? 1 : 0) +
            (complexityMetrics.hasMultipleLanes > 4 ? 2 : complexityMetrics.hasMultipleLanes > 2 ? 1 : 0) +
            (complexityMetrics.taskCount > 15 ? 2 : complexityMetrics.taskCount > 8 ? 1 : 0) +
            (complexityMetrics.hasDecisionPoints ? 1 : 0);
          
          console.log(`Text complexity: ${complexityScore}/8, using fallback chain`);

          const diagramLabel = diagramType === 'pid' ? 'P&ID' : 'BPMN';
          console.log(`Generating ${diagramLabel} XML from text...`);

          const bpmnSystemPrompt = `You are a BPMN 2.0 expert. Generate valid XML with horizontal swimlanes and decision gateways. Return ONLY XML starting with <?xml version="1.0" encoding="UTF-8"?>. No markdown.`;
          
          const pidSystemPrompt = `You are a P&ID expert. Generate BPMN 2.0 XML with pid:type, pid:symbol, pid:category attributes for P&ID elements. Return ONLY XML, no markdown.`;

          const systemPrompt = diagramType === 'pid' ? pidSystemPrompt : bpmnSystemPrompt;
          const userPrompt = `Generate a complete ${diagramType.toUpperCase()} diagram from this text:\n\n${textContent}\n\nReturn ONLY the XML.`;

          // Fallback chain for text: Gemini Thinking -> Gemini Flash -> Lovable AI (GPT-5) -> Lovable AI (Gemini)
          // Try Gemini 2.0 Flash Thinking first
          try {
            console.log('Attempting text generation with gemini-2.0-flash-thinking-exp-01-21...');
            const textController = new AbortController();
            const textTimeoutId = setTimeout(() => textController.abort(), 180000);
            
            const modelEndpoint = 'gemini-2.0-flash-thinking-exp-01-21';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${GOOGLE_API_KEY}`;
            
            const textRequestBody = {
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { text: userPrompt }
                ]
              }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 32768,
              }
            };

            const textResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(textRequestBody),
              signal: textController.signal
            });

            clearTimeout(textTimeoutId);

            if (textResponse.ok) {
              const textResult = await textResponse.json();
              bpmnXml = textResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (bpmnXml) {
                console.log('✅ Success with gemini-2.0-flash-thinking-exp-01-21 (text)');
                selectedModel = 'gemini-2.5-pro';
              } else {
                throw new Error('Empty response from primary model');
              }
            } else {
              throw new Error(`Primary model failed: ${textResponse.status}`);
            }
          } catch (primaryErr) {
            console.error('Primary model failed (text):', primaryErr);
            
            // Fallback 1: Try Gemini 2.5 Flash
            try {
              console.log('Falling back to gemini-2.5-flash for text...');
              const fallbackController = new AbortController();
              const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 120000);
              
              const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;
              
              const fallbackRequestBody = {
                contents: [{
                  parts: [
                    { text: systemPrompt },
                    { text: userPrompt }
                  ]
                }],
                generationConfig: {
                  temperature: 0.5,
                  maxOutputTokens: 12288,
                }
              };

              const fallbackResponse = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fallbackRequestBody),
                signal: fallbackController.signal
              });

              clearTimeout(fallbackTimeoutId);

              if (fallbackResponse.ok) {
                const fallbackResult = await fallbackResponse.json();
                bpmnXml = fallbackResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (bpmnXml) {
                  console.log('✅ Success with gemini-2.5-flash (text)');
                  selectedModel = 'gemini-2.5-flash';
                } else {
                  throw new Error('Empty response from Gemini Flash');
                }
              } else {
                throw new Error(`Gemini Flash failed: ${fallbackResponse.status}`);
              }
            } catch (flashErr) {
              console.error('Gemini Flash failed (text):', flashErr);
              
              // Fallback 2: Try Lovable AI with OpenAI
              if (LOVABLE_API_KEY) {
                try {
                  console.log('Falling back to Lovable AI (openai/gpt-5) for text...');
                  const lovableController = new AbortController();
                  const lovableTimeoutId = setTimeout(() => lovableController.abort(), 120000);

                  const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'openai/gpt-5',
                      messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                      ],
                      max_completion_tokens: 16000
                    }),
                    signal: lovableController.signal
                  });

                  clearTimeout(lovableTimeoutId);

                  if (lovableResponse.ok) {
                    const lovableResult = await lovableResponse.json();
                    bpmnXml = lovableResult.choices?.[0]?.message?.content || '';
                    if (bpmnXml) {
                      console.log('✅ Success with Lovable AI (openai/gpt-5) for text');
                      selectedModel = 'openai/gpt-5';
                    } else {
                      throw new Error('Empty response from Lovable AI GPT-5');
                    }
                  } else {
                    throw new Error(`Lovable AI GPT-5 failed: ${lovableResponse.status}`);
                  }
                } catch (lovableErr) {
                  console.error('Lovable AI GPT-5 failed (text):', lovableErr);
                  
                  // Fallback 3: Try Lovable AI with Gemini as last resort
                  try {
                    console.log('Falling back to Lovable AI (google/gemini-2.5-flash) for text as last resort...');
                    const lastController = new AbortController();
                    const lastTimeoutId = setTimeout(() => lastController.abort(), 120000);

                    const lastResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model: 'google/gemini-2.5-flash',
                        messages: [
                          { role: 'system', content: systemPrompt },
                          { role: 'user', content: userPrompt }
                        ],
                        max_tokens: 12000
                      }),
                      signal: lastController.signal
                    });

                    clearTimeout(lastTimeoutId);

                    if (lastResponse.ok) {
                      const lastResult = await lastResponse.json();
                      bpmnXml = lastResult.choices?.[0]?.message?.content || '';
                      if (bpmnXml) {
                        console.log('✅ Success with Lovable AI (google/gemini-2.5-flash) for text');
                        selectedModel = 'google/gemini-2.5-flash';
                      } else {
                        throw new Error('Empty response from Lovable AI Gemini Flash');
                      }
                    } else {
                      throw new Error(`All fallbacks exhausted: ${lastResponse.status}`);
                    }
                  } catch (lastErr) {
                    console.error('All AI models failed (text):', lastErr);
                    throw new Error('All AI models failed to generate diagram from text. Please try again later.');
                  }
                }
              } else {
                throw new Error('Gemini models failed and Lovable AI not configured');
              }
            }
          }

          if (!bpmnXml) {
            throw new Error('Failed to generate BPMN XML from text');
          }
        } else if (isPDF || isDocument) {
          throw new Error('PDF/Document processing not yet supported - please upload images or text');
        } else {
          throw new Error('Unsupported file type');
        }

        console.log('BPMN generation complete');

        // Clean up XML
        bpmnXml = bpmnXml
          .replace(/```xml\n?/g, '')
          .replace(/```\n?/g, '')
          .replace(/^[^<]*/, '') // Remove any text before XML
          .replace(/[^>]*$/, '') // Remove any text after XML
          .trim();

        if (!bpmnXml.startsWith('<?xml')) {
          throw new Error('Generated content is not valid XML');
        }

        // Store complete result in vision cache if from image (and not already cached)
        if (imageHash && isImage && !cacheHit) {
          console.log('💾 Storing result in vision cache for hash:', imageHash.substring(0, 16) + '...');
          // Extract a brief description from the first few elements for cache
          const descMatch = bpmnXml.match(/<bpmn:textAnnotation[^>]*>.*?<bpmn:text>(.*?)<\/bpmn:text>/s);
          const briefDesc = descMatch ? descMatch[1].substring(0, 200) : 'BPMN diagram from image';
          
          // Generate embedding for semantic search
          let embedding: number[] | undefined;
          if (isSemanticCacheEnabled()) {
            try {
              embedding = await generateEmbedding(briefDesc);
              console.log('✅ Generated embedding for semantic cache');
            } catch (embedError) {
              console.error('Failed to generate embedding for cache:', embedError);
              // Continue without embedding
            }
          }
          
          await storeVisionCache(imageHash, diagramType, briefDesc, bpmnXml, embedding);
          console.log('✅ Vision cache stored successfully');
        }

        // Update job with success
        const modelUsed = cacheHit ? 'cached' : selectedModel;
        await supabase
          .from('vision_bpmn_jobs')
          .update({
            bpmn_xml: bpmnXml,
            status: 'completed',
            model_used: modelUsed,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        console.log('Job completed:', job.id);

        const responseTime = Date.now() - startTime;
        await logPerformanceMetric({
          function_name: 'vision-to-bpmn',
          cache_type: cacheHit ? cacheType : 'none',
          response_time_ms: responseTime,
          cache_hit: cacheHit,
          model_used: modelUsed,
          error_occurred: false,
        });
      } catch (err) {
        console.error('Error processing job:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        
        await supabase
          .from('vision_bpmn_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        const responseTime = Date.now() - startTime;
        await logPerformanceMetric({
          function_name: 'vision-to-bpmn',
          cache_type: 'none',
          cache_hit: false,
          response_time_ms: responseTime,
          error_occurred: true,
          error_message: errorMessage,
        });
      }
    };

    // Use proper EdgeRuntime.waitUntil for background processing
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processJob());

    // Return immediately with job ID
    return new Response(
      JSON.stringify({ jobId: job.id }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (err) {
    console.error('Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
