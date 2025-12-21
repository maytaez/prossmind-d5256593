import { serve } from '../shared/aws-shim.ts';

import { generateHash, checkExactHashCache, storeExactHashCache, checkSemanticCache } from '../shared/cache.ts';
import { generateEmbedding, isSemanticCacheEnabled, getSemanticSimilarityThreshold } from '../shared/embeddings.ts';
import { logPerformanceMetric, measureExecutionTime } from '../shared/metrics.ts';
import { getDmnSystemPrompt, buildMessagesWithExamples } from '../shared/prompts.ts';
import { analyzePrompt, selectModel } from '../shared/model-selection.ts';

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
      // Remove each namespace declaration regardless of position in attributes
      sanitized = sanitized.replace(/<dmndi:DMNDI([^>]*?)\s+xmlns:dmndi="[^"]+"([^>]*?)>/gi, '<dmndi:DMNDI$1$2>');
      sanitized = sanitized.replace(/<dmndi:DMNDI([^>]*?)\s+xmlns:dc="[^"]+"([^>]*?)>/gi, '<dmndi:DMNDI$1$2>');
      sanitized = sanitized.replace(/<dmndi:DMNDI([^>]*?)\s+xmlns:di="[^"]+"([^>]*?)>/gi, '<dmndi:DMNDI$1$2>');
      // Handle cases where namespace might be at the start (no space before)
      sanitized = sanitized.replace(/<dmndi:DMNDI\s*xmlns:dmndi="[^"]+"\s*([^>]*?)>/gi, '<dmndi:DMNDI $1>');
      sanitized = sanitized.replace(/<dmndi:DMNDI\s*xmlns:dc="[^"]+"\s*([^>]*?)>/gi, '<dmndi:DMNDI $1>');
      sanitized = sanitized.replace(/<dmndi:DMNDI\s*xmlns:di="[^"]+"\s*([^>]*?)>/gi, '<dmndi:DMNDI $1>');
      // Clean up any remaining whitespace issues (multiple spaces, trailing spaces)
      sanitized = sanitized.replace(/<dmndi:DMNDI\s{2,}/g, '<dmndi:DMNDI ');
      sanitized = sanitized.replace(/<dmndi:DMNDI\s+>/g, '<dmndi:DMNDI>');
    }
  }

  // Step 1: Fix self-closing text tags with content: <text/>Content</text> -> <text>Content</text>
  // This must be done first - handle all variations including with whitespace
  // Run multiple times to catch nested or complex cases
  for (let i = 0; i < 3; i++) {
    const before = sanitized;
    // Pattern: <text/> followed by optional whitespace, then content, then </text>
    // Non-greedy match to avoid matching across multiple text tags
    sanitized = sanitized.replace(/<text\/>\s*([\s\S]*?)<\/text>/g, '<text>$1</text>');
    if (before === sanitized) break; // No more changes
  }

  // Step 2: Fix malformed inputEntry/outputEntry patterns
  // Pattern 1: <inputEntry id="..."/>\n    <text/>content</text>\n</inputEntry>
  // This handles the case where inputEntry is self-closing, then there's a malformed text tag
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*\n\s*<text\/>([\s\S]*?)<\/text>\s*\n\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');

  // Pattern 2: <inputEntry id="..."/>\n    <text>content</text>\n</inputEntry>
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*\n\s*<text>([\s\S]*?)<\/text>\s*\n\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');

  // Pattern 3: <inputEntry id="..."/> <text/>content</text> </inputEntry> (no newlines)
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*<text\/>([\s\S]*?)<\/text>\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');

  // Pattern 4: <inputEntry id="..."/> <text>content</text> </inputEntry> (no newlines)
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*<text>([\s\S]*?)<\/text>\s*<\/\1>/g, '<$1$2><text>$3</text></$1>');

  // Step 3: Fix any remaining self-closing inputEntry/outputEntry that have a closing tag
  // This catches edge cases where there's content between the self-closing tag and closing tag
  sanitized = sanitized.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
    const trimmed = content.trim();
    // If there's content between the self-closing tag and closing tag
    if (trimmed) {
      // If content contains a text tag (already fixed), extract it and wrap properly
      const textMatch = trimmed.match(/<text>([\s\S]*?)<\/text>/);
      if (textMatch) {
        return `<${tag}${attrs}><text>${textMatch[1]}</text></${tag}>`;
      }
      // If content is just text without tags, wrap it in a text tag
      if (!trimmed.includes('<')) {
        return `<${tag}${attrs}><text>${trimmed}</text></${tag}>`;
      }
      // If it has other tags, wrap the entire content
      return `<${tag}${attrs}>${content}</${tag}>`;
    }
    // If no content, this shouldn't happen but return as-is
    return match;
  });

  // Fix unescaped ampersands (but not already escaped ones)
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');

  // Fix XML declaration issues
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');

  return sanitized.trim();
}

