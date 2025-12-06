import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../_shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../_shared/embeddings.ts';
import { logPerformanceMetric } from '../_shared/metrics.ts';
import { extractXmlSummary } from '../_shared/xml-utils.ts';
import { getDmnSystemPrompt } from '../_shared/prompts.ts';

/**
 * Apply quick sanitization fixes for common LLM DMN XML mistakes.
 */
function sanitizeDmnXml(xml: string): string {
    let sanitized = xml;

    // Fix namespace issues
    sanitized = sanitized.replace(/dmn:/gi, '');

    // Step 0: Fix namespace declarations - ensure all required namespaces are in root <definitions> element
    // Standard DMN 1.3 namespace URIs
    const standardNamespaces = {
        dmndi: 'https://www.omg.org/spec/DMN/20191111/DMNDI/',
        dc: 'http://www.omg.org/spec/DMN/20180521/DC/',
        di: 'http://www.omg.org/spec/DMN/20180521/DI/'
    };

    // Check if root definitions element exists
    const rootDefinitionsMatch = sanitized.match(/<definitions([^>]*)>/i);
    if (rootDefinitionsMatch) {
        const rootAttrs = rootDefinitionsMatch[1];
        let needsUpdate = false;
        let updatedAttrs = rootAttrs;

        // Check and add missing namespaces
        for (const [prefix, uri] of Object.entries(standardNamespaces)) {
            const namespacePattern = new RegExp(`xmlns:${prefix}=`, 'i');
            if (!namespacePattern.test(rootAttrs)) {
                // Check if it's declared elsewhere (e.g., in dmndi:DMNDI)
                const elsewhereMatch = sanitized.match(new RegExp(`xmlns:${prefix}="([^"]+)"`, 'i'));
                const namespaceUri = elsewhereMatch ? elsewhereMatch[1] : uri;
                updatedAttrs += ` xmlns:${prefix}="${namespaceUri}"`;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            sanitized = sanitized.replace(/<definitions([^>]*)>/i, `<definitions${updatedAttrs}>`);

            // Remove duplicate namespace declarations from dmndi:DMNDI element (they should only be in root)
            sanitized = sanitized.replace(/<dmndi:DMNDI([^>]*?)\s+xmlns:dmndi="[^"]+"([^>]*?)>/gi, '<dmndi:DMNDI$1$2>');
            sanitized = sanitized.replace(/<dmndi:DMNDI([^>]*?)\s+xmlns:dc="[^"]+"([^>]*?)>/gi, '<dmndi:DMNDI$1$2>');
            sanitized = sanitized.replace(/<dmndi:DMNDI([^>]*?)\s+xmlns:di="[^"]+"([^>]*?)>/gi, '<dmndi:DMNDI$1$2>');
            sanitized = sanitized.replace(/<dmndi:DMNDI\s*xmlns:dmndi="[^"]+"\s*([^>]*?)>/gi, '<dmndi:DMNDI $1>');
            sanitized = sanitized.replace(/<dmndi:DMNDI\s*xmlns:dc="[^"]+"\s*([^>]*?)>/gi, '<dmndi:DMNDI $1>');
            sanitized = sanitized.replace(/<dmndi:DMNDI\s*xmlns:di="[^"]+"\s*([^>]*?)>/gi, '<dmndi:DMNDI $1>');
            sanitized = sanitized.replace(/<dmndi:DMNDI\s{2,}/g, '<dmndi:DMNDI ');
            sanitized = sanitized.replace(/<dmndi:DMNDI\s+>/g, '<dmndi:DMNDI>');
        }
    }

    // Step 1: Fix self-closing text tags with content: <text/>Content</text> -> <text>Content</text>
    for (let i = 0; i < 3; i++) {
        const before = sanitized;
        sanitized = sanitized.replace(/<text\/>\s*([\s\S]*?)<\/text>/g, '<text>$1</text>');
        if (before === sanitized) break;
    }

    // Step 2: Fix malformed inputEntry/outputEntry patterns
    sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*\n\s*<text\/>([\s\S]*?)<\/text>\s*\n\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');
    sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*\n\s*<text>([\s\S]*?)<\/text>\s*\n\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');
    sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*<text\/>([\s\S]*?)<\/text>\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');
    sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*<text>([\s\S]*?)<\/text>\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');

    // Step 3: Fix any remaining self-closing inputEntry/outputEntry that have a closing tag
    sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
        const trimmed = content.trim();
        if (trimmed) {
            const textMatch = trimmed.match(/<text>([\s\S]*?)<\/text>/);
            if (textMatch) {
                return `<${tag}${attrs}><text>${textMatch[1]}</text></${tag}>`;
            }
            if (!trimmed.includes('<')) {
                return `<${tag}${attrs}><text>${trimmed}</text></${tag}>`;
            }
            return `<${tag}${attrs}>${content}</${tag}>`;
        }
        return match;
    });

    // Fix unescaped ampersands
    sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

    // Fix XML declaration issues
    sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');

    return sanitized.trim();
}

/**
 * Ensure DMNDI section exists - add it if missing
 */
function ensureDmndiExists(xml: string): string {
    if (xml.includes('<dmndi:DMNDI>') || xml.includes('<dmndi:DMNDiagram')) {
        return xml;
    }

    console.log('[DMNDI Fix] DMNDI section missing, generating it...');

    const decisionMatches = xml.matchAll(/<decision[^>]*id="([^"]+)"[^>]*name="([^"]*)"[^>]*>/gi);
    const inputDataMatches = xml.matchAll(/<inputData[^>]*id="([^"]+)"[^>]*name="([^"]*)"[^>]*>/gi);

    const decisions: Array<{ id: string; name: string }> = [];
    const inputData: Array<{ id: string; name: string }> = [];

    for (const match of decisionMatches) {
        decisions.push({ id: match[1], name: match[2] || match[1] });
    }

    for (const match of inputDataMatches) {
        inputData.push({ id: match[1], name: match[2] || match[1] });
    }

    const infoReqMatches = xml.matchAll(/<informationRequirement[^>]*>[\s\S]*?<requiredInput[^>]*href="#([^"]+)"[^>]*\/>[\s\S]*?<\/informationRequirement>/gi);
    const infoReqs: Array<{ decisionId: string; inputId: string }> = [];

    const decisionBlocks = xml.matchAll(/<decision[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/decision>/gi);
    for (const decisionBlock of decisionBlocks) {
        const decisionId = decisionBlock[1];
        const decisionContent = decisionBlock[2];
        const reqMatches = decisionContent.matchAll(/<requiredInput[^>]*href="#([^"]+)"[^>]*\/>/gi);
        for (const reqMatch of reqMatches) {
            infoReqs.push({ decisionId, inputId: reqMatch[1] });
        }
    }

    let dmndiSection = '\n  <dmndi:DMNDI>\n    <dmndi:DMNDiagram id="DMNDiagram_1">\n';

    let inputY = 100;
    for (const input of inputData) {
        dmndiSection += `      <dmndi:DMNShape id="DMNShape_${input.id}" dmnElementRef="${input.id}">\n`;
        dmndiSection += `        <dc:Bounds x="100" y="${inputY}" width="150" height="50"/>\n`;
        dmndiSection += `      </dmndi:DMNShape>\n`;
        inputY += 100;
    }

    let decisionY = 100;
    for (const decision of decisions) {
        dmndiSection += `      <dmndi:DMNShape id="DMNShape_${decision.id}" dmnElementRef="${decision.id}">\n`;
        dmndiSection += `        <dc:Bounds x="400" y="${decisionY}" width="600" height="300"/>\n`;
        dmndiSection += `      </dmndi:DMNShape>\n`;
        decisionY += 350;
    }

    let edgeCounter = 1;
    for (const req of infoReqs) {
        const inputShape = inputData.find(inp => inp.id === req.inputId);
        const decisionShape = decisions.find(dec => dec.id === req.decisionId);
        if (inputShape && decisionShape) {
            const inputIndex = inputData.findIndex(inp => inp.id === req.inputId);
            const decisionIndex = decisions.findIndex(dec => dec.id === req.decisionId);
            const inputYPos = 100 + (inputIndex * 100) + 25;
            const decisionYPos = 100 + (decisionIndex * 350) + 150;

            dmndiSection += `      <dmndi:DMNEdge id="DMNEdge_InfoReq_${edgeCounter}">\n`;
            dmndiSection += `        <di:waypoint x="250" y="${inputYPos}"/>\n`;
            dmndiSection += `        <di:waypoint x="400" y="${decisionYPos}"/>\n`;
            dmndiSection += `      </dmndi:DMNEdge>\n`;
            edgeCounter++;
        }
    }

    dmndiSection += '    </dmndi:DMNDiagram>\n  </dmndi:DMNDI>\n';

    if (xml.includes('</definitions>')) {
        return xml.replace('</definitions>', `${dmndiSection}</definitions>`);
    }

    return xml.trim() + dmndiSection;
}

/**
 * Fix DMNDI layout issues - ensure proper bounds and spacing
 */
function fixDmndiLayout(xml: string): string {
    let fixed = xml;

    fixed = ensureDmndiExists(fixed);

    // Remove ALL name attributes from definitions element
    fixed = fixed.replace(/<definitions[^>]*>/gi, (match) => {
        return match.replace(/\s+name\s*=\s*("[^"]*"|'[^']*')/gi, '');
    });

    // Remove ALL name attributes from DMNDiagram elements
    fixed = fixed.replace(/<dmndi:DMNDiagram[^>]*>/gi, (match) => {
        return match.replace(/\s+name\s*=\s*("[^"]*"|'[^']*')/gi, '');
    });

    // Ensure DMNShape elements have reasonable bounds
    fixed = fixed.replace(/<dmndi:DMNShape[^>]*dmnElementRef="([^"]+)"[^>]*>[\s\S]*?<dc:Bounds\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"\s*\/>/gi, (match, elementRef, x, y, width, height) => {
        const isDecision = elementRef.includes('Decision_') || elementRef.startsWith('Decision');
        const isInputData = elementRef.includes('InputData_') || elementRef.startsWith('InputData');

        const xNum = parseFloat(x) || 0;
        const yNum = parseFloat(y) || 0;
        let widthNum = parseFloat(width) || (isDecision ? 600 : 150);
        let heightNum = parseFloat(height) || (isDecision ? 300 : 50);

        if (isDecision) {
            if (widthNum < 400) widthNum = 600;
            if (widthNum > 1200) widthNum = 800;
            if (heightNum < 200) heightNum = 300;
            if (heightNum > 800) heightNum = 500;
        } else if (isInputData) {
            if (widthNum < 80) widthNum = 150;
            if (widthNum > 300) widthNum = 200;
            if (heightNum < 40) heightNum = 50;
            if (heightNum > 200) heightNum = 80;
        } else {
            if (widthNum < 80) widthNum = 100;
            if (widthNum > 300) widthNum = 200;
            if (heightNum < 40) heightNum = 50;
            if (heightNum > 200) heightNum = 80;
        }

        const fixedX = Math.max(0, Math.min(xNum, 2000));
        const fixedY = Math.max(80, Math.min(yNum, 2000));

        return match.replace(/<dc:Bounds\s+x="[^"]+"\s+y="[^"]+"\s+width="[^"]+"\s+height="[^"]+"\s*\/>/,
            `<dc:Bounds x="${fixedX}" y="${fixedY}" width="${widthNum}" height="${heightNum}"/>`);
    });

    // Ensure waypoints are reasonable
    fixed = fixed.replace(/<di:waypoint\s+x="([^"]+)"\s+y="([^"]+)"\s*\/>/gi, (match, x, y) => {
        const xNum = parseFloat(x) || 0;
        const yNum = parseFloat(y) || 0;
        const fixedX = Math.max(0, Math.min(xNum, 2000));
        const fixedY = Math.max(0, Math.min(yNum, 2000));
        return `<di:waypoint x="${fixedX}" y="${fixedY}"/>`;
    });

    return fixed;
}

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

        const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
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

        // Sanitize XML to fix common LLM mistakes
        refinedDmnXml = sanitizeDmnXml(refinedDmnXml);

        // Fix DMNDI layout issues (bounds, spacing, positioning) and remove name attributes
        refinedDmnXml = fixDmndiLayout(refinedDmnXml);

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
