
import { serve } from '../shared/aws-shim.ts';
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../shared/embeddings.ts';
import { logPerformanceMetric } from '../shared/metrics.ts';
import { extractXmlSummary } from '../shared/xml-utils.ts';
import { getDmnSystemPrompt } from '../shared/prompts.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const handler = serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const startTime = Date.now();
    let cacheType: 'exact_hash' | 'semantic' | 'none' = 'none';
    let similarityScore: number | undefined;
    let errorOccurred = false;
    let errorMessage: string | undefined;
    let requestData: any;

    try {
        // Validate request has body
        if (!req.body) {
            console.error('Request body is missing');
            return new Response(
                JSON.stringify({ error: 'Request body is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        let reqData;
        try {
            reqData = await req.json();
            requestData = reqData; // Store for error logging
        } catch (jsonError) {
            console.error('Failed to parse JSON:', jsonError);
            return new Response(
                JSON.stringify({ error: 'Invalid JSON in request body' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { currentDmnXml, instructions, userId } = reqData;
        console.log(`Refining DMN with instructions:`, instructions);

        // SECURITY: Validate userId
        if (!userId) {
            console.error('Missing userId in request');
            return new Response(
                JSON.stringify({ error: 'Authentication required' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!currentDmnXml || !instructions) {
            return new Response(
                JSON.stringify({ error: 'Current diagram XML and instructions are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Generate hash for refinement cache (XML summary + instructions)
        const xmlSummary = extractXmlSummary(currentDmnXml);
        const refinementHash = await generateHash(`${xmlSummary}:${instructions}:dmn`);

        // Check exact hash cache
        const exactCache = await checkExactHashCache(refinementHash, 'dmn');
        if (exactCache) {
            console.log('Exact hash cache hit for refinement');
            cacheType = 'exact_hash';
            const responseTime = Date.now() - startTime;

            await logPerformanceMetric({
                function_name: 'refine-dmn',
                cache_type: 'exact_hash',
                prompt_length: instructions.length,
                response_time_ms: responseTime,
                cache_hit: true,
                error_occurred: false,
            });

            return new Response(
                JSON.stringify({
                    dmnXml: exactCache.bpmnXml,
                    instructions,
                    cached: true,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Check semantic cache for refinements (higher threshold: 0.9)
        if (isSemanticCacheEnabled()) {
            try {
                const embedding = await generateEmbedding(`${xmlSummary}:${instructions}`);
                const semanticCache = await checkSemanticCache(
                    embedding,
                    'dmn',
                    0.9 // Higher threshold for refinements
                );

                if (semanticCache) {
                    console.log(`Semantic cache hit for refinement (similarity: ${semanticCache.similarity})`);
                    cacheType = 'semantic';
                    similarityScore = semanticCache.similarity;
                    const responseTime = Date.now() - startTime;

                    await logPerformanceMetric({
                        function_name: 'refine-dmn',
                        cache_type: 'semantic',
                        prompt_length: instructions.length,
                        response_time_ms: responseTime,
                        cache_hit: true,
                        similarity_score: semanticCache.similarity,
                        error_occurred: false,
                    });

                    return new Response(
                        JSON.stringify({
                            dmnXml: semanticCache.bpmnXml,
                            instructions,
                            cached: true,
                            similarity: semanticCache.similarity,
                        }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );
                }
            } catch (embeddingError) {
                console.warn('Semantic cache check failed for refinement, continuing:', embeddingError);
            }
        }

        const GOOGLE_API_KEY = process.env['GOOGLE_API_KEY'];
        if (!GOOGLE_API_KEY) {
            throw new Error('Google API key not configured');
        }

        // System prompt for DMN refinement
        const dmnSystemPrompt = getDmnSystemPrompt();

        // Use XML summary instead of full XML to reduce token usage
        const userPrompt = `Current DMN Diagram Summary:
${xmlSummary}

User instructions:
${instructions}

Apply these modifications to the DMN diagram and return the complete updated XML.
CRITICAL: Ensure the XML is valid DMN 1.3 and includes a complete DMNDI section for layout.`;

        console.log('Calling Gemini for DMN refinement...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: `${dmnSystemPrompt}\n\n${userPrompt}` }
                        ]
                    }],
                    generationConfig: {
                        maxOutputTokens: 16000,
                        temperature: 0.2 // Lower temperature for refinements (more deterministic)
                    }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI refinement error:', response.status, errorText);

            if (response.status === 402) {
                throw new Error('AI service temporarily unavailable due to credit limits. Please try again later.');
            }

            throw new Error(`Failed to refine DMN: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        let refinedDmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('Raw AI response length:', refinedDmnXml.length);

        // Clean up markdown code blocks
        refinedDmnXml = refinedDmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

        // Extract XML if there's surrounding text
        const xmlStartMatch = refinedDmnXml.match(/<\?xml[^>]*>/);
        const xmlEndMatch = refinedDmnXml.match(/<\/(dmn:)?definitions>\s*$/);

        if (xmlStartMatch && xmlEndMatch) {
            const startIndex = refinedDmnXml.indexOf(xmlStartMatch[0]);
            const endTag = refinedDmnXml.includes('</dmn:definitions>') ? '</dmn:definitions>' : '</definitions>';
            const endIndex = refinedDmnXml.lastIndexOf(endTag) + endTag.length;
            refinedDmnXml = refinedDmnXml.substring(startIndex, endIndex).trim();
        }

        // Validate that we have valid XML (check for both possible closing tags)
        const hasValidClosing = refinedDmnXml.includes('</dmn:definitions>') || refinedDmnXml.includes('</definitions>');
        if (!refinedDmnXml.includes('<?xml') || !hasValidClosing) {
            console.error('Invalid DMN XML structure received after cleanup');
            console.error('Cleaned XML preview:', refinedDmnXml.substring(0, 500));
            throw new Error('Generated DMN XML is invalid or incomplete');
        }

        console.log('DMN refinement complete - XML validated');

        // Store in cache only after successful validation (200 response + valid XML)
        (async () => {
            try {
                const xmlSummary = extractXmlSummary(currentDmnXml);
                let embedding: number[] | undefined;
                if (isSemanticCacheEnabled()) {
                    try {
                        embedding = await generateEmbedding(`${xmlSummary}:${instructions}`);
                    } catch (e) {
                        console.warn('Failed to generate embedding for refinement cache storage:', e);
                    }
                }
                await storeExactHashCache(refinementHash, `${xmlSummary}:${instructions}`, 'dmn', refinedDmnXml, embedding);
            } catch (cacheError) {
                console.error('Failed to store refinement in cache:', cacheError);
            }
        })();

        const responseTime = Date.now() - startTime;

        // Log performance metric
        await logPerformanceMetric({
            function_name: 'refine-dmn',
            cache_type: cacheType,
            prompt_length: instructions.length,
            response_time_ms: responseTime,
            cache_hit: cacheType !== 'none',
            similarity_score: similarityScore,
            error_occurred: false,
        });

        return new Response(
            JSON.stringify({
                dmnXml: refinedDmnXml,
                instructions,
                cached: false,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        errorOccurred = true;
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error in refine-dmn function:', error);

        const responseTime = Date.now() - startTime;
        await logPerformanceMetric({
            function_name: 'refine-dmn',
            cache_type: cacheType,
            prompt_length: requestData?.instructions?.length || 0,
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