/**
 * Ensure DMNDI section exists - add it if missing
 */
function ensureDmndiExists(xml: string): string {
  // Check if DMNDI section exists
  if (xml.includes('<dmndi:DMNDI>') || xml.includes('<dmndi:DMNDiagram')) {
    return xml; // DMNDI already exists
  }

  console.log('[DMNDI Fix] DMNDI section missing, generating it...');
  console.log('[DMNDI Fix] Processing XML length:', xml.length);

  let updatedXml = xml;
  let requirementIdCounter = 1;

  // 1. Ensure IDs for informationRequirements
  // We need to replace informationRequirement tags that don't have IDs
  updatedXml = updatedXml.replace(/<informationRequirement([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes('id=')) {
      return `<informationRequirement${attrs} id="InformationRequirement_gen_${requirementIdCounter++}">`;
    }
    return match;
  });

  // Extract all decision and inputData IDs
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

  // Extract information requirements WITH IDs
  const infoReqs: Array<{ decisionId: string; sourceId: string; reqId: string }> = [];

  const decisionBlocks = updatedXml.matchAll(/<decision[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/decision>/gi);
  for (const decisionBlock of decisionBlocks) {
    const decisionId = decisionBlock[1];
    const decisionContent = decisionBlock[2];

    // Match informationRequirement blocks to get their IDs and contents
    // We use a simplified regex that assumes the ID was added or exists
    const infoReqBlocks = decisionContent.matchAll(/<informationRequirement[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/informationRequirement>/gi);

    for (const infoReqBlock of infoReqBlocks) {
      const reqId = infoReqBlock[1];
      const content = infoReqBlock[2];

      // Check for requiredInput
      const reqInputMatch = content.match(/<requiredInput[^>]*href="#([^"]+)"/);
      if (reqInputMatch) {
        infoReqs.push({ decisionId, sourceId: reqInputMatch[1], reqId });
      }

      // Check for requiredDecision
      const reqDecMatch = content.match(/<requiredDecision[^>]*href="#([^"]+)"/);
      if (reqDecMatch) {
        infoReqs.push({ decisionId, sourceId: reqDecMatch[1], reqId });
      }
    }
  }

  // Generate DMNDI section
  let dmndiSection = '\n  <dmndi:DMNDI>\n    <dmndi:DMNDiagram id="DMNDiagram_1">\n';

  // Add shapes for input data (positioned on the left)
  let inputY = 100;
  for (const input of inputData) {
    dmndiSection += `      <dmndi:DMNShape id="DMNShape_${input.id}" dmnElementRef="${input.id}">\n`;
    dmndiSection += `        <dc:Bounds x="150" y="${inputY}" width="125" height="45"/>\n`;
    dmndiSection += `      </dmndi:DMNShape>\n`;
    inputY += 100;
  }

  // Add shapes for decisions (positioned on the right)
  let decisionY = 100;
  for (const decision of decisions) {
    dmndiSection += `      <dmndi:DMNShape id="DMNShape_${decision.id}" dmnElementRef="${decision.id}">\n`;
    dmndiSection += `        <dc:Bounds x="500" y="${decisionY}" width="180" height="80"/>\n`;
    dmndiSection += `      </dmndi:DMNShape>\n`;
    decisionY += 150;
  }

  // Add edges for information requirements
  let edgeCounter = 1;
  for (const req of infoReqs) {
    // Find source shape (could be input or decision)
    let sourceIndex = inputData.findIndex(inp => inp.id === req.sourceId);
    let isInput = sourceIndex !== -1;
    let sourceYPos = 0;
    let sourceXPos = 0;

    if (isInput) {
      sourceYPos = 100 + (sourceIndex * 100) + 22.5; // Center of input shape
      sourceXPos = 275; // Right edge of input (150 + 125)
    } else {
      sourceIndex = decisions.findIndex(dec => dec.id === req.sourceId);
      if (sourceIndex !== -1) {
        sourceYPos = 100 + (sourceIndex * 150) + 40; // Center of decision shape
        sourceXPos = 680; // Right edge of decision (500 + 180) - wait, if it's decision to decision, we might want different layout
        // For simplicity, let's assume simple left-to-right flow or just connect centers
        sourceXPos = 590; // Center X of decision
      }
    }

    const decisionIndex = decisions.findIndex(dec => dec.id === req.decisionId);

    if (sourceIndex !== -1 && decisionIndex !== -1) {
      const targetYPos = 100 + (decisionIndex * 150) + 40; // Center of target decision
      const targetXPos = 500; // Left edge of target decision

      dmndiSection += `      <dmndi:DMNEdge id="DMNEdge_${req.reqId}" dmnElementRef="${req.reqId}">\n`;

      // Simple waypoint logic
      if (isInput) {
        dmndiSection += `        <di:waypoint x="${sourceXPos}" y="${sourceYPos}"/>\n`;
        dmndiSection += `        <di:waypoint x="${targetXPos}" y="${targetYPos}"/>\n`;
      } else {
        // Decision to Decision
        // If source is above target
        dmndiSection += `        <di:waypoint x="590" y="${sourceYPos + 40}"/>\n`; // Bottom of source
        dmndiSection += `        <di:waypoint x="590" y="${targetYPos - 40}"/>\n`; // Top of target
      }

      dmndiSection += `      </dmndi:DMNEdge>\n`;
      edgeCounter++;
    }
  }

  dmndiSection += '    </dmndi:DMNDiagram>\n  </dmndi:DMNDI>\n';

  // Insert DMNDI before closing </definitions> tag
  if (updatedXml.includes('</definitions>')) {
    return updatedXml.replace('</definitions>', `${dmndiSection}</definitions>`);
  }

  // If no closing tag found, append before end
  return updatedXml.trim() + dmndiSection;
}

