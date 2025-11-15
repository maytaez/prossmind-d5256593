import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { generateHash, checkVisionCache, storeVisionCache } from '../_shared/cache.ts';
import { logPerformanceMetric } from '../_shared/metrics.ts';

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

        if (isImage || isPDF || isDocument) {
          // Extract base64 data (remove data URL prefix)
          const base64Data = imageBase64.includes(',') 
            ? imageBase64.split(',')[1] 
            : imageBase64;
          imageHash = await generateHash(`${base64Data}:${diagramType}`);

          // Check vision cache
          const visionCache = await checkVisionCache(imageHash, diagramType);
          if (visionCache) {
            console.log('Vision cache hit - using cached analysis');

            // If we have cached BPMN XML, use it and skip generation
            if (visionCache.bpmnXml) {
              console.log('Using cached BPMN XML');
              await supabase
                .from('vision_bpmn_jobs')
                .update({
                  bpmn_xml: visionCache.bpmnXml,
                  status: 'completed',
                  completed_at: new Date().toISOString()
                })
                .eq('id', job.id);

              const responseTime = Date.now() - startTime;
              await logPerformanceMetric({
                function_name: 'vision-to-bpmn',
                cache_type: 'exact_hash',
                response_time_ms: responseTime,
                cache_hit: true,
                error_occurred: false,
              });

              return;
            }
          }

          // Single-pass: Generate BPMN/P&ID directly from image
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

          // Use flash model for speed (it's still very capable)
          const selectedModel = 'gemini-2.5-flash';
          const maxTokens = 16384;
          const temperature = 0.3;
          
          console.log(`Using ${selectedModel} for direct BPMN generation from image`);
          
          const directPrompt = diagramType === 'pid' ? pidDirectPrompt : bpmnDirectPrompt;
          const systemPrompt = diagramType === 'pid' 
            ? `You are a P&ID expert. Generate complete BPMN 2.0 XML with pid:type, pid:symbol, pid:category attributes for P&ID elements.`
            : `You are a BPMN 2.0 expert. Generate valid BPMN 2.0 XML with horizontal swimlanes and decision gateways.`;
          
          try {
            const directController = new AbortController();
            const directTimeoutId = setTimeout(() => directController.abort(), 180000); // 3 minute timeout
            
            console.log('Generating BPMN XML directly from image...');
            const modelEndpoint = 'gemini-2.0-flash-exp';
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
                temperature,
                maxOutputTokens: maxTokens,
              }
            };

            const directResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(directRequestBody),
              signal: directController.signal
            });

            clearTimeout(directTimeoutId);

            if (!directResponse.ok) {
              const errorText = await directResponse.text();
              console.error('Gemini API error:', directResponse.status, errorText);
              throw new Error(`AI API error: ${directResponse.status}`);
            }

            const directResult = await directResponse.json();
            bpmnXml = directResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              throw new Error('BPMN generation timeout - please try with a simpler image');
            }
            throw err;
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
          
          const useProModel = complexityScore >= 3; // More aggressive with flash
          const selectedModel = useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
          const maxTokens = useProModel ? 32768 : 16384;
          const temperature = 0.3;
          
          console.log(`Text complexity: ${complexityScore}/8, using ${selectedModel}`);

          const diagramLabel = diagramType === 'pid' ? 'P&ID' : 'BPMN';
          console.log(`Generating ${diagramLabel} XML from text...`);

          const bpmnSystemPrompt = `You are a BPMN 2.0 expert. Generate valid XML with horizontal swimlanes and decision gateways. Return ONLY XML starting with <?xml version="1.0" encoding="UTF-8"?>. No markdown.`;
          
          const pidSystemPrompt = `You are a P&ID expert. Generate BPMN 2.0 XML with pid:type, pid:symbol, pid:category attributes for P&ID elements. Return ONLY XML, no markdown.`;

          const systemPrompt = diagramType === 'pid' ? pidSystemPrompt : bpmnSystemPrompt;
          const userPrompt = `Generate a complete ${diagramType.toUpperCase()} diagram from this text:\n\n${textContent}\n\nReturn ONLY the XML.`;

          try {
            const textController = new AbortController();
            const textTimeoutId = setTimeout(() => textController.abort(), 180000);
            
            const modelEndpoint = selectedModel === 'gemini-2.5-pro' 
              ? 'gemini-2.0-flash-thinking-exp-01-21' 
              : 'gemini-2.0-flash-exp';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelEndpoint}:generateContent?key=${GOOGLE_API_KEY}`;
            
            const textRequestBody = {
              contents: [{
                parts: [
                  { text: systemPrompt },
                  { text: userPrompt }
                ]
              }],
              generationConfig: {
                temperature,
                maxOutputTokens: maxTokens,
              }
            };

            const textResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(textRequestBody),
              signal: textController.signal
            });

            clearTimeout(textTimeoutId);

            if (!textResponse.ok) {
              const errorText = await textResponse.text();
              console.error('Gemini API error:', textResponse.status, errorText);
              throw new Error(`AI API error: ${textResponse.status}`);
            }

            const textResult = await textResponse.json();
            bpmnXml = textResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              throw new Error('BPMN generation timeout');
            }
            throw err;
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

        // Store complete result in vision cache if from image
        if (imageHash && isImage) {
          // Extract a brief description from the first few elements for cache
          const descMatch = bpmnXml.match(/<bpmn:textAnnotation[^>]*>.*?<bpmn:text>(.*?)<\/bpmn:text>/s);
          const briefDesc = descMatch ? descMatch[1].substring(0, 200) : 'BPMN diagram from image';
          await storeVisionCache(imageHash, diagramType, briefDesc, bpmnXml);
        }

        // Update job with success
        const modelUsed = isImage ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
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
          cache_type: 'none',
          response_time_ms: responseTime,
          cache_hit: false,
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

    // Use EdgeRuntime.waitUntil to keep the function alive for background processing
    (req as any).waitUntil?.(processJob());

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
