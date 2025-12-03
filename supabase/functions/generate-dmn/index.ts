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
  const xmlDeclMatch = text.match(/<\?xml[^>]*\?>/i);
  if (xmlDeclMatch) {
    const xmlStart = text.indexOf(xmlDeclMatch[0]);
    return text.substring(xmlStart).trim();
  }

  const definitionsMatch = text.match(/<definitions[^>]*>/i) || text.match(/<Definitions[^>]*>/i);
  if (definitionsMatch) {
    const xmlStart = text.indexOf(definitionsMatch[0]);
    const xmlContent = text.substring(xmlStart).trim();
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlContent}`;
  }

  return text.trim();
}

/**
 * Apply quick sanitization fixes for common LLM DMN XML mistakes.
 */
function sanitizeDmnXml(xml: string): string {
  let sanitized = xml;

  sanitized = sanitized.replace(/dmn:/gi, '');

  const standardNamespaces = {
    dmndi: 'https://www.omg.org/spec/DMN/20191111/DMNDI/',
    dc: 'http://www.omg.org/spec/DMN/20180521/DC/',
    di: 'http://www.omg.org/spec/DMN/20180521/DI/'
  };

  const rootDefinitionsMatch = sanitized.match(/<definitions([^>]*)>/i);
  if (rootDefinitionsMatch) {
    const rootAttrs = rootDefinitionsMatch[1];
    let needsUpdate = false;
    let updatedAttrs = rootAttrs;

    for (const [prefix, uri] of Object.entries(standardNamespaces)) {
      const namespacePattern = new RegExp(`xmlns:${prefix}=`, 'i');
      if (!namespacePattern.test(rootAttrs)) {
        const elsewhereMatch = sanitized.match(new RegExp(`xmlns:${prefix}="([^"]+)"`, 'i'));
        const namespaceUri = elsewhereMatch ? elsewhereMatch[1] : uri;
        updatedAttrs += ` xmlns:${prefix}="${namespaceUri}"`;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      sanitized = sanitized.replace(/<definitions([^>]*)>/i, `<definitions${updatedAttrs}>`);
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

  for (let i = 0; i < 3; i++) {
    const before = sanitized;
    sanitized = sanitized.replace(/<text\/>\s*([\s\S]*?)<\/text>/g, '<text>$1</text>');
    if (before === sanitized) break;
  }

  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*\n\s*<text\/>([\s\S]*?)<\/text>\s*\n\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*\n\s*<text>([\s\S]*?)<\/text>\s*\n\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*<text\/>([\s\S]*?)<\/text>\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*<text>([\s\S]*?)<\/text>\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');

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

  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
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

  let updatedXml = xml;
  let requirementIdCounter = 1;

  updatedXml = updatedXml.replace(/<informationRequirement([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('id=')) {
      return `<informationRequirement${attrs} id="InformationRequirement_gen_${requirementIdCounter++}">`;
    }
    return match;
  });

  const decisionMatches = updatedXml.matchAll(/<decision[^>]*id="([^"]+)"[^>]*name="([^"]*)"[^>]*>/gi);
  const inputDataMatches = updatedXml.matchAll(/<inputData[^>]*id="([^"]+)"[^>]*name="([^"]*)"[^>]*>/gi);

  const decisions: Array<{ id: string; name: string }> = [];
  const inputData: Array<{ id: string; name: string }> = [];

  for (const match of decisionMatches) {
    decisions.push({ id: match[1], name: match[2] || match[1] });
  }

  for (const match of inputDataMatches) {
    inputData.push({ id: match[1], name: match[2] || match[1] });
  }

  const infoReqs: Array<{ decisionId: string; sourceId: string; reqId: string }> = [];

  const decisionBlocks = updatedXml.matchAll(/<decision[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/decision>/gi);
  for (const decisionBlock of decisionBlocks) {
    const decisionId = decisionBlock[1];
    const decisionContent = decisionBlock[2];

    const infoReqBlocks = decisionContent.matchAll(/<informationRequirement[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/informationRequirement>/gi);

    for (const infoReqBlock of infoReqBlocks) {
      const reqId = infoReqBlock[1];
      const content = infoReqBlock[2];

      const reqInputMatch = content.match(/<requiredInput[^>]*href="#([^"]+)"/);
      if (reqInputMatch) {
        infoReqs.push({ decisionId, sourceId: reqInputMatch[1], reqId });
      }

      const reqDecMatch = content.match(/<requiredDecision[^>]*href="#([^"]+)"/);
      if (reqDecMatch) {
        infoReqs.push({ decisionId, sourceId: reqDecMatch[1], reqId });
      }
    }
  }

  let dmndiSection = '\n  <dmndi:DMNDI>\n    <dmndi:DMNDiagram id="DMNDiagram_1">\n';

  let inputY = 100;
  for (const input of inputData) {
    dmndiSection += `      <dmndi:DMNShape id="DMNShape_${input.id}" dmnElementRef="${input.id}">\n`;
    dmndiSection += `        <dc:Bounds x="150" y="${inputY}" width="125" height="45"/>\n`;
    dmndiSection += `      </dmndi:DMNShape>\n`;
    inputY += 100;
  }

  let decisionY = 100;
  for (const decision of decisions) {
    dmndiSection += `      <dmndi:DMNShape id="DMNShape_${decision.id}" dmnElementRef="${decision.id}">\n`;
    dmndiSection += `        <dc:Bounds x="500" y="${decisionY}" width="180" height="80"/>\n`;
    dmndiSection += `      </dmndi:DMNShape>\n`;
    decisionY += 150;
  }

  for (const req of infoReqs) {
    let sourceIndex = inputData.findIndex(inp => inp.id === req.sourceId);
    let isInput = sourceIndex !== -1;
    let sourceYPos = 0;
    let sourceXPos = 0;

    if (isInput) {
      sourceYPos = 100 + (sourceIndex * 100) + 22.5;
      sourceXPos = 275;
    } else {
      sourceIndex = decisions.findIndex(dec => dec.id === req.sourceId);
      if (sourceIndex !== -1) {
        sourceYPos = 100 + (sourceIndex * 150) + 40;
        sourceXPos = 590;
      }
    }

    const decisionIndex = decisions.findIndex(dec => dec.id === req.decisionId);

    if (sourceIndex !== -1 && decisionIndex !== -1) {
      const targetYPos = 100 + (decisionIndex * 150) + 40;
      const targetXPos = 500;

      dmndiSection += `      <dmndi:DMNEdge id="DMNEdge_${req.reqId}" dmnElementRef="${req.reqId}">\n`;

      if (isInput) {
        dmndiSection += `        <di:waypoint x="${sourceXPos}" y="${sourceYPos}"/>\n`;
        dmndiSection += `        <di:waypoint x="${targetXPos}" y="${targetYPos}"/>\n`;
      } else {
        dmndiSection += `        <di:waypoint x="590" y="${sourceYPos + 40}"/>\n`;
        dmndiSection += `        <di:waypoint x="590" y="${targetYPos - 40}"/>\n`;
      }

      dmndiSection += `      </dmndi:DMNEdge>\n`;
    }
  }

  dmndiSection += '    </dmndi:DMNDiagram>\n  </dmndi:DMNDI>\n';

  if (updatedXml.includes('</definitions>')) {
    return updatedXml.replace('</definitions>', `${dmndiSection}</definitions>`);
  }

  return updatedXml.trim() + dmndiSection;
}