/**
 * Fix DMNDI layout issues - ensure proper bounds and spacing
 */
function fixDmndiLayout(xml: string): string {
  let fixed = xml;

  // First ensure DMNDI exists
  fixed = ensureDmndiExists(fixed);

  // Remove ALL name attributes from definitions element
  // Remove ALL name attributes from definitions element
  fixed = fixed.replace(/<definitions[^>]*>/gi, (match) => {
    return match.replace(/\s+name\s*=\s*("[^"]*"|'[^']*')/gi, '');
  });

  // Remove ALL name attributes from DMNDiagram elements
  fixed = fixed.replace(/<dmndi:DMNDiagram[^>]*>/gi, (match) => {
    return match.replace(/\s+name\s*=\s*("[^"]*"|'[^']*')/gi, '');
  });

  // Ensure DMNShape elements have reasonable bounds
  // Fix bounds that are too large or positioned incorrectly
  // First, identify decision shapes vs input data shapes
  fixed = fixed.replace(/<dmndi:DMNShape[^>]*dmnElementRef="([^"]+)"[^>]*>[\s\S]*?<dc:Bounds\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"\s*\/>/gi, (match, elementRef, x, y, width, height) => {
    const isDecision = elementRef.includes('Decision_') || elementRef.startsWith('Decision');
    const isInputData = elementRef.includes('InputData_') || elementRef.startsWith('InputData');

    const xNum = parseFloat(x) || 0;
    const yNum = parseFloat(y) || 0;
    let widthNum = parseFloat(width) || (isDecision ? 600 : 150);
    let heightNum = parseFloat(height) || (isDecision ? 300 : 50);

    // Ensure minimum and maximum reasonable sizes
    if (isDecision) {
      // Decision tables need larger bounds
      if (widthNum < 400) widthNum = 600;
      if (widthNum > 1200) widthNum = 800; // Cap at reasonable max
      if (heightNum < 200) heightNum = 300;
      if (heightNum > 800) heightNum = 500; // Cap at reasonable max
    } else if (isInputData) {
      // Input data can be smaller
      if (widthNum < 80) widthNum = 150;
      if (widthNum > 300) widthNum = 200;
      if (heightNum < 40) heightNum = 50;
      if (heightNum > 200) heightNum = 80;
    } else {
      // Default bounds for unknown types
      if (widthNum < 80) widthNum = 100;
      if (widthNum > 300) widthNum = 200;
      if (heightNum < 40) heightNum = 50;
      if (heightNum > 200) heightNum = 80;
    }

    // Ensure coordinates are reasonable (not negative, not too large)
    const fixedX = Math.max(0, Math.min(xNum, 2000));
    // Ensure y position leaves room at top for labels (minimum 80px from top)
    const fixedY = Math.max(80, Math.min(yNum, 2000));

    // Return the full DMNShape with updated bounds
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

  // If there are multiple DMNDiagram elements, ensure they're properly structured
  // Count diagrams and ensure they have proper structure
  const diagramCount = (fixed.match(/<dmndi:DMNDiagram/g) || []).length;
  if (diagramCount > 1) {
    console.log(`[Layout Fix] Found ${diagramCount} diagrams, ensuring proper structure`);
  }

  // Ensure DMNDiagram has reasonable positioning
  // The diagram itself doesn't have bounds, but we can ensure shapes are well-positioned
  // Recalculate positions to ensure proper spacing if needed
  const shapeMatches = fixed.matchAll(/<dmndi:DMNShape[^>]*dmnElementRef="([^"]+)"[^>]*>[\s\S]*?<dc:Bounds\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"[^>]*\/>/gi);
  const shapes: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];

  for (const match of shapeMatches) {
    const elementRef = match[1];
    const x = parseFloat(match[2]) || 0;
    const y = parseFloat(match[3]) || 0;
    const width = parseFloat(match[4]) || 100;
    const height = parseFloat(match[5]) || 50;
    shapes.push({ id: elementRef, x, y, width, height });
  }

  // If shapes are too close together or overlapping, adjust them
  // This is a simple fix - in production you might want more sophisticated layout
  if (shapes.length > 0) {
    // Sort shapes by y position, then x
    shapes.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 10) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    // Ensure minimum spacing between shapes
    const minSpacing = 20;
    for (let i = 1; i < shapes.length; i++) {
      const prev = shapes[i - 1];
      const curr = shapes[i];

      // If shapes are on similar y-level and too close, adjust
      if (Math.abs(curr.y - prev.y) < 10 && (curr.x - (prev.x + prev.width)) < minSpacing) {
        const newX = prev.x + prev.width + minSpacing;
        // Update the XML with new position
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



export const handler = serve(async (req) => {
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

    const GOOGLE_API_KEY = process.env['GOOGLE_API_KEY'];
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

    // Retry mechanism
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

      // If we have a validation error from previous attempt, append it to prompt
      let messagesPrompt = currentPrompt;
      if (validationError) {
        messagesPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${validationError}\n\nPlease fix the XML structure based on this error. Ensure strict DMN 1.3 compliance.`;
        console.log(`[Retry] Appending validation error to prompt: ${validationError}`);
      }

      // Build messages array for Gemini format
      const messages = buildMessagesWithExamples(systemPrompt, messagesPrompt, 'dmn');
      const systemMessage = messages.find((m: any) => m.role === 'system');
      const userMessages = messages.filter((m: any) => m.role === 'user');

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
            lastError = 'Google API rate limit exceeded.';
            continue; // Retry on rate limit
          }

          if (response.status === 503) {
            lastError = 'Google Gemini service is temporarily overloaded.';
            continue; // Retry on overload
          }

          throw new Error(`Google API error: ${errorText}`);
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

        console.log('[API Response] Before sanitization (first 1000 chars):', dmnXml.substring(0, 1000));

        // Sanitize XML to fix common LLM mistakes
        dmnXml = sanitizeDmnXml(dmnXml);

        // Fix DMNDI layout issues (bounds, spacing, positioning)
        const beforeLayout = dmnXml;
        dmnXml = fixDmndiLayout(dmnXml);
        if (beforeLayout !== dmnXml) {
          console.log('[Layout Fix] Applied layout corrections to DMN diagram');
        }

        // Additional pass: Check for any remaining malformed patterns and fix them
        let beforeFinal = dmnXml;
        let iterations = 0;
        const maxIterations = 5;

        while (iterations < maxIterations) {
          // Fix any remaining <text/>Content</text> patterns
          dmnXml = dmnXml.replace(/<text\/>\s*([\s\S]*?)<\/text>/g, '<text>$1</text>');

          // Fix any remaining self-closing inputEntry/outputEntry with content
          dmnXml = dmnXml.replace(/<(inputEntry|outputEntry)([^>]*?)\/>\s*([\s\S]*?)<\/\1>/g, (match, tag, attrs, content) => {
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

          if (beforeFinal === dmnXml) {
            break; // No more changes needed
          }
          beforeFinal = dmnXml;
          iterations++;
        }

        if (iterations > 0) {
          console.log(`[Sanitization] Additional fixes applied in ${iterations} iteration(s)`);
        }

        console.log('[API Response] After sanitization (first 1000 chars):', dmnXml.substring(0, 1000));

        // Validate XML structure locally first
        if (!dmnXml.startsWith('<?xml')) {
          throw new Error('Generated content is not valid XML - missing XML declaration');
        }

        if (!dmnXml.includes('<definitions') && !dmnXml.includes('<Definitions')) {
          throw new Error('Generated DMN XML is invalid or incomplete - missing definitions element');
        }

        // Skip Lambda validation as requested
        console.log(`[Validation] Skipping Lambda validation for attempt ${attempt + 1}.`);

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
        // Continue to next iteration to retry
      }
    }

    throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError}`);

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
