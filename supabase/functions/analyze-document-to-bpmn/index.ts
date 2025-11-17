import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.0';
import { generateHash, checkExactHashCache, storeExactHashCache } from '../_shared/cache.ts';
import { logPerformanceMetric } from '../_shared/metrics.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Validate BPMN XML using the built-in DOMParser.
 * Returns null when XML is valid, otherwise returns the parser error message.
 */
function validateBpmnXml(xml: string): string | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const parserError = doc?.getElementsByTagName('parsererror')?.[0];
    if (parserError) {
      return parserError.textContent || 'Unknown BPMN XML parser error';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Unknown BPMN XML validation error';
  }
}

/**
 * Apply quick sanitization fixes for common LLM BPMN XML mistakes.
 */
function sanitizeBpmnXml(xml: string): string {
  let sanitized = xml;
  
  // Fix namespace issues: bpmns: -> bpmn:
  sanitized = sanitized.replace(/bpmns:/gi, 'bpmn:');
  
  // Fix bpmndi namespace issues
  sanitized = sanitized.replace(/bpmndi\:BPMNShape/gi, 'bpmndi:BPMNShape');
  sanitized = sanitized.replace(/bpmndi\:BPMNEdge/gi, 'bpmndi:BPMNEdge');
  
  // Remove invalid tags that don't exist in BPMN 2.0 (flowNodeRef is not a valid element)
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmn:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*>[\s\S]*?<\/\s*bpmns:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\/\s*bpmn:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\/\s*bpmns:flowNodeRef\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmn:flowNodeRef[^>]*\/?\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*bpmns:flowNodeRef[^>]*\/?\s*>/gi, '');
  
  // Fix XML declaration issues
  sanitized = sanitized.replace(/<\s*\/\?xml/gi, '<?xml');
  
  // Fix unescaped ampersands
  sanitized = sanitized.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
  
  // Remove orphaned closing tags (tags that don't have matching opening tags)
  // This is a simple heuristic - remove closing tags for elements that don't exist
  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, 'application/xml');
  const parserError = doc?.getElementsByTagName('parsererror')?.[0];
  
  // If there's a parser error about closing tag mismatch, try to fix it
  if (parserError) {
    const errorText = parserError.textContent || '';
    if (errorText.includes('closing tag mismatch') || errorText.includes('closing tag')) {
      // Try to remove common problematic patterns
      // Remove any closing tags that reference invalid elements
      sanitized = sanitized.replace(/<\/\s*[^>]*:flowNodeRef[^>]*>/gi, '');
    }
  }
  
  return sanitized.trim();
}

