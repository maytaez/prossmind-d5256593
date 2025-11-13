import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, diagramType = 'bpmn' } = await req.json();
    console.log('Generating BPMN for prompt:', prompt);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not found');
      throw new Error('Lovable API key not configured');
    }

    const bpmnSystemPrompt = `You are a BPMN (Business Process Model and Notation) expert. Generate valid BPMN 2.0 XML based on user descriptions.

CRITICAL RULES:
1. Always return valid BPMN 2.0 XML format
2. DO NOT use namespace prefixes (bpmn:, di:, dc:) - use element names directly
3. Use EXACT namespace URLs: xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
4. EVERY tag MUST be properly closed (either self-closing or with closing tag)
5. Use proper BPMN elements: startEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, endEvent
6. Include sequenceFlow elements with proper source and target references
7. Add a bpmndi:BPMNDiagram section for visual layout
8. Use descriptive names and IDs
9. Keep processes simple and clear
10. Return ONLY the XML, no explanations or markdown

Example structure:
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Start"/>
    <task id="Task_1" name="Task Name"/>
    <endEvent id="EndEvent_1" name="End"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="EndEvent_1"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="420" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="186" y="118"/>
        <di:waypoint x="250" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="118"/>
        <di:waypoint x="420" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`;

    const pidSystemPrompt = `System Prompt — "ProcessDesigner-AI v4 (Full P&ID Mode)"

## 🧠 ROLE

You are **ProcessDesigner-AI v4**, an expert process and instrumentation designer trained in:

**ISA S5.1**, **ISO 14617**, and **BPMN 2.0 XML**.  

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



## ⚙️ OUTPUT FORMAT RULES - CRITICAL



✅ Output must include:

- A short **process summary** (2–3 sentences)

- Complete **BPMN XML** where EVERY element has \`pid:*\` attributes



❌ Do **not** include Markdown, code fences, or explanations.  

The response should be pure text + XML only.

⚠️ **CRITICAL**: If you generate XML without pid: attributes on elements, the diagram will NOT render as a P&ID. EVERY task, gateway, dataObjectReference, subProcess, sequenceFlow, and messageFlow MUST have pid:type, pid:symbol, and pid:category attributes.



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



---



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



---



OUTPUT RULES - CRITICAL - MUST FOLLOW:

	•	MANDATORY: EVERY single element (task, exclusiveGateway, dataObjectReference, subProcess, sequenceFlow, messageFlow) MUST include pid: attributes:
		- Equipment (task): MUST have pid:type="equipment", pid:symbol="tank|pump|filter|heat_exchanger", pid:category="mechanical"
		- Valves (exclusiveGateway): MUST have pid:type="valve", pid:symbol="valve_control|valve_check|valve_gate|valve_solenoid", pid:category="mechanical"
		- Instruments (dataObjectReference): MUST have pid:type="instrument", pid:symbol="transmitter_level|transmitter_flow|transmitter_pressure|analyzer", pid:category="control"
		- Controllers (subProcess): MUST have pid:type="controller", pid:symbol="controller_pid|controller_plc", pid:category="control"
		- Lines (sequenceFlow/messageFlow): MUST have pid:type="line", pid:category="process|signal|electrical"

	•	If you generate XML WITHOUT pid: attributes, it will NOT render correctly as a P&ID diagram.

	•	EXAMPLE OF CORRECT FORMAT:
		<bpmn:task id="Tank_1" name="Raw Water Tank" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
		NOT: <bpmn:task id="Tank_1" name="Raw Water Tank" />

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
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:pid="http://pid.extensions/schema"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:task id="Tank_1" name="Raw Water Tank" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Pump_1" name="Feed Pump" pid:type="equipment" pid:symbol="pump" pid:category="mechanical" />
    <bpmn:exclusiveGateway id="CV_101" name="Control Valve (CV-101)" pid:type="valve" pid:symbol="valve_control" pid:category="mechanical" />
    <bpmn:dataObjectReference id="LT_101" name="Level Transmitter (LT-101)" pid:type="instrument" pid:symbol="transmitter_level" pid:category="control" />
    <bpmn:subProcess id="LC_101" name="Level Controller (LC-101)" pid:type="controller" pid:symbol="controller_pid" pid:category="control" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Tank_1" targetRef="Pump_1" pid:type="line" pid:category="process" />
    <bpmn:messageFlow id="Signal_1" sourceRef="LT_101" targetRef="LC_101" pid:type="line" pid:category="signal" />
  </bpmn:process>
</bpmn:definitions>



## ✅ Integration Outcome

When combined with your **PidRenderer.js**, this updated prompt will:

- Render pumps, tanks, filters, and valves as ISA shapes  

- Draw solid process lines and dashed control lines  

- Place controller and transmitter feedback loops visually  

- Produce a true engineering-style **P&ID** in BPMN.io`;

    const systemPrompt = diagramType === 'pid' ? pidSystemPrompt : bpmnSystemPrompt;

    // Determine model based on prompt complexity
    const promptLength = prompt.length;
    const hasMultiplePools = /pool|swimlane|lane/gi.test(prompt);
    const hasComplexGateways = /gateway|parallel|exclusive|event-based/gi.test(prompt);
    const hasSubprocesses = /subprocess|sub-process|sub process/gi.test(prompt);
    const hasMultipleParticipants = /participant|actor|role|department/gi.test(prompt);
    const hasErrorHandling = /error|exception|compensation/gi.test(prompt);
    const hasDataObjects = /data object|artifact|document|attachment/gi.test(prompt);
    const hasMessageFlows = /message flow|message event/gi.test(prompt);
    
    const complexityScore = 
      (promptLength > 1500 ? 3 : promptLength > 800 ? 2 : promptLength > 400 ? 1 : 0) +
      (hasMultiplePools ? 2 : 0) +
      (hasComplexGateways ? 2 : 0) +
      (hasSubprocesses ? 1 : 0) +
      (hasMultipleParticipants ? 2 : 0) +
      (hasErrorHandling ? 1 : 0) +
      (hasDataObjects ? 1 : 0) +
      (hasMessageFlows ? 1 : 0);
    
    // Use Pro model for complex diagrams or P&ID
    const useProModel = diagramType === 'pid' || complexityScore >= 5;
    const model = useProModel ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash';
    const maxTokens = useProModel ? 16384 : 12288;
    
    console.log(`Using model: ${model} (complexity score: ${complexityScore}, max tokens: ${maxTokens})`);

    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
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
      if (response.status === 402) {
        console.error('Payment required');
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add more credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      throw new Error('Failed to generate BPMN');
    }

    const data = await response.json();
    console.log('AI Response received');
    
    let bpmnXml = data.choices?.[0]?.message?.content || '';
    
    if (!bpmnXml) {
      console.error('Failed to extract BPMN XML from response. Full response:', JSON.stringify(data));
      throw new Error('No content generated from AI model');
    }

    // Clean up the response - remove markdown code blocks if present
    bpmnXml = bpmnXml.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    console.log('Cleaned BPMN XML:', bpmnXml);

    return new Response(
      JSON.stringify({ bpmnXml }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-bpmn function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