/**
 * Fix DMNDI layout issues - ensure proper bounds and spacing
 */
function fixDmndiLayout(xml: string): string {
  let fixed = xml;

  fixed = ensureDmndiExists(fixed);

  fixed = fixed.replace(/<definitions[^>]*>/gi, (match) => {
    return match.replace(/\s+name\s*=\s*("[^"]*"|'[^']*')/gi, '');
  });

  fixed = fixed.replace(/<dmndi:DMNDiagram[^>]*>/gi, (match) => {
    return match.replace(/\s+name\s*=\s*("[^"]*"|'[^']*')/gi, '');
  });

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

  fixed = fixed.replace(/<di:waypoint\s+x="([^"]+)"\s+y="([^"]+)"\s*\/>/gi, (match, x, y) => {
    const xNum = parseFloat(x) || 0;
    const yNum = parseFloat(y) || 0;
    const fixedX = Math.max(0, Math.min(xNum, 2000));
    const fixedY = Math.max(0, Math.min(yNum, 2000));
    return `<di:waypoint x="${fixedX}" y="${fixedY}"/>`;
  });

  const diagramCount = (fixed.match(/<dmndi:DMNDiagram/g) || []).length;
  if (diagramCount > 1) {
    console.log(`[Layout Fix] Found ${diagramCount} diagrams, ensuring proper structure`);
  }

  const shapeMatches = fixed.matchAll(/<dmndi:DMNShape[^>]*dmnElementRef="([^"]+)"[^>]*>[\s\S]*?<dc:Bounds\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"[^>]*\/>/gi);
  const shapes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];

  for (const match of shapeMatches) {
    shapes.push({ 
      id: match[1], 
      x: parseFloat(match[2]) || 0, 
      y: parseFloat(match[3]) || 0, 
      width: parseFloat(match[4]) || 100, 
      height: parseFloat(match[5]) || 50 
    });
  }

  if (shapes.length > 0) {
    shapes.sort((a, b) => Math.abs(a.y - b.y) < 10 ? a.x - b.x : a.y - b.y);

    const minSpacing = 20;
    for (let i = 1; i < shapes.length; i++) {
      const prev = shapes[i - 1];
      const curr = shapes[i];

      if (Math.abs(curr.y - prev.y) < 10 && (curr.x - (prev.x + prev.width)) < minSpacing) {
        const newX = prev.x + prev.width + minSpacing;
        fixed = fixed.replace(
          new RegExp(`(<dmndi:DMNShape[^>]*dmnElementRef="${curr.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?<dc:Bounds\\s+x=")[^"]+("\\s+y="[^"]+"[^>]*\\/>)`, 'gi'),
          `$1${newX}$2`
        );
      }
    }
  }

  return fixed;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function validateDmnXml(xml: string): Promise<{ valid: boolean; errorMessage?: string }> {
  try {
    const response = await fetch(
      "https://kvku9vy280.execute-api.us-east-1.amazonaws.com/default/dmnengine",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml })
      }
    );

    if (!response.ok) {
      console.error(`Lambda validation failed with status ${response.status}`);
      const text = await response.text();
      return { valid: false, errorMessage: `Lambda validation error: ${response.status} ${text}` };
    }

    return await response.json();
  } catch (error) {
    console.error("Error calling Lambda validation:", error);
    return { valid: false, errorMessage: `Validation network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

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

    let promptHash: string;
    try {
      promptHash = await generateHash(`${prompt}:dmn`);
    } catch (hashError) {
      console.error('Failed to generate hash:', hashError);
      throw new Error('Failed to generate prompt hash');
    }

    if (!skipCache) {
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

    const systemPrompt = getDmnSystemPrompt();

    const criteria = analyzePrompt(prompt, 'bpmn');
    const modelSelection = selectModel(criteria);
    const { model, maxTokens, temperature } = modelSelection;
    modelUsed = model;

    console.log(`[Model Selection] Using ${model} for DMN generation`);

    if (!skipCache && isSemanticCacheEnabled()) {
      try {
        const embedding = await generateEmbedding(prompt);
        const semanticCache = await checkSemanticCache(embedding, 'dmn', getSemanticSimilarityThreshold());

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
            JSON.stringify({ dmnXml: semanticCache.bpmnXml, cached: true, similarity: semanticCache.similarity }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (embeddingError) {
        console.warn('Semantic cache check failed, continuing with generation:', embeddingError);
      }
    }

    const geminiModel = model.replace('google/', '');

    const maxRetries = 3;
    const baseDelay = 1000;
    let lastError: string | undefined;
    let currentPrompt = prompt;
    let validationError: string | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      let messagesPrompt = currentPrompt;
      if (validationError) {
        messagesPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${validationError}\n\nPlease fix the XML structure based on this error. Ensure strict DMN 1.3 compliance.`;
        console.log(`[Retry] Appending validation error to prompt: ${validationError}`);
      }

      const messages = buildMessagesWithExamples(systemPrompt, messagesPrompt, 'dmn');
      const systemMessage = messages.find((m: any) => m.role === 'system');
      const userMessages = messages.filter((m: any) => m.role === 'user');

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: userMessages.map((m: any) => ({ role: 'user', parts: [{ text: m.content }] })),
              systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
              generationConfig: { maxOutputTokens: maxTokens, temperature: temperature }
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[API Error] Google Gemini API error:', { status: response.status, errorText: errorText.substring(0, 500), attempt: attempt + 1 });

          if (response.status === 429) { lastError = 'Google API rate limit exceeded.'; continue; }
          if (response.status === 503) { lastError = 'Google Gemini service is temporarily overloaded.'; continue; }

          throw new Error(`Google API error: ${errorText}`);
        }

        const data = await response.json();
        let rawResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!rawResponse) {
          console.error('[API Response] Failed to extract DMN XML from response.');
          throw new Error('No content generated from AI model');
        }

        console.log('[API Response] Raw response (first 500 chars):', rawResponse.substring(0, 500));

        rawResponse = rawResponse.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();
        let dmnXml = extractXmlFromResponse(rawResponse);

        console.log('[API Response] Before sanitization (first 1000 chars):', dmnXml.substring(0, 1000));

        dmnXml = sanitizeDmnXml(dmnXml);
        const beforeLayout = dmnXml;
        dmnXml = fixDmndiLayout(dmnXml);
        if (beforeLayout !== dmnXml) console.log('[Layout Fix] Applied layout corrections to DMN diagram');

        let beforeFinal = dmnXml;
        let iterations = 0;
        const maxIterations = 5;

        while (iterations < maxIterations) {
          dmnXml = dmnXml.replace(/<text\/>\s*([\s\S]*?)<\/text>/g, '<text>$1</text>');
          dmnXml = dmnXml.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
            const trimmed = content.trim();
            if (trimmed) {
              const textMatch = trimmed.match(/<text>([\s\S]*?)<\/text>/);
              if (textMatch) return `<${tag}${attrs}><text>${textMatch[1]}</text></${tag}>`;
              if (!trimmed.includes('<')) return `<${tag}${attrs}><text>${trimmed}</text></${tag}>`;
              return `<${tag}${attrs}>${content}</${tag}>`;
            }
            return match;
          });

          if (beforeFinal === dmnXml) break;
          beforeFinal = dmnXml;
          iterations++;
        }

        if (iterations > 0) console.log(`[Sanitization] Additional fixes applied in ${iterations} iteration(s)`);

        console.log('[API Response] After sanitization (first 1000 chars):', dmnXml.substring(0, 1000));

        if (!dmnXml.startsWith('<?xml')) throw new Error('Generated content is not valid XML - missing XML declaration');
        if (!dmnXml.includes('<definitions') && !dmnXml.includes('<Definitions')) throw new Error('Generated DMN XML is invalid or incomplete');

        console.log(`[Validation] Validating attempt ${attempt + 1} via Lambda...`);
        const validationResult = await validateDmnXml(dmnXml);

        if (validationResult.valid) {
          console.log(`[Validation] Attempt ${attempt + 1} PASSED.`);

          if (!skipCache) {
            (async () => {
              try {
                let embedding: number[] | undefined;
                if (isSemanticCacheEnabled()) {
                  try { embedding = await generateEmbedding(prompt); } catch (e) { console.warn('Failed to generate embedding:', e); }
                }
                await storeExactHashCache(promptHash, prompt, 'dmn', dmnXml, embedding);
              } catch (cacheError) {
                console.error('Failed to store in cache:', cacheError);
              }
            })();
          }

          const responseTime = Date.now() - startTime;

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
        } else {
          console.warn(`[Validation] Attempt ${attempt + 1} FAILED: ${validationResult.errorMessage}`);
          validationError = validationResult.errorMessage;
          lastError = `Validation failed: ${validationResult.errorMessage}`;
        }

      } catch (fetchError) {
        console.error(`[API Request] Fetch attempt ${attempt + 1}/${maxRetries} failed:`, fetchError);
        lastError = fetchError instanceof Error ? fetchError.message : 'Network error';
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError}`);

  } catch (error) {
    errorOccurred = true;
    errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('Error in generate-dmn function:', { error: errorMessage, promptLength, modelUsed, cacheType });

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
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