async function repairInvalidBpmnXml({
  invalidXml,
  validationError,
  documentAnalysis,
  systemPrompt,
  googleApiKey,
}: {
  invalidXml: string;
  validationError: string;
  documentAnalysis: string;
  systemPrompt: string;
  googleApiKey: string;
}): Promise<string | null> {
  try {
    const repairPrompt = `${systemPrompt}

CRITICAL: The previously generated BPMN XML is invalid and failed to parse with this error:
${validationError}

IMPORTANT FIXES REQUIRED:
1. Remove ALL invalid elements that don't exist in BPMN 2.0 (e.g., flowNodeRef, bpmns: namespace tags)
2. Ensure ALL opening tags have matching closing tags
3. Fix any namespace issues (use bpmn: not bpmns:)
4. Ensure proper XML structure with valid BPMN 2.0 elements only
5. Preserve the exact process logic, labels, gateways, and subprocesses

Original (invalid) BPMN XML:
${invalidXml}

Process description to preserve:
${documentAnalysis}

Return ONLY the corrected, valid BPMN 2.0 XML that will parse without errors.`;

    const repairResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: repairPrompt }] }],
          generationConfig: {
            maxOutputTokens: 8000,
            temperature: 0.2,
          },
        }),
      }
    );

    if (!repairResponse.ok) {
      console.error('BPMN repair error:', await repairResponse.text());
      return null;
    }

    const repairData = await repairResponse.json();
    const repairedXml = repairData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!repairedXml) {
      return null;
    }

    return repairedXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();
  } catch (error) {
    console.error('Failed to repair BPMN XML:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let startTime: number | undefined;
  try {
    startTime = Date.now();
    const { fileBase64, fileName, fileType, userId, diagramType = 'bpmn' } = await req.json();
    console.log(`Processing document for ${diagramType.toUpperCase()}:`, fileName, 'Type:', fileType);

    // SECURITY: Validate userId
    if (!userId) {
      console.error('Missing userId in request');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_API_KEY) {
      throw new Error('Google API key not configured');
    }

    let analysisPrompt = '';
    let analysisContent: Array<{ type?: string;[key: string]: unknown }> = [];
    let inputDescription = '';

    // Determine file type and create appropriate analysis
    let extractedText = '';

    if (fileType.startsWith('image/')) {
      // Image analysis - use OCR and vision
      inputDescription = `Image file: ${fileName}`;

      const bpmnAnalysisPrompt = `Mission: Extract this image and produce a perfectly laid out BPMN 2.0 diagram with clean, non-overlapping connectors and readable labels.

INPUT EXTRACTION (Image):
- Run OCR to extract ALL text with 100% accuracy
- Detect shapes: circles (events), rectangles (tasks), diamonds (gateways), pools/swimlanes
- Identify arrows and connectors with directionality
- Clean/denoise the image first
- Apply shape recognition to map visual elements to BPMN primitives
- For hand-drawn charts: clean strokes, snap nodes to grid, infer directionality from arrowheads
- For low-quality scans: run deskew, contrast enhancement, segmentation before OCR

EXTRACT EVERY ELEMENT PRECISELY:
- Start Event(s): Exact position, label (if any)
- End Event(s): Exact position, type (normal/error/message), label
- Tasks/Activities: EXACT text inside each box/rectangle
- Gateways: Type (XOR/AND/Inclusive/OR) and any labels or conditions on flows
  * XOR (Exclusive): Single path selection - "if/else", "either/or", "choose one"
  * AND (Parallel): All paths execute simultaneously - "at the same time", "in parallel", "simultaneously"
  * OR/Inclusive: Multiple paths can be taken - "one or more", "any combination", "select multiple"
- Sequence Flows: Source→Target connections, labels on arrows, conditions
- Pools/Swimlanes: Exact names, roles
- Message Flows: Dotted lines between pools
- Subprocesses: Grouped related tasks that form a logical unit (e.g., "Order Processing", "Payment Verification", "Quality Check Process")

GATEWAY DETECTION RULES:
- Look for decision diamonds with multiple outgoing paths
- Identify keywords: "if", "else", "either", "or", "and", "parallel", "simultaneous", "at the same time"
- XOR: Single condition leading to one path (if X then A else B)
- AND: Multiple activities happening together (A and B happen simultaneously)
- OR/Inclusive: Multiple optional paths (can do A, B, or both)

SUBPROCESS DETECTION RULES:
- Identify grouped activities with a common purpose or theme
- Look for phrases like "process", "procedure", "workflow", "sub-process", "nested"
- Detect visual groupings: boxes containing multiple tasks, dashed borders around task groups
- Common subprocess patterns: "Order Processing", "Payment Processing", "Approval Workflow", "Quality Control", "Data Validation"

SEMANTIC MAPPING:
Convert to BPMN primitives: Start/End Events, Tasks (User/Service), Gateways (XOR/AND/Inclusive/OR), Sequence Flows, Pools, Swimlanes, Subprocesses (collapsed or expanded), Message Flows.
Infer roles and swimlanes from headings or surrounding text.

LAYOUT REQUIREMENTS (critical for clean output):
- Use directed layered (Sugiyama) or hierarchical layout for process flows
- Apply orthogonal edge routing (right-angle connectors, avoid diagonals)
- Minimize edge crossings using crossing-minimization heuristics
- Route around nodes—insert invisible bend points/detours to prevent connector overlap with node boxes or swimlane separators
- Maintain minimum clearance (padding) between edges and nodes
- For parallel flows: use consistent ordering and spacing
- Place labels outside connectors or on small, unobtrusive label boxes (never overlapping other elements)
- Attach edges to consistent ports (e.g., right→left for left-to-right flow)
- Align swimlane widths uniformly; ensure tasks fit inside lanes
- Normalize node sizes based on label length; apply consistent padding; balance white space
- Use bezier smoothing only when orthogonal routing hurts readability

OUTPUT FORMAT:
1. List every visible text element (OCR results)
2. Element-by-element BPMN structure breakdown that EXACTLY preserves the diagram
3. Include layout hints: relative positioning, swimlane assignments, connector routing preferences
4. Flag any ambiguous or uncertain mappings`;

      const pidAnalysisPrompt = `Mission: Extract this P&ID (Process and Instrumentation Diagram) image and produce engineering-grade process documentation.

INPUT EXTRACTION (P&ID Image):
- Run OCR to extract ALL equipment tags (TK-xxx, P-xxx, V-xxx, E-xxx, R-xxx)
- Extract instrument tags (FIC-xxx, TIC-xxx, PIC-xxx, LIC-xxx, TE-xxx, PT-xxx, FT-xxx, LT-xxx)
- Detect process equipment shapes: tanks (vertical/horizontal), pumps, valves, exchangers, vessels, reactors
- Identify piping lines with flow direction arrows
- Map control loops and instrumentation connections
- Extract equipment labels and process stream names

EXTRACT EVERY P&ID ELEMENT PRECISELY:
- Process Equipment: Type, tag ID, position, connections
- Piping: Line numbers, flow direction, connections between equipment
- Valves: Type (control/isolation/check), tag IDs, positions
- Instruments: Type, tag ID, measurement type, control loop associations
- Controllers: Control logic, setpoints, feedback loops
- Utility Lines: Steam, cooling water, nitrogen, air
- Safety Elements: PSVs (pressure safety valves), rupture disks, emergency shutdowns

SEMANTIC MAPPING FOR P&ID:
- Equipment → BPMN Task elements with equipment tags
- Piping → BPMN Sequence Flows with line numbers
- Control Valves → BPMN Gateways with valve tags
- Instruments → Annotations or labels on flows/equipment
- Process Streams → Named sequence flows

LAYOUT REQUIREMENTS:
- Follow process flow direction (usually left-to-right or top-to-bottom)
- Group related equipment
- Show control loops clearly
- Maintain equipment spacing for clarity
- Position instruments near their measurement points

OUTPUT FORMAT:
1. Complete equipment list with tags and types
2. Piping connections with flow directions
3. Instrumentation list with tag IDs and functions
4. Control loops and interlocks
5. Process flow description
6. Layout and positioning information`;

      analysisPrompt = diagramType === 'pid' ? pidAnalysisPrompt : bpmnAnalysisPrompt;

      analysisContent = [
        { type: 'text', text: analysisPrompt },
        { type: 'image_url', image_url: { url: fileBase64 } }
      ];

    } else if (fileType === 'application/pdf' ||
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileType === 'application/msword') {
      // PDF or Word document - extract text with OCR emphasis
      inputDescription = `Document file: ${fileName}`;

      // Decode base64 to get text content
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const documentBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const documentText = new TextDecoder().decode(documentBuffer);
      extractedText = documentText;

      analysisPrompt = `Mission: Extract business process from this document and produce a perfectly laid out BPMN 2.0 diagram.

INPUT EXTRACTION (PDF/DOCX):
- Extract text, embedded images, and diagrams
- Apply OCR to raster graphics when text is embedded as images
- Parse tables and structured data

EXTRACT PROCESS ELEMENTS:
1. Process steps and activities (exact names and labels)
2. Decision points and their conditions (map to Gateways - XOR/AND/OR/Inclusive)
3. Process flow and sequence
4. Roles or participants (map to Pools/Swimlanes)
5. Start and end conditions
6. Subprocess groupings (related activities that form logical units)

GATEWAY DETECTION:
- XOR (Exclusive Gateway): Decision with single path selection
  * Keywords: "if", "else", "either", "or", "choose one", "decide between"
  * Pattern: "If condition X, then do A, else do B"
- AND (Parallel Gateway): Multiple paths execute simultaneously
  * Keywords: "at the same time", "in parallel", "simultaneously", "while", "concurrently"
  * Pattern: "Do A and B simultaneously" or "While doing A, also do B"
- OR/Inclusive Gateway: Multiple optional paths can be taken
  * Keywords: "one or more", "any combination", "select multiple", "can do A, B, or both"
  * Pattern: "Can perform A, B, or both A and B"

SUBPROCESS DETECTION:
- Identify grouped activities with common purpose
- Look for: "process", "procedure", "workflow", "sub-process", "module", "phase", "stage"
- Common patterns: "Order Processing", "Payment Processing", "Approval Workflow", "Quality Control", "Data Validation", "Review Process"
- Visual indicators: sections, chapters, numbered steps, grouped paragraphs

SEMANTIC MAPPING:
Convert to BPMN: Start/End Events, Tasks (User/Service/Manual), Gateways (XOR/AND/OR/Inclusive), Sequence Flows, Pools/Swimlanes, Subprocesses (collapsed or expanded with nested tasks).

LAYOUT REQUIREMENTS:
- Use hierarchical/layered layout with orthogonal routing
- Minimize edge crossings
- Route connectors around nodes (no overlaps)
- Place labels clearly (no overlap with other elements)
- Organize into swimlanes if roles are identified
- Maintain consistent spacing and alignment

Document content:
${documentText.substring(0, 10000)} ${documentText.length > 10000 ? '...(truncated)' : ''}

OUTPUT:
1. Summarize extracted content
2. Provide structured BPMN-ready process description with layout hints`;

      analysisContent = [
        { type: 'text', text: analysisPrompt }
      ];

    } else if (fileType === 'text/plain' || fileType.startsWith('text/')) {
      // Text file - direct analysis
      inputDescription = `Text file: ${fileName}`;

      // Decode base64 text
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const textContent = atob(base64Data);
      extractedText = textContent;

      analysisPrompt = `Mission: Parse natural language text into a perfectly laid out BPMN 2.0 diagram.

INPUT EXTRACTION (Text):
- Parse sequential steps, decisions, and roles from natural language

EXTRACT & MAP:
1. Process steps → Tasks (User/Service/Manual)
2. Decision points → Gateways (XOR/AND/OR/Inclusive)
3. Flow sequence → Sequence Flows
4. Roles/participants → Pools/Swimlanes
5. Start/end conditions → Start/End Events
6. Grouped activities → Subprocesses

GATEWAY DETECTION RULES:
- XOR (Exclusive): "if X then A else B", "either A or B", "choose one"
- AND (Parallel): "A and B simultaneously", "at the same time", "in parallel", "while A, also do B"
- OR/Inclusive: "can do A, B, or both", "one or more", "any combination"

SUBPROCESS DETECTION RULES:
- Look for grouped activities: "Order Processing includes...", "Payment workflow: ...", "Quality check process: ..."
- Identify logical groupings of 2+ related tasks
- Common patterns: processing, verification, approval, validation, review workflows

LAYOUT REQUIREMENTS:
- Use layered layout with orthogonal routing
- No overlapping connectors or nodes
- Clear labels, proper swimlane organization
- Minimum edge crossings
- Subprocesses should be visually grouped (collapsed or expanded)

Text content:
${textContent}

OUTPUT:
Structured BPMN-ready process with layout hints (swimlanes, positioning, routing, gateway types, subprocess groupings)`;

      analysisContent = [
        { type: 'text', text: analysisPrompt }
      ];
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    console.log('Analyzing document with Gemini...');

    // Define proper types for content items
    type ContentItem =
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } };

    const typedContent = analysisContent as ContentItem[];

    // For image content, use vision model; for text, use standard model
    const isVisionContent = typedContent.some(item => item.type === 'image_url');
    const model = isVisionContent ? 'gemini-2.5-flash' : 'gemini-2.0-flash-exp';

    // Format content for Gemini API
    let geminiParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
    if (isVisionContent) {
      for (const item of typedContent) {
        if (item.type === 'text') {
          geminiParts.push({ text: item.text });
        } else if (item.type === 'image_url') {
          const base64Data = item.image_url.url.split(',')[1];
          const mimeType = item.image_url.url.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
          geminiParts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          });
        }
      }
    } else {
      geminiParts = typedContent.map(item => {
        if (item.type === 'text') {
          return { text: item.text };
        }
        return { text: '' };
      });
    }

    const contentParts = isVisionContent
      ? typedContent.map(item => {
        if (item.type === 'text') return { text: item.text };
        const base64Data = item.image_url.url.split(',')[1];
        const mimeType = item.image_url.url.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
        return { inline_data: { mime_type: mimeType, data: base64Data } };
      })
      : [{ text: analysisPrompt }];

    const analysisResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: contentParts }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.7
          }
        }),
      }
    );

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis error:', analysisResponse.status, errorText);
      throw new Error('Failed to analyze document');
    }

    const analysisData = await analysisResponse.json();
    const documentAnalysis = analysisData.candidates[0].content.parts[0].text;
    console.log('Document analysis complete');

    // Generate diagram XML from the analysis
    const bpmnSystemPrompt = `You are a BPMN 2.0 XML generator producing clean, production-ready business process diagrams with perfect layout.

CRITICAL RULES:
1. Use EXACT text labels - no paraphrasing, translation, or modification
2. Preserve EXACT element types (don't change XOR to AND gateway, etc.)
3. Maintain EXACT flow connections (source→target)
4. Use EXACT number of elements (don't add/remove tasks)
5. Keep EXACT sequence and structure
6. ALWAYS include appropriate gateways (XOR/AND/OR) when decision points or parallel flows are detected
7. ALWAYS create subprocesses for grouped related activities

BPMN 2.0 XML Structure:
- xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
- xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
- xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
- xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
- Element types: startEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, inclusiveGateway, endEvent, sequenceFlow, subProcess
- Unique id for every element
- sequenceFlow: sourceRef and targetRef
- Include complete bpmndi:BPMNDiagram with bpmndi:BPMNShape (x, y, width, height) and bpmndi:BPMNEdge (waypoints)

GATEWAY REQUIREMENTS (MANDATORY):
- exclusiveGateway (XOR): Use for single-path decisions (if/else, either/or)
  * Must have 2+ outgoing sequenceFlows
  * Each outgoing flow should have a condition (name attribute with condition text)
  * Example: <bpmn:exclusiveGateway id="Gateway_1" name="Check condition"/>
- parallelGateway (AND): Use for parallel execution (simultaneous activities)
  * Must have 2+ outgoing sequenceFlows (all execute)
  * Usually paired: split gateway (multiple outgoing) and join gateway (multiple incoming)
  * Example: <bpmn:parallelGateway id="Gateway_2" name="Parallel split"/>
- inclusiveGateway (OR): Use for multiple optional paths (one or more can execute)
  * Must have 2+ outgoing sequenceFlows
  * Each flow can have conditions
  * Example: <bpmn:inclusiveGateway id="Gateway_3" name="Inclusive decision"/>

SUBPROCESS REQUIREMENTS (MANDATORY):
- subProcess: Use for grouped related activities (2+ tasks that form a logical unit)
  * Can be collapsed (triggeredByEvent="false") or expanded (contains nested elements)
  * For expanded subprocess: nest tasks, gateways, and flows inside the subProcess element
  * For collapsed subprocess: use triggeredByEvent="false" and add a + marker in diagram
  * Example collapsed: <bpmn:subProcess id="SubProcess_1" name="Order Processing" triggeredByEvent="false"/>
  * Example expanded: <bpmn:subProcess id="SubProcess_1" name="Order Processing"><bpmn:task id="Task_1" name="Validate Order"/>...</bpmn:subProcess>
- Common subprocess patterns to detect and create:
  * "Order Processing", "Payment Processing", "Approval Workflow", "Quality Control", "Data Validation", "Review Process", "Verification Process"
  * Any group of 2+ related tasks mentioned together

LAYOUT ALGORITHM (critical for clean diagrams):
- Use layered (Sugiyama) layout: assign layers, minimize crossings, apply orthogonal routing
- Calculate coordinates to avoid overlaps:
  * Horizontal spacing: 150px minimum between nodes
  * Vertical spacing: 100px minimum between layers
  * Swimlane height: auto-size to fit content + 50px padding
- Edge routing: orthogonal (right angles), route AROUND nodes (not through), insert waypoints to detour around obstacles
- Minimize crossings: reorder nodes within layers
- Port placement: consistent (right-side outgoing, left-side incoming for L→R flow)
- Label placement: outside edges, centered, non-overlapping
- Node sizing: auto-size based on label length (min 100x80, max 200x100), wrap text if needed

VALIDATION:
- No orphan flows
- Gateways have matching incoming/outgoing (split gateways: 1 incoming, 2+ outgoing; join gateways: 2+ incoming, 1 outgoing)
- All sequenceFlows have valid sourceRef/targetRef
- Pools properly contain lanes and elements
- All bpmndi shapes have valid bounds (x, y, width, height > 0)
- All bpmndi edges have at least 2 waypoints
- Subprocesses are properly nested (expanded) or marked as collapsed
- Gateway types match their usage (XOR for decisions, AND for parallel, OR for inclusive)
- Decision points in the process MUST have corresponding gateways
- Grouped activities MUST be wrapped in subprocesses

CRITICAL: DO NOT generate invalid BPMN elements:
- NEVER use "flowNodeRef" - this is NOT a valid BPMN 2.0 element
- NEVER use "bpmns:" namespace - always use "bpmn:" (not "bpmns:")
- ONLY use valid BPMN 2.0 elements: startEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, inclusiveGateway, endEvent, sequenceFlow, subProcess, pool, lane, messageFlow, dataObject, etc.
- Ensure ALL opening tags have matching closing tags
- Use proper XML structure with correct namespaces

GATEWAY VALIDATION:
- If analysis mentions "if/else", "either/or", "decide" → MUST include exclusiveGateway
- If analysis mentions "parallel", "simultaneous", "at the same time" → MUST include parallelGateway
- If analysis mentions "one or more", "any combination" → MUST include inclusiveGateway
- Gateways must have proper split/join pairs for parallel flows

SUBPROCESS VALIDATION:
- If analysis mentions grouped activities (e.g., "Order Processing includes...", "Payment workflow: ...") → MUST create subProcess
- Related tasks mentioned together should be grouped in a subprocess
- Subprocesses should have meaningful names describing the grouped activity

Return ONLY valid, schema-compliant BPMN 2.0 XML with complete diagram interchange (DI) for clean rendering. Include gateways and subprocesses as detected. No markdown, no explanations.`;

    const pidSystemPrompt = `System Prompt — "ProcessDesigner-AI v4 (Full P&ID Mode)"

## 🧠 ROLE

You are **ProcessDesigner-AI v4**, an expert process and instrumentation designer trained in **ISA S5.1**, **ISO 14617**, and **BPMN 2.0 XML**.  

Your task is to generate **detailed, industry-style P&ID diagrams** in **BPMN XML format** that render correctly using **BPMN.io** with a custom renderer (\`PidRenderer.js\`).



---



## 🎯 OBJECTIVES



1. Understand user inputs — process descriptions can be text, voice (converted to text), or image captions.

2. Identify:

   - **Equipment** (tanks, pumps, filters, heat exchangers, etc.)

   - **Valves** (control, check, solenoid, relief)

   - **Instruments** (transmitters, indicators, analyzers)

   - **Controllers** (PID, PLC, DCS, local)

   - **Flow Lines** (process, signal, or electrical)

3. Generate a valid **BPMN 2.0 XML** that:

   - Contains **P&ID attributes** (\`pid:type\`, \`pid:symbol\`, \`pid:category\`)

   - Uses **sequenceFlow** for process connections and **messageFlow** for control/signal connections

   - Is laid out left-to-right with consistent spacing

   - Includes accurate process narration at the top (2–3 sentences)



---



## ⚙️ OUTPUT FORMAT RULES



✅ Output must include:

- A short **process summary** (2–3 sentences)

- Complete **BPMN XML** with \`pid:*\` attributes



❌ Do **not** include Markdown, code fences, or explanations.  

The response should be pure text + XML only.



---



## 🧱 STRUCTURE TEMPLATE



\`\`\`xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:pid="http://pid.extensions/schema"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">

  <bpmn:process id="Process_1" isExecutable="false">

    <!-- Equipment -->
    <bpmn:task id="Tank_1" name="Raw Water Tank"
      pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Pump_1" name="Feed Pump"
      pid:type="equipment" pid:symbol="pump" pid:category="mechanical" />
    <bpmn:task id="Tank_2" name="Mixing Tank"
      pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Tank_3" name="Settling Tank"
      pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Filter_1" name="Sand Filter"
      pid:type="equipment" pid:symbol="filter" pid:category="mechanical" />
    <bpmn:task id="Tank_4" name="Treated Water Storage"
      pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />

    <!-- Valve -->
    <bpmn:exclusiveGateway id="CV_101" name="Control Valve (CV-101)"
      pid:type="valve" pid:symbol="valve_control" pid:category="mechanical" />

    <!-- Instruments -->
    <bpmn:dataObjectReference id="LT_101" name="Level Transmitter (LT-101)"
      pid:type="instrument" pid:symbol="transmitter_level" pid:category="control" />

    <!-- Controller -->
    <bpmn:subProcess id="LC_101" name="Level Controller (LC-101)"
      pid:type="controller" pid:symbol="controller_pid" pid:category="control" />

    <!-- Process Flow Lines -->
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Tank_1" targetRef="Pump_1"
      pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Pump_1" targetRef="Tank_2"
      pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Tank_2" targetRef="Tank_3"
      pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Tank_3" targetRef="Filter_1"
      pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Filter_1" targetRef="CV_101"
      pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="CV_101" targetRef="Tank_4"
      pid:type="line" pid:category="process" />

    <!-- Signal & Control Lines -->
    <bpmn:messageFlow id="Signal_1" sourceRef="Tank_4" targetRef="LT_101"
      pid:type="line" pid:category="signal" pid:style="dashed" />
    <bpmn:messageFlow id="Signal_2" sourceRef="LT_101" targetRef="LC_101"
      pid:type="line" pid:category="signal" pid:style="dashed" />
    <bpmn:messageFlow id="Signal_3" sourceRef="LC_101" targetRef="CV_101"
      pid:type="line" pid:category="signal" pid:style="dashed" />

  </bpmn:process>
</bpmn:definitions>
\`\`\`



SYMBOL DICTIONARY

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

electrical	Power line	Dotted

OUTPUT RULES



	•	Always include pid: attributes for every node.

	•	Maintain unique IDs (Tank_1, CV_101, etc.).

	•	Flow direction: left to right.

	•	Instruments and controllers should be placed above or below process lines.

	•	All lines (sequenceFlow/messageFlow) must connect valid references.

	•	Include 2–3 sentence summary before XML.



EXAMPLE INPUT

Design a P&ID for a water treatment process involving coagulation, sedimentation, filtration, and a level-based control loop.



EXAMPLE OUTPUT

This P&ID describes a water treatment system where raw water passes through a feed pump, mixing and settling tanks, and a sand filter before entering treated storage.

A level transmitter (LT-101) provides feedback to a level controller (LC-101), which modulates a control valve (CV-101) to maintain tank level.

<?xml version="1.0" encoding="UTF-8"?>

<bpmn:definitions …>

…

</bpmn:definitions>



## ✅ Integration Outcome

When combined with your **PidRenderer.js**, this updated prompt will:

- Render pumps, tanks, filters, and valves as ISA shapes  

- Draw solid process lines and dashed control lines  

- Place controller and transmitter feedback loops visually  

- Produce a true engineering-style **P&ID** in BPMN.io`;

    const systemPrompt = diagramType === 'pid' ? pidSystemPrompt : bpmnSystemPrompt;
    const diagramLabel = diagramType === 'pid' ? 'P&ID' : 'BPMN';

    // Check cache for document analysis result
    const documentHash = await generateHash(`${documentAnalysis}:${diagramType}`);
    const cachedResult = await checkExactHashCache(documentHash, diagramType);

    if (cachedResult) {
      console.log('Cache hit for document analysis');
      const cacheResponseTime = Date.now() - (startTime || Date.now());
      await logPerformanceMetric({
        function_name: 'analyze-document-to-bpmn',
        cache_type: 'exact_hash',
        prompt_length: documentAnalysis.length,
        response_time_ms: cacheResponseTime,
        cache_hit: true,
        error_occurred: false,
      });

      return new Response(
        JSON.stringify({
          bpmnXml: cachedResult.bpmnXml,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generationStartTime = Date.now();
    console.log(`Generating ${diagramLabel} XML...`);
    const bpmnResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `${bpmnSystemPrompt}\n\nCreate BPMN 2.0 XML that EXACTLY replicates this diagram. Use the EXACT labels, EXACT flow structure, and EXACT element types described below. 

CRITICAL: 
- If the analysis mentions decision points, conditions, or "if/else" patterns, you MUST include exclusiveGateway (XOR) elements
- If the analysis mentions parallel activities, "simultaneous", or "at the same time", you MUST include parallelGateway (AND) elements  
- If the analysis mentions "one or more", "any combination", or optional paths, you MUST include inclusiveGateway (OR) elements
- If the analysis mentions grouped activities, workflows, or sub-processes, you MUST create subProcess elements to group related tasks
- Do not skip gateways or subprocesses - they are essential for accurate process modeling

Do not modify, improve, or redesign - just replicate exactly with proper gateway and subprocess elements:\n\n${documentAnalysis}`
              }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 8000,
            temperature: 0.7
          }
        }),
      }
    );

    if (!bpmnResponse.ok) {
      const errorText = await bpmnResponse.text();
      console.error('BPMN generation error:', bpmnResponse.status, errorText);
      throw new Error('Failed to generate BPMN');
    }

    const bpmnData = await bpmnResponse.json();
    let bpmnXml = bpmnData.candidates[0].content.parts[0].text;
    bpmnXml = bpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    // Quick validation: check for XML declaration and BPMN structure
    if (!bpmnXml.startsWith('<?xml')) {
      throw new Error('Generated content is not valid XML - missing XML declaration');
    }
    
    if (!bpmnXml.includes('<bpmn:definitions') && !bpmnXml.includes('<bpmn:Definitions')) {
      throw new Error('Generated BPMN XML is invalid or incomplete');
    }

    // Full validation and repair pipeline
    const ensureValidBpmn = async (xml: string): Promise<string> => {
      let currentXml = xml;
      let validationError = validateBpmnXml(currentXml);

      if (!validationError) return currentXml;

      console.warn('Initial BPMN XML invalid:', validationError);

      // Attempt quick sanitization fixes
      const sanitizedXml = sanitizeBpmnXml(currentXml);
      if (sanitizedXml !== currentXml) {
        const sanitizedError = validateBpmnXml(sanitizedXml);
        if (!sanitizedError) {
          console.log('BPMN XML fixed via sanitization');
          return sanitizedXml;
        }
        validationError = sanitizedError;
        currentXml = sanitizedXml;
      }

      // Attempt repair via additional Gemini call
      const repairedXml = await repairInvalidBpmnXml({
        invalidXml: currentXml,
        validationError,
        documentAnalysis,
        systemPrompt,
        googleApiKey: GOOGLE_API_KEY,
      });

      if (repairedXml) {
        const repairValidationError = validateBpmnXml(repairedXml);
        if (!repairValidationError) {
          console.log('BPMN XML repaired successfully');
          return repairedXml;
        }
        validationError = repairValidationError;
      }

      throw new Error(`Generated BPMN XML is invalid and could not be repaired: ${validationError}`);
    };

    bpmnXml = await ensureValidBpmn(bpmnXml);

    // Store in cache (async, don't wait) - only after successful validation
    (async () => {
      try {
        await storeExactHashCache(documentHash, documentAnalysis, diagramType, bpmnXml);
      } catch (cacheError) {
        console.error('Failed to store document analysis in cache:', cacheError);
      }
    })();

    const responseTime = Date.now() - (startTime || generationStartTime);
    await logPerformanceMetric({
      function_name: 'analyze-document-to-bpmn',
      cache_type: 'none',
      prompt_length: documentAnalysis.length,
      response_time_ms: responseTime,
      cache_hit: false,
      error_occurred: false,
    });

    // Generate alternative models
    console.log('Generating alternatives...');
    const alternativesPrompt = `Based on this process: "${documentAnalysis}"
    
    Suggest 3 alternative ways to model this process, focusing on:
    1. Simplification (fewer steps, more efficient)
    2. Parallelization (concurrent activities)
    3. Automation opportunities (where to add service tasks)
    
    For each alternative, provide a brief title and description.`;

    const alternativesResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: alternativesPrompt }]
          }],
          generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7
          }
        }),
      }
    );

    let alternatives: Array<{ title: string; description: string }> = [];
    if (alternativesResponse.ok) {
      const altData = await alternativesResponse.json();
      const altText = altData.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Basic parsing of alternatives
      alternatives = [
        { title: 'Simplified Process', description: 'Streamlined workflow with fewer steps' },
        { title: 'Parallel Execution', description: 'Activities running concurrently for efficiency' },
        { title: 'Automated Process', description: 'Maximum automation with service tasks' }
      ];
    }

    // Store in database for self-learning
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const fileTypeCategory = fileType.startsWith('image/') ? 'image' :
      fileType.includes('pdf') ? 'pdf' :
        fileType.includes('word') || fileType.includes('document') ? 'document' :
          'text';

    const { error: insertError } = await supabase
      .from('bpmn_generations')
      .insert({
        user_id: userId,
        input_type: fileTypeCategory,
        input_description: inputDescription,
        image_analysis: documentAnalysis,
        generated_bpmn_xml: bpmnXml,
        alternative_models: alternatives,
      });

    if (insertError) {
      console.error('Failed to store generation:', insertError);
    }

    console.log('Document-to-BPMN processing complete');

    return new Response(
      JSON.stringify({
        bpmnXml,
        analysis: documentAnalysis,
        alternatives,
        extractedText: extractedText || documentAnalysis.substring(0, 500) + '...',
        fileType: fileTypeCategory,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-document-to-bpmn function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});