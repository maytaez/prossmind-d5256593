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

        let processDescription = '';
        const startTime = Date.now();

        // Generate image hash for caching (for images and PDFs)
        let imageHash: string | null = null;
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
            processDescription = visionCache.processDescription;

            // If we have cached BPMN XML, use it and skip generation
            if (visionCache.bpmnXml) {
              console.log('Using cached BPMN XML');
              await supabase
                .from('vision_bpmn_jobs')
                .update({
                  status: 'completed',
                  bpmn_xml: visionCache.bpmnXml,
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
            // Otherwise, continue with BPMN generation using cached description
          }
        }

        if (isImage) {
          // Step 1: Analyze the image with vision AI
          const bpmnVisionPrompt = `Analyze the uploaded brainstorming image and generate a professional BPMN process diagram representing the full workflow as one continuous process with a single Start and single End event.

## STRUCTURE RULES:
- **Infer swimlanes dynamically** from headers, columns, or logical clusters (no fixed lane names)
- **All swimlanes must form a single unified flow** (no isolated segments)
- **Maintain logical order** (top→bottom or left→right) and connect tasks accordingly
- **Use diamond-shaped gateways (decisions)** wherever the image implies conditions, comparisons, or branching options

## GUIDELINES FOR DECISION LOGIC:

Use gateways (diamonds) in these cases:

1. **When there's choice or comparison** — e.g., "Testing for comparison; final alloy to be decided after"
2. **When price or feature-based branching is implied** — e.g., "Advanced features increase price"
3. **When market targeting or persona definition implies strategic choices**

## DIAGRAM FORMATTING RULES:
- **Start Event**: Single rounded circle labeled "Start Process"
- **End Event**: Single rounded bold circle labeled "End Process"
- **Tasks**: Rectangles with extracted text
- **Gateways**: Diamonds with clear yes/no or alternative flow labels
- **Annotations**: Handwritten notes, sticky notes, and comments appear as text annotations
- **Connectors**: Use straight lines with even spacing
- **Swimlanes**: One horizontal lane per major topic

## CRITICAL RULES:
1. **UNIFIED PROCESS**: All lanes must connect into ONE continuous workflow
2. **EXACT WORDING**: Preserve original text including typos
3. **MARK UNCERTAINTY**: Use brackets [ ] for low-confidence OCR
4. **COMPREHENSIVE**: Include all visible details
5. **VISUAL CUES**: Note colors, positions, groupings
6. **DECISION POINTS**: Explicitly identify and mark gateways for branching logic`;

          const pidVisionPrompt = `Analyze the uploaded P&ID (Process and Instrumentation Diagram) image and extract complete process engineering information.

## STRUCTURE RULES FOR P&ID:
- **Extract ALL equipment** with tag IDs (TK-xxx, P-xxx, V-xxx, E-xxx, R-xxx, C-xxx, K-xxx, S-xxx, D-xxx)
- **Extract ALL instruments** with ISA tags (FIC-xxx, TIC-xxx, PIC-xxx, LIC-xxx, TE-xxx, PT-xxx, FT-xxx, LT-xxx)
- **Map piping connections** with flow directions and line numbers
- **Identify ALL valve types** per ISA/ANSI symbols (gate, globe, ball, butterfly, check, control, safety)
- **Extract process streams** (feed, product, recycle, utility lines)

## EQUIPMENT IDENTIFICATION:
1. **Tanks/Vessels**: Vertical cylinders, horizontal drums, spheres (TK-xxx, V-xxx)
2. **Pumps**: Centrifugal, positive displacement, vacuum (P-xxx)
3. **Heat Exchangers**: Shell-and-tube, plate, air-cooled (E-xxx)
4. **Reactors**: Jacketed vessels, stirred tank reactors (R-xxx)
5. **Columns/Towers**: Distillation, absorption, stripping (C-xxx, T-xxx)
6. **Compressors**: Centrifugal, reciprocating (K-xxx)
7. **Separators**: Gas-liquid, flash drums (S-xxx, D-xxx)

## VALVE TYPES TO RECOGNIZE (per uploaded symbol reference):
**GATE VALVES**: Hand-operated (Manual), Pneumatic (Diaphragm), Motor-driven, Hydraulic, Pneumatic (Rotary Piston), Balance Diaphragm
**GLOBE VALVES**: Globe, Hand-Operated, Pneumatic, Motor, Hydraulic
**ANGLE VALVES**: Angle, Hand-Operated, Pneumatic, Motor, Angle Blowdown
**BALL VALVES**: Ball, Ball Hydraulic
**PLUG VALVES**: Plug, Plug Motor
**BUTTERFLY VALVES**: Butterfly, Butterfly Pneumatic
**CHECK VALVES**: Check Valve, Stop Check
**DIAPHRAGM VALVES**: Diaphragm, Diaphragm Motor
**SAFETY/RELIEF**: PSV (Pressure Safety Valve), PRV (Pressure Relief Valve)
**QUARTER TURN**: Quarter Turn Double Acting, Quarter Turn Spring Acting
**OTHER VALVES**: Piston-Operated, Float-Operated, Rotary, Needle, Pinch, Bleeder, Integrated Block, Solenoid Closed, Knife, Slide
**REGULATORS**: Pressure Regulator, Back Pressure Regulator

## FAIL-SAFE POSITIONS:
- **Fail Closed** (valve closes on air/power loss)
- **Fail Open** (valve opens on air/power loss)

## END CONNECTION TYPES:
- **Flanged** (bolted flange joints)
- **Threaded** (screwed connections)
- **Welded** (permanent weld joints)
- **Socket Weld** (socket-welded fittings)

## INSTRUMENTATION EXTRACTION:
- **Controllers**: FIC (Flow), TIC (Temperature), PIC (Pressure), LIC (Level)
- **Transmitters**: FT, TT, PT, LT (sends signal to controller or DCS)
- **Indicators**: FI, TI, PI, LI (local readout only)
- **Control Valves**: FCV, TCV, PCV, LCV (final control elements)
- **Sensors**: TE (thermocouple/RTD), PT (pressure transducer), FE (flow element), LE (level sensor)
- **Equipment**: Rotameter, Gauge, Orifice Plate

## P&ID SYMBOLS TO RECOGNIZE:
- Diamond with cross inside = Control valve with actuator
- Circle with instrument tag = Controller or indicator  
- Small circle on pipe = Instrument connection point
- Dashed lines = Instrument signal lines
- Arrows on pipes = Flow direction
- Double lines = Insulated or traced piping

## OUTPUT FORMAT:
1. **Equipment List**: Tag ID, Type, Description, Position, Connections
2. **Valve List**: Tag ID, Type (from symbol reference), Actuator type, Fail-safe position, Connection type
3. **Piping List**: From→To connections, Line numbers, Flow direction, Line size if visible
4. **Instrument List**: Tag ID, Type, Measurement point, Control loop, Function
5. **Control Loops**: Loop ID, Components (sensor→controller→valve), Purpose
6. **Process Description**: Overall process flow and function
7. **Safety Systems**: PSVs, alarms, interlocks, rupture disks

## CRITICAL RULES:
1. **EXACT TAG IDs**: Preserve all equipment and instrument tags exactly as written
2. **ISA/ANSI STANDARDS**: Follow ISA-5.1 instrument identification standards
3. **VALVE CLASSIFICATION**: Match valve symbols to the types from the uploaded reference (gate, globe, ball, etc.)
4. **PROCESS FLOW**: Maintain correct flow sequence and connections
5. **COMPREHENSIVE**: Extract every visible element, tag, and annotation
6. **ENGINEERING CONTEXT**: Note process conditions, line sizes, materials, pressures, temperatures if visible
7. **FAIL-SAFE**: Identify and note fail-safe positions for all control valves
8. **CONNECTIONS**: Specify end connection types (flanged, threaded, welded, socket weld) when visible`;


          const visionPrompt = diagramType === 'pid' ? pidVisionPrompt : bpmnVisionPrompt;

          console.log('Calling Gemini for image analysis...');
          
          const imageData = imageBase64.split(',')[1];
          const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
          
          const visionResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: visionPrompt },
                    { inline_data: { mime_type: mimeType, data: imageData } }
                  ]
                }],
                generationConfig: {
                  maxOutputTokens: 8192,
                  temperature: 0.7
                }
              }),
            }
          );

          if (!visionResponse.ok) {
            throw new Error(`AI API error: ${visionResponse.status}`);
          }

          const visionData = await visionResponse.json();
          
          if (!visionData.candidates || !visionData.candidates[0]) {
            throw new Error('Invalid response structure from AI service');
          }

          const candidate = visionData.candidates[0];
          if (candidate.finishReason === 'MAX_TOKENS') {
            throw new Error('Image too complex to process. Please try a simpler diagram.');
          }

          if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
            throw new Error('Incomplete response from AI service');
          }
          
          processDescription = candidate.content.parts[0].text;
          console.log('Image analysis complete');
        } else if (isText) {
          // Extract text content from base64
          const base64Data = imageBase64.split(',')[1];
          const textContent = atob(base64Data);
          console.log('Processing text content...');
          
          const textPrompt = `Analyze this text which describes a business process:

${textContent}

Extract and structure the following:
1. Process Name/Title
2. Main Objective
3. Key Steps (in sequence)
4. Decision Points (if any)
5. Start and End Conditions
6. Any Special Notes or Constraints

Format this clearly for BPMN diagram generation.`;

          const textResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: textPrompt }]
                }],
                generationConfig: {
                  maxOutputTokens: 8192,
                  temperature: 0.7
                }
              }),
            }
          );

          if (!textResponse.ok) {
            throw new Error(`Text analysis error: ${textResponse.status}`);
          }

          const textData = await textResponse.json();
          
          if (!textData.candidates || !textData.candidates[0]) {
            throw new Error('Invalid response structure from AI service');
          }

          const textCandidate = textData.candidates[0];
          if (textCandidate.finishReason === 'MAX_TOKENS') {
            throw new Error('Text content too complex to process.');
          }

          if (!textCandidate.content || !textCandidate.content.parts || !textCandidate.content.parts[0]) {
            throw new Error('Incomplete response from AI service');
          }
          
          processDescription = textCandidate.content.parts[0].text;
          console.log('Text analysis complete');
        } else {
          // For PDFs and documents
          console.log('Processing document (PDF/DOCX)...');
          
          const docPrompt = `Analyze this document which contains a business process description.
          
Extract and structure the following:
1. Process Name/Title
2. Main Objective  
3. Key Steps (in sequence)
4. Decision Points (if any)
5. Start and End Conditions
6. Any Special Notes or Constraints

Format this clearly for BPMN diagram generation.`;

          const imageData = imageBase64.split(',')[1];
          const mimeType = imageBase64.match(/data:([^;]+);/)?.[1] || 'application/pdf';
          
          const docResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: docPrompt },
                    { inline_data: { mime_type: mimeType, data: imageData } }
                  ]
                }],
                generationConfig: {
                  maxOutputTokens: 8192,
                  temperature: 0.7
                }
              }),
            }
          );

          if (!docResponse.ok) {
            throw new Error(`Document analysis error: ${docResponse.status}`);
          }

          const docData = await docResponse.json();
          
          if (!docData.candidates || !docData.candidates[0]) {
            throw new Error('Invalid response structure from AI service');
          }

          const docCandidate = docData.candidates[0];
          if (docCandidate.finishReason === 'MAX_TOKENS') {
            throw new Error('Document too complex to process.');
          }

          if (!docCandidate.content || !docCandidate.content.parts || !docCandidate.content.parts[0]) {
            throw new Error('Incomplete response from AI service');
          }
          
          processDescription = docCandidate.content.parts[0].text;
          console.log('Document analysis complete');
        }

        // Analyze complexity
        console.log('Analyzing diagram complexity...');
        const complexityMetrics = {
          wordCount: processDescription.split(/\s+/).length,
          lineCount: processDescription.split('\n').length,
          hasDecisionPoints: /decision|if|else|gateway|choose|select|branch/i.test(processDescription),
          hasMultipleLanes: processDescription.match(/lane|swimlane|category|phase|stage/gi)?.length || 0,
          taskCount: processDescription.match(/task|step|activity|action/gi)?.length || 0
        };
        
        const complexityScore = 
          (complexityMetrics.wordCount > 500 ? 2 : complexityMetrics.wordCount > 250 ? 1 : 0) +
          (complexityMetrics.hasMultipleLanes > 4 ? 2 : complexityMetrics.hasMultipleLanes > 2 ? 1 : 0) +
          (complexityMetrics.taskCount > 15 ? 2 : complexityMetrics.taskCount > 8 ? 1 : 0) +
          (complexityMetrics.hasDecisionPoints ? 1 : 0);
        
        const useProModel = complexityScore >= 2;
        const selectedModel = useProModel ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        const maxTokens = useProModel ? 32768 : 16384;
        const temperature = useProModel ? 0.3 : 0.5;
        
        console.log(`Complexity score: ${complexityScore}/8`, complexityMetrics);
        console.log(`Selected model: ${selectedModel} (maxTokens: ${maxTokens})`);

        // Generate diagram XML
        const diagramLabel = diagramType === 'pid' ? 'P&ID' : 'BPMN';
        console.log(`Generating ${diagramLabel} XML...`);
        
        const bpmnSystemPrompt = `You are an expert BPMN 2.0 XML generator. Create a unified business process with horizontal swimlanes and decision gateways. Keep element IDs concise (e.g., "Task_1", "Gate_1"). Return ONLY valid BPMN 2.0 XML starting with <?xml version="1.0" encoding="UTF-8"?>. No markdown, no code blocks.`;
        
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
        
        // Use optimized prompts from shared module if available
        let systemPrompt: string;
        try {
          const { getBpmnSystemPrompt, getPidSystemPrompt } = await import('../_shared/prompts.ts');
          systemPrompt = diagramType === 'pid' ? getPidSystemPrompt() : getBpmnSystemPrompt();
        } catch {
          // Fallback to local prompts if shared module not available
          systemPrompt = diagramType === 'pid' ? pidSystemPrompt : bpmnSystemPrompt;
        }
        
        const bpmnResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: `${systemPrompt}\n\nProcess description:\n${processDescription}` }
                ]
              }],
              generationConfig: {
                maxOutputTokens: maxTokens,
                temperature: temperature
              }
            }),
          }
        );

        if (!bpmnResponse.ok) {
          throw new Error('Failed to generate BPMN');
        }

        const bpmnData = await bpmnResponse.json();
        
        if (!bpmnData.candidates || !bpmnData.candidates[0]) {
          throw new Error('Failed to generate BPMN diagram');
        }

        const bpmnCandidate = bpmnData.candidates[0];
        if (bpmnCandidate.finishReason === 'MAX_TOKENS') {
          throw new Error('Diagram too complex to generate. Please try a simpler process.');
        }

        if (!bpmnCandidate.content || !bpmnCandidate.content.parts || !bpmnCandidate.content.parts[0]) {
          throw new Error('Incomplete BPMN generation response');
        }
        
        let bpmnXml = bpmnCandidate.content.parts[0].text;
        
        // Extract XML from markdown code blocks if present
        const xmlMatch = bpmnXml.match(/```(?:xml)?\s*([\s\S]*?)```/) || 
                        bpmnXml.match(/<bpmn:definitions[\s\S]*<\/bpmn:definitions>/) ||
                        bpmnXml.match(/<bpmn2:definitions[\s\S]*<\/bpmn2:definitions>/);
        
        if (xmlMatch) {
          bpmnXml = xmlMatch[1] || xmlMatch[0];
        }
        
        // Clean up the XML
        bpmnXml = bpmnXml
          .replace(/```xml\n?/g, '')
          .replace(/```\n?/g, '')
          .replace(/^[^<]*/, '') // Remove any text before XML
          .trim();
        
        // Ensure it starts with XML declaration
        if (!bpmnXml.startsWith('<?xml')) {
          bpmnXml = '<?xml version="1.0" encoding="UTF-8"?>\n' + bpmnXml;
        }
        
        // Validate XML completeness
        const hasProperClosing = bpmnXml.includes('</definitions>') || bpmnXml.includes('</bpmn:definitions>');
        if (!bpmnXml.includes('<definitions') && !bpmnXml.includes('<bpmn:definitions')) {
          throw new Error('Generated BPMN XML is missing definitions element.');
        }
        if (!hasProperClosing) {
          throw new Error('Generated BPMN XML is incomplete - missing closing tag.');
        }

        console.log('Vision-to-BPMN processing complete');

        // Store in vision cache (async, don't wait)
        if (imageHash && processDescription) {
          (async () => {
            try {
              await storeVisionCache(imageHash, diagramType, processDescription, bpmnXml);
            } catch (cacheError) {
              console.error('Failed to store vision cache:', cacheError);
            }
          })();
        }

        // Update job with success
        await supabase
          .from('vision_bpmn_jobs')
          .update({
            status: 'completed',
            bpmn_xml: bpmnXml,
            complexity_score: complexityScore,
            model_used: selectedModel,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        const responseTime = Date.now() - startTime;
        await logPerformanceMetric({
          function_name: 'vision-to-bpmn',
          cache_type: imageHash && processDescription ? 'exact_hash' : 'none',
          model_used: selectedModel,
          complexity_score: complexityScore,
          response_time_ms: responseTime,
          cache_hit: false, // This was a new generation
          error_occurred: false,
        });

        console.log('Job completed:', job.id);
      } catch (error) {
        console.error('Error processing job:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        const responseTime = Date.now() - startTime;
        await logPerformanceMetric({
          function_name: 'vision-to-bpmn',
          cache_type: 'none',
          response_time_ms: responseTime,
          cache_hit: false,
          error_occurred: true,
          error_message: errorMessage,
        });
        
        // Update job with error
        await supabase
          .from('vision_bpmn_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString()
          })
          .eq('id', job.id);
      }
    };

    // Run processing in background
    // @ts-expect-error EdgeRuntime is available in Supabase edge functions
    EdgeRuntime.waitUntil(processJob());

    // Return job ID immediately
    return new Response(
      JSON.stringify({ jobId: job.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202, // Accepted
      }
    );
  } catch (error) {
    console.error('Error in vision-to-bpmn function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
