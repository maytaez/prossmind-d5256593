
import { serve } from '../shared/aws-shim.ts';
import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../shared/embeddings.ts';
import { logPerformanceMetric } from '../shared/metrics.ts';
import { extractXmlSummary } from '../shared/xml-utils.ts';
import { instrumentBpmnXml } from '../shared/instrumentation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const applyMonitoringInstrumentation = (xml: string, context: string) => {
  try {
    const instrumentation = instrumentBpmnXml(xml);
    if (instrumentation.warnings.length) {
      instrumentation.warnings.forEach((warning) =>
        console.warn(`[Instrumentation Warning][${context}]`, warning)
      );
    }
    return instrumentation;
  } catch (error) {
    console.error(`[Instrumentation Error][${context}]`, error);
    return {
      xml,
      warnings: [
        `Monitoring instrumentation failed during ${context}. Diagram returned without telemetry hooks.`,
      ],
    };
  }
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

    const { currentBpmnXml, instructions, userId, diagramType = 'bpmn' } = reqData;
    console.log(`Refining ${diagramType.toUpperCase()} with instructions:`, instructions);

    // SECURITY: Validate userId
    if (!userId) {
      console.error('Missing userId in request');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!currentBpmnXml || !instructions) {
      return new Response(
        JSON.stringify({ error: 'Current diagram XML and instructions are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate hash for refinement cache (XML summary + instructions)
    const xmlSummary = extractXmlSummary(currentBpmnXml);
    const refinementHash = await generateHash(`${xmlSummary}:${instructions}:${diagramType}`);

    // Check exact hash cache
    const exactCache = await checkExactHashCache(refinementHash, diagramType);
    if (exactCache) {
      console.log('Exact hash cache hit for refinement');
      cacheType = 'exact_hash';
      const instrumentation = applyMonitoringInstrumentation(
        exactCache.bpmnXml,
        'refine-bpmn cache'
      );
      const responseTime = Date.now() - startTime;

      await logPerformanceMetric({
        function_name: 'refine-bpmn',
        cache_type: 'exact_hash',
        prompt_length: instructions.length,
        response_time_ms: responseTime,
        cache_hit: true,
        error_occurred: false,
      });

      return new Response(
        JSON.stringify({
          bpmnXml: instrumentation.xml,
          instructions,
          cached: true,
          monitoringWarnings: instrumentation.warnings,
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
          diagramType,
          0.9 // Higher threshold for refinements
        );

        if (semanticCache) {
          console.log(`Semantic cache hit for refinement (similarity: ${semanticCache.similarity})`);
          cacheType = 'semantic';
          similarityScore = semanticCache.similarity;
          const instrumentation = applyMonitoringInstrumentation(
            semanticCache.bpmnXml,
            'refine-bpmn semantic-cache'
          );
          const responseTime = Date.now() - startTime;

          await logPerformanceMetric({
            function_name: 'refine-bpmn',
            cache_type: 'semantic',
            prompt_length: instructions.length,
            response_time_ms: responseTime,
            cache_hit: true,
            similarity_score: semanticCache.similarity,
            error_occurred: false,
          });

          return new Response(
            JSON.stringify({
              bpmnXml: instrumentation.xml,
              instructions,
              cached: true,
              similarity: semanticCache.similarity,
              monitoringWarnings: instrumentation.warnings,
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

    // System prompt for BPMN refinement
    const bpmnSystemPrompt = `You are a BPMN expert specializing in refining and modifying existing BPMN diagrams.

Rules:
1. You will receive an existing BPMN 2.0 XML diagram
2. You will receive user instructions to modify it
3. Apply the requested changes to the BPMN XML
4. Maintain valid BPMN 2.0 XML format
5. Keep existing structure where not explicitly changed
6. Update the bpmndi:BPMNDiagram section to reflect any layout changes
7. Return ONLY the modified XML, no explanations or markdown
8. Ensure all element IDs remain unique
9. Preserve proper namespaces: xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"`;

    // System prompt for P&ID refinement
    const pidSystemPrompt = `System Prompt — "ProcessDesigner-AI v4 (Full P&ID Mode)"

## 🧠 ROLE

You are **ProcessDesigner-AI v4**, an expert process and instrumentation designer trained in **ISA S5.1**, **ISO 14617**, and **BPMN 2.0 XML**.  

Your task is to refine **existing P&ID diagrams** in **BPMN XML format** that render correctly using **BPMN.io** with a custom renderer (\`PidRenderer.js\`).



---



## 🎯 OBJECTIVES



1. Receive an existing P&ID diagram in BPMN 2.0 XML format.

2. Apply user-requested changes to:

   - **Equipment** (tanks, pumps, filters, heat exchangers, etc.)

   - **Valves** (control, check, solenoid, relief)

   - **Instruments** (transmitters, indicators, analyzers)

   - **Controllers** (PID, PLC, DCS, local)

   - **Flow Lines** (process, signal, or electrical)

3. Maintain valid **BPMN 2.0 XML** that:

   - Contains **P&ID attributes** (\`pid:type\`, \`pid:symbol\`, \`pid:category\`)

   - Uses **sequenceFlow** for process connections and **messageFlow** for control/signal connections

   - Preserves left-to-right layout with consistent spacing

   - Maintains all existing element IDs and connections unless explicitly changed



---



## ⚙️ REFINEMENT RULES



✅ Always include pid: attributes for every node.

✅ Maintain unique IDs (Tank_1, CV_101, etc.) unless explicitly requested to change.

✅ Preserve process flow logic and safety-critical elements.

✅ Update layout if equipment positions change.

✅ Use task elements for EQUIPMENT, gateway for VALVES, sequenceFlow for PIPING.

✅ Return ONLY the modified XML, no explanations or markdown.



---



## 🧱 SYMBOL DICTIONARY

Equipment

Symbol	Description

tank	Storage or mixing vessel

pump	Feed or circulation pump

filter	Sand, cartridge, or bag filter

heat_exchanger	Shell and tube or plate type

Valves

Symbol	Description

valve_control	Actuated control valve

valve_check	Non-return valve

valve_gate	Gate valve

valve_solenoid	Electrically operated valve

Instruments

Symbol	Description

transmitter_level	Level transmitter

transmitter_flow	Flow transmitter

transmitter_pressure	Pressure transmitter

analyzer	Chemical analyzer

Controllers

Symbol	Description

controller_pid	PID loop controller

controller_plc	Programmable logic controller

Line Categories

Category	Line Type	Style

process	Process material line	Solid

signal	Control or feedback line	Dashed

electrical	Power line	Dotted`;

    const systemPrompt = diagramType === 'pid' ? pidSystemPrompt : bpmnSystemPrompt;

    // Use XML summary instead of full XML to reduce token usage
    const userPrompt = `Current BPMN Diagram Summary:
${xmlSummary}

User instructions:
${instructions}

Apply these modifications to the BPMN diagram and return the complete updated XML.`;

    console.log('Calling Gemini for BPMN refinement...');
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
              { text: `${systemPrompt}\n\n${userPrompt}` }
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

      throw new Error(`Failed to refine BPMN: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let refinedBpmnXml = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('Raw AI response length:', refinedBpmnXml.length);
    console.log('First 200 chars:', refinedBpmnXml.substring(0, 200));
    console.log('Last 200 chars:', refinedBpmnXml.substring(refinedBpmnXml.length - 200));

    // Clean up markdown code blocks
    refinedBpmnXml = refinedBpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract XML if there's surrounding text
    const xmlStartMatch = refinedBpmnXml.match(/<\?xml[^>]*>/);
    const xmlEndMatch = refinedBpmnXml.match(/<\/(bpmn:)?definitions>\s*$/);

    if (xmlStartMatch && xmlEndMatch) {
      const startIndex = refinedBpmnXml.indexOf(xmlStartMatch[0]);
      const endTag = refinedBpmnXml.includes('</bpmn:definitions>') ? '</bpmn:definitions>' : '</definitions>';
      const endIndex = refinedBpmnXml.lastIndexOf(endTag) + endTag.length;
      refinedBpmnXml = refinedBpmnXml.substring(startIndex, endIndex).trim();
    }

    // Validate that we have valid XML (check for both possible closing tags)
    const hasValidClosing = refinedBpmnXml.includes('</bpmn:definitions>') || refinedBpmnXml.includes('</definitions>');
    if (!refinedBpmnXml.includes('<?xml') || !hasValidClosing) {
      console.error('Invalid BPMN XML structure received after cleanup');
      console.error('Cleaned XML preview:', refinedBpmnXml.substring(0, 500));
      throw new Error('Generated BPMN XML is invalid or incomplete');
    }

    console.log('BPMN refinement complete - XML validated');
    console.log('Refined XML length:', refinedBpmnXml.length);

    const instrumentation = applyMonitoringInstrumentation(
      refinedBpmnXml,
      'refine-bpmn result'
    );
    refinedBpmnXml = instrumentation.xml;

    // Store in cache only after successful validation (200 response + valid XML)
    (async () => {
      try {
        const xmlSummary = extractXmlSummary(currentBpmnXml);
        let embedding: number[] | undefined;
        if (isSemanticCacheEnabled()) {
          try {
            embedding = await generateEmbedding(`${xmlSummary}:${instructions}`);
          } catch (e) {
            console.warn('Failed to generate embedding for refinement cache storage:', e);
          }
        }
        await storeExactHashCache(refinementHash, `${xmlSummary}:${instructions}`, diagramType, refinedBpmnXml, embedding);
      } catch (cacheError) {
        console.error('Failed to store refinement in cache:', cacheError);
      }
    })();

    const responseTime = Date.now() - startTime;

    // Log performance metric
    await logPerformanceMetric({
      function_name: 'refine-bpmn',
      cache_type: cacheType,
      prompt_length: instructions.length,
      response_time_ms: responseTime,
      cache_hit: cacheType !== 'none',
      similarity_score: similarityScore,
      error_occurred: false,
    });

    return new Response(
      JSON.stringify({
        bpmnXml: refinedBpmnXml,
        instructions,
        cached: false,
        monitoringWarnings: instrumentation.warnings,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    errorOccurred = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in refine-bpmn function:', error);

    const responseTime = Date.now() - startTime;
    await logPerformanceMetric({
      function_name: 'refine-bpmn',
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
