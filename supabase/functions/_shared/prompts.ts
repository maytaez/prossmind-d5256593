/**
 * Comprehensive system prompts for BPMN/P&ID generation
 * Based on prompt engineering principles: role definition, knowledge, negative prompting, and few-shot learning
 */

/**
 * Add role definition for BPMN expert
 * Similar to add_role() in prompt_engineering.py
 */
function addBpmnRole(strictMode: boolean = false): string {
  let role = `Your role: You are an expert in business process modeling, familiar with BPMN 2.0 notation and common process constructs such as exclusive gateways (XOR), parallel gateways (AND), inclusive gateways (OR), loops, subprocesses, and event handling. Your task is to analyze textual descriptions of business processes and transform them into valid BPMN 2.0 XML models. When generating a model, be as precise as possible and capture all details of the process in the model.`;
  
  if (strictMode) {
    role += `\n\nPlease create the process model strictly depending on the provided description, without using any domain knowledge you might have. You are not supposed to correct any information in the process, rather fully rely on the provided textual description.`;
  } else {
    role += `\n\nAlso act as the process owner and use your expertise and familiarity with the process context to fill in any missing knowledge when necessary.`;
  }
  
  return role;
}

/**
 * Add comprehensive BPMN 2.0 knowledge
 * Similar to add_knowledge() in prompt_engineering.py
 */
function addBpmnKnowledge(resourceAware: boolean = false): string {
  let knowledge = `Use the following knowledge about the BPMN 2.0 process modeling language:

BPMN 2.0 is a standardized notation for modeling business processes. A BPMN model consists of flow objects (events, activities, gateways), connecting objects (sequence flows, message flows), swimlanes (pools and lanes), and artifacts (data objects, annotations).

CORE ELEMENTS:

1. EVENTS:
   - startEvent: Marks the beginning of a process. Types include: None (default), Message, Timer, Error, Signal, etc.
   - endEvent: Marks the end of a process. Types include: None (default), Message, Error, Escalation, Signal, Terminate, etc.
   - intermediateCatchEvent: Catches events during process execution (e.g., waiting for a message, timer)
   - intermediateThrowEvent: Throws events during process execution
   - boundaryEvent: Attached to activities to handle exceptions, escalations, or timeouts

2. ACTIVITIES (Tasks):
   - task: Generic task (default)
   - userTask: Task performed by a human user
   - serviceTask: Task performed by an automated service/system
   - manualTask: Task performed without IT support
   - scriptTask: Task executed by a script/automation
   - sendTask: Task that sends a message
   - receiveTask: Task that receives a message
   - businessRuleTask: Task that evaluates business rules

3. GATEWAYS (Control Flow):
   - exclusiveGateway (XOR): Models exclusive choice - exactly one path is taken
     * Use for: "if/else", "either/or", "choose one", decision points
     * Split: One incoming flow, multiple outgoing flows (only one executes)
     * Join: Multiple incoming flows, one outgoing flow (first to complete continues)
   - parallelGateway (AND): Models parallel execution - all paths execute simultaneously
     * Use for: "at the same time", "in parallel", "simultaneously", "while doing A, also do B"
     * Split: One incoming flow, multiple outgoing flows (all execute)
     * Join: Multiple incoming flows, one outgoing flow (waits for all to complete)
   - inclusiveGateway (OR): Models inclusive choice - one or more paths can be taken
     * Use for: "one or more", "any combination", "can do A, B, or both"
     * Split: One incoming flow, multiple outgoing flows (one or more execute based on conditions)
     * Join: Multiple incoming flows, one outgoing flow (waits for all active paths to complete)

4. SUBPROCESSES:
   - subProcess (Embedded): Groups related activities into a logical unit within the main process
     * Collapsed: Shows as a single task with "+" icon (isExpanded="false")
     * Expanded: Shows all internal tasks, gateways, and flows (isExpanded="true")
     * Use for: Related activities that form a logical unit (e.g., "Order Processing", "Payment Verification")
   - callActivity: Calls an external, reusable process
     * Use for: Reusable subprocesses that appear in multiple processes
   - eventSubProcess: Triggered by events (messages, timeouts, errors)
     * Use for: Exception handling, delays, event-driven flows
   - adHocSubProcess: Tasks can be executed in any order
     * Use for: Informal workflows without predefined sequence
   - transaction: All-or-nothing operations
     * Use for: Financial/legal operations requiring atomicity

5. SEQUENCE FLOWS:
   - sequenceFlow: Connects flow objects in the same pool/lane
     * Must have: sourceRef (source element ID) and targetRef (target element ID)
     * Can have: name (label), conditionExpression (for conditional flows from gateways)

6. MESSAGE FLOWS:
   - messageFlow: Connects elements across different pools (participants)
     * Use for: Communication between different organizations/participants

7. POOLS AND LANES:
   - pool: Represents a participant (organization, system, department)
   - lane: Represents a role or department within a pool
   - Use pools for: Different organizations or major participants
   - Use lanes for: Different roles/departments within the same organization

8. DATA OBJECTS:
   - dataObject: Represents data in the process
   - dataStore: Represents persistent data storage
   - dataObjectReference: Reference to a data object

LAYOUT REQUIREMENTS:
- Use hierarchical/layered (Sugiyama) layout for process flows
- Apply orthogonal edge routing (right-angle connectors, avoid diagonals)
- Minimize edge crossings using crossing-minimization heuristics
- Route connectors around nodes - insert waypoints to prevent overlap
- Maintain minimum clearance (padding) between edges and nodes
- Place labels outside connectors or on unobtrusive label boxes
- Align swimlane widths uniformly; ensure tasks fit inside lanes
- Normalize node sizes based on label length with consistent padding
- Horizontal spacing: 150px minimum between nodes
- Vertical spacing: 100px minimum between layers

VALIDATION RULES:
- Every sequenceFlow must have valid sourceRef and targetRef
- Gateways must have proper split/join pairs for parallel flows
- All bpmndi shapes must have valid bounds (x, y, width, height > 0)
- All bpmndi edges must have at least 2 waypoints
- ALL di:waypoint tags MUST be self-closing: <di:waypoint x="..." y="..."/>
- Subprocesses must be properly nested (expanded) or marked as collapsed
- No orphan flows (flows without valid source or target)
- Gateway types must match their usage (XOR for decisions, AND for parallel, OR for inclusive)`;

  if (resourceAware) {
    knowledge += `\n\nRESOURCE AWARENESS:
- Pools represent different organizations or major participants
- Lanes represent roles or departments within a pool
- Use generic pool names: "Customer", "Supplier", "System", "Department", etc.
- Avoid repeating the same pool name for different pools
- Each lane belongs to only one pool
- Different departments/roles within the same organization should be modeled as lanes within one pool
- If pools/lanes cannot be identified, assign to 'None'
- If at least one pool is identified, do not use 'None' for other pools (same for lanes)`;
  }

  return knowledge;
}

/**
 * Add negative prompting (common mistakes to avoid)
 * Similar to negative_prompting() in prompt_engineering.py
 */
function addNegativePrompting(): string {
  return `Avoid common mistakes:

1. GATEWAY ERRORS:
   - Do NOT skip gateways when decision points or parallel flows are mentioned
   - Do NOT use parallelGateway (AND) for exclusive choices (use exclusiveGateway/XOR)
   - Do NOT use exclusiveGateway (XOR) for parallel execution (use parallelGateway/AND)
   - Ensure gateways have proper split/join pairs for parallel flows
   - Gateway types must match their usage (XOR for decisions, AND for parallel, OR for inclusive)

2. SUBPROCESS ERRORS:
   - Do NOT skip subprocesses when grouped activities are mentioned
   - Related tasks (2+) should be grouped in subprocesses
   - Use proper subprocess naming: "verb + complement" format (e.g., "Review Application", "Handle Order Processing")
   - Default to collapsed subprocesses (isExpanded="false") for cleaner diagrams
   - Expanded subprocesses must include ALL internal elements with proper bounds

3. XML STRUCTURE ERRORS:
   - NEVER use "flowNodeRef" - this is NOT a valid BPMN 2.0 element
   - NEVER use "bpmns:" namespace - always use "bpmn:" (not "bpmns:")
   - ALL di:waypoint tags MUST be self-closing: <di:waypoint x="..." y="..."/>
   - ALL opening tags must have matching closing tags
   - Use proper XML structure with correct namespaces

4. LAYOUT ERRORS:
   - Do NOT create overlapping connectors or nodes
   - Do NOT place labels overlapping other elements
   - Ensure proper spacing between elements
   - Route connectors around nodes, not through them

5. FLOW ERRORS:
   - Do NOT create orphan flows (flows without valid source or target)
   - Ensure all sequenceFlows have valid sourceRef and targetRef
   - Do NOT create flows that skip required gateways

6. LABEL ERRORS:
   - Preserve EXACT text from the process description
   - Do NOT paraphrase or translate unless explicitly requested
   - Use the same language as the input description

7. VALIDATION ERRORS:
   - Ensure all bpmndi shapes have valid bounds (x, y, width, height > 0)
   - Ensure all bpmndi edges have at least 2 waypoints
   - Ensure proper XML structure with XML declaration`;
}

/**
 * Add process description
 * Similar to add_process_description() in prompt_engineering.py
 */
function addProcessDescription(description: string): string {
  return `This is the process description: ${description}`;
}

/**
 * Add code generation instructions
 * Similar to code_generation() in prompt_engineering.py
 */
function addCodeGenerationInstructions(): string {
  return `At the end of your response, provide a single BPMN 2.0 XML snippet (starting with '<?xml') that contains the complete, valid BPMN 2.0 XML. Return ONLY the XML, no markdown code fences, no explanations, no additional text.`;
}

/**
 * Get comprehensive BPMN system prompt
 * Based on prompt_engineering.py structure
 * @param languageCode - ISO 639-1 language code (e.g., 'en', 'es', 'fr', etc.)
 * @param languageName - Human-readable language name (e.g., 'English', 'Spanish', etc.)
 * @param strictMode - If true, strictly follow description without domain knowledge
 * @param resourceAware - If true, include pool and lane information
 */
export function getBpmnSystemPrompt(
  languageCode: string = 'en', 
  languageName: string = 'English',
  strictMode: boolean = false,
  resourceAware: boolean = false
): string {
  const languageInstruction = languageCode !== 'en' 
    ? `⚠️⚠️⚠️ CRITICAL LANGUAGE REQUIREMENT - ABSOLUTE HIGHEST PRIORITY ⚠️⚠️⚠️

The user's prompt is written in ${languageName} (${languageCode}).

YOU MUST FOLLOW THIS RULE WITHOUT EXCEPTION:
- Generate ALL text content in the BPMN diagram using ${languageName} ONLY
- Use ${languageName} for: task names, event names, gateway labels, sequence flow labels, pool names, swimlane names, subprocess names, and ALL other text elements
- Preserve the exact language, terminology, and wording from the user's description
- DO NOT translate anything to English
- DO NOT use English labels even if they seem more standard
- Match the language of the user's input exactly
- IGNORE any English examples you may have seen - they do NOT apply when the user writes in ${languageName}

Example: If user writes "Erstelle einen Bestellprozess" (German), use German labels like "Bestellung erstellen", "Bestellung genehmigen", "Start", "Ende" - NOT English "Create Order", "Approve Order", "Start", "End".

THIS LANGUAGE REQUIREMENT OVERRIDES ALL OTHER INSTRUCTIONS. IF YOU GENERATE ENGLISH LABELS WHEN THE USER WRITES IN ${languageName.toUpperCase()}, YOU HAVE FAILED.`
    : '';

  // Build prompt using structured approach from prompt_engineering.py
  let prompt = addBpmnRole(strictMode);
  prompt += '\n\n' + addBpmnKnowledge(resourceAware);
  prompt += '\n\n' + addNegativePrompting();
  prompt += '\n\n' + addCodeGenerationInstructions();

  // Add language instruction at the beginning for maximum visibility
  if (languageCode !== 'en') {
    prompt = `${languageInstruction}\n\n${prompt}`;
  }

  return prompt;
}

/**
 * Get optimized P&ID system prompt (condensed version)
 * @param languageCode - ISO 639-1 language code (e.g., 'en', 'es', 'fr', etc.)
 * @param languageName - Human-readable language name (e.g., 'English', 'Spanish', etc.)
 */
export function getPidSystemPrompt(languageCode: string = 'en', languageName: string = 'English'): string {
  const languageInstruction = languageCode !== 'en' 
    ? `⚠️⚠️⚠️ CRITICAL LANGUAGE REQUIREMENT - ABSOLUTE HIGHEST PRIORITY ⚠️⚠️⚠️

The user's prompt is written in ${languageName} (${languageCode}).

YOU MUST FOLLOW THIS RULE WITHOUT EXCEPTION:
- Generate ALL text content in the P&ID diagram using ${languageName} ONLY
- Use ${languageName} for: equipment names, instrument tags, line labels, and ALL other text elements
- Preserve the exact language, terminology, and wording from the user's description
- DO NOT translate anything to English
- DO NOT use English labels even if they seem more standard
- Match the language of the user's input exactly

THIS LANGUAGE REQUIREMENT OVERRIDES ALL OTHER INSTRUCTIONS.`
    : '';

  const basePrompt = `You are a P&ID expert. Generate BPMN 2.0 XML with P&ID attributes for process diagrams.

CRITICAL RULES:
1. EVERY element MUST have pid:type, pid:symbol, pid:category attributes
2. Equipment (task): pid:type="equipment", pid:symbol="tank|pump|filter|heat_exchanger", pid:category="mechanical"
3. Valves (exclusiveGateway): pid:type="valve", pid:symbol="valve_control|valve_check|valve_gate|valve_solenoid", pid:category="mechanical"
4. Instruments (dataObjectReference): pid:type="instrument", pid:symbol="transmitter_level|transmitter_flow|transmitter_pressure|analyzer", pid:category="control"
5. Controllers (subProcess): pid:type="controller", pid:symbol="controller_pid|controller_plc", pid:category="control"
6. Lines: pid:type="line", pid:category="process|signal|electrical"
7. Return ONLY XML with 2-3 sentence summary before XML`;

  // Put language instruction at the beginning for maximum visibility
  return languageCode !== 'en' 
    ? `${languageInstruction}\n\n${basePrompt}`
    : basePrompt;
}

/**
 * Get BPMN example for few-shot learning with error explanations
 * Similar to add_few_shots() in prompt_engineering.py
 */
export function getBpmnExample(): { user: string; assistant: string; errors?: string } {
  return {
    user: 'Create a simple order process: start, create order, approve order, end',
    assistant: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Start"/>
    <task id="Task_1" name="Create Order"/>
    <task id="Task_2" name="Approve Order"/>
    <endEvent id="EndEvent_1" name="End"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2"/>
    <sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="EndEvent_1"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="400" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="550" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="186" y="118"/>
        <di:waypoint x="250" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="118"/>
        <di:waypoint x="400" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="500" y="118"/>
        <di:waypoint x="550" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`,
    errors: `Common errors to avoid for this example:
- Do NOT use <di:waypoint> tags (must be self-closing: <di:waypoint x="..." y="..."/>)
- Do NOT forget to include bpmndi:BPMNDiagram section for visual layout
- Do NOT use invalid namespaces like "bpmns:" (use "bpmn:")
- Do NOT create flows without valid sourceRef and targetRef
- Ensure all bounds have positive x, y, width, height values`
  };
}

/**
 * Get German BPMN example for few-shot learning with error explanations
 */
export function getGermanBpmnExample(): { user: string; assistant: string; errors?: string } {
  return {
    user: 'Erstelle einen einfachen Bestellprozess: Start, Bestellung erstellen, Bestellung genehmigen, Ende',
    assistant: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_1" isExecutable="false">
    <startEvent id="StartEvent_1" name="Start"/>
    <task id="Task_1" name="Bestellung erstellen"/>
    <task id="Task_2" name="Bestellung genehmigen"/>
    <endEvent id="EndEvent_1" name="Ende"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2"/>
    <sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="EndEvent_1"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="400" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="550" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="186" y="118"/>
        <di:waypoint x="250" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="118"/>
        <di:waypoint x="400" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="500" y="118"/>
        <di:waypoint x="550" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>`,
    errors: `Common errors to avoid for this example:
- CRITICAL: Do NOT translate German labels to English - use "Bestellung erstellen" NOT "Create Order"
- Do NOT use English event names - use "Start" and "Ende" NOT "Start" and "End"
- Preserve the exact German terminology from the user's description
- All other XML structure errors apply (waypoints, namespaces, etc.)`
  };
}

/**
 * Get P&ID example for few-shot learning
 */
export function getPidExample(): { user: string; assistant: string } {
  return {
    user: 'Design a P&ID for a water treatment process with a tank, pump, and control valve',
    assistant: `This P&ID describes a water treatment system with a storage tank, feed pump, and control valve.

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
    <bpmn:task id="Tank_1" name="Water Storage Tank" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Pump_1" name="Feed Pump" pid:type="equipment" pid:symbol="pump" pid:category="mechanical" />
    <bpmn:exclusiveGateway id="CV_101" name="Control Valve (CV-101)" pid:type="valve" pid:symbol="valve_control" pid:category="mechanical" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Tank_1" targetRef="Pump_1" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Pump_1" targetRef="CV_101" pid:type="line" pid:category="process" />
  </bpmn:process>
</bpmn:definitions>`
  };
}

/**
 * Get optimized DMN system prompt (condensed version)
 */
export function getDmnSystemPrompt(): string {
  return `You are a DMN 1.3 XML expert. Generate valid DMN 1.3 XML based on user descriptions.

CRITICAL RULES:
1. Return ONLY valid DMN 1.3 XML format
2. Use namespace: xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
3. Use elements: decision, inputData, knowledgeSource, businessKnowledgeModel, decisionTable
4. Include decisionTable with input/output clauses and rules
5. Add dmndi:DMNDI section for visual layout
6. Return ONLY XML, no markdown or explanations`;
}

/**
 * Get DMN example for few-shot learning
 */
export function getDmnExample(): { user: string; assistant: string } {
  return {
    user: 'Create a simple credit approval decision table: check income and credit score',
    assistant: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" 
  xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" 
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC/" 
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI/" 
  id="credit_decision" 
  name="Credit Approval" 
  namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Decision_1" name="Credit Approval Decision">
    <decisionTable id="DecisionTable_1">
      <input id="Input_1" label="Annual Income">
        <inputExpression id="InputExpression_1" typeRef="number">
          <text>income</text>
        </inputExpression>
      </input>
      <input id="Input_2" label="Credit Score">
        <inputExpression id="InputExpression_2" typeRef="number">
          <text>creditScore</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Approval" name="approval" typeRef="string"/>
      <rule id="Rule_1">
        <inputEntry id="InputEntry_1">
          <text>&gt;= 50000</text>
        </inputEntry>
        <inputEntry id="InputEntry_2">
          <text>&gt;= 700</text>
        </inputEntry>
        <outputEntry id="OutputEntry_1">
          <text>"Approved"</text>
        </outputEntry>
      </rule>
      <rule id="Rule_2">
        <inputEntry id="InputEntry_3">
          <text>&lt; 50000</text>
        </inputEntry>
        <inputEntry id="InputEntry_4">
          <text>-</text>
        </inputEntry>
        <outputEntry id="OutputEntry_2">
          <text>"Rejected"</text>
        </outputEntry>
      </rule>
      <rule id="Rule_3">
        <inputEntry id="InputEntry_5">
          <text>-</text>
        </inputEntry>
        <inputEntry id="InputEntry_6">
          <text>&lt; 700</text>
        </inputEntry>
        <outputEntry id="OutputEntry_3">
          <text>"Rejected"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`
  };
}

/**
 * Build messages array with few-shot examples
 * @param systemPrompt - System prompt with language instructions
 * @param userPrompt - User's prompt
 * @param diagramType - Type of diagram ('bpmn' or 'pid')
 * @param languageCode - Detected language code (optional, defaults to 'en')
 * @param languageName - Detected language name (optional, defaults to 'English')
 */
export function buildMessagesWithExamples(
  systemPrompt: string,
  userPrompt: string,
  diagramType: 'bpmn' | 'pid' | 'dmn',
  languageCode: string = 'en',
  languageName: string = 'English'
): Array<{ role: string; content: string }> {
  // For non-English languages, use a language-specific example if available, otherwise skip example
  if (languageCode !== 'en') {
    // Use German example if German is detected
    if (languageCode === 'de' && diagramType === 'bpmn') {
      const germanExample = getGermanBpmnExample();
      const languageInstruction = `

⚠️⚠️⚠️ CRITICAL: Generate ALL text in German (Deutsch). Use German labels like in the example above.`;
      
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: germanExample.user },
        { role: 'assistant', content: germanExample.assistant }
      ];

      // Add error explanations if available
      if (germanExample.errors) {
        messages.push({ 
          role: 'user', 
          content: `Common errors to avoid for this example:\n${germanExample.errors}\n\nNow generate the BPMN for: ${userPrompt}${languageInstruction}` 
        });
      } else {
        messages.push({ role: 'user', content: userPrompt + languageInstruction });
      }

      return messages;
    }

    // For other non-English languages, add explicit instruction
    const languageInstruction = `

⚠️⚠️⚠️ CRITICAL: The user prompt above is in ${languageName} (${languageCode}). 
    
YOU MUST generate the BPMN diagram with ALL text elements in ${languageName}:
- All task names must be in ${languageName}
- All event names (Start, End) must be in ${languageName}
- All gateway labels must be in ${languageName}
- All sequence flow labels must be in ${languageName}
- All pool and swimlane names must be in ${languageName}
- All subprocess names must be in ${languageName}

DO NOT translate to English. DO NOT use English labels. Use ${languageName} for everything.`;
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt + languageInstruction }
    ];
  }

  // For English, use the standard few-shot example
  let example;
  if (diagramType === 'pid') {
    example = getPidExample();
  } else if (diagramType === 'dmn') {
    example = getDmnExample();
  } else {
    example = getBpmnExample();
  }

  // Include error explanations if available (similar to prompt_engineering.py)
  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: example.user },
    { role: 'assistant', content: example.assistant }
  ];

  // Add error explanations if available
  if ('errors' in example && example.errors) {
    messages.push({ 
      role: 'user', 
      content: `Common errors to avoid for this example:\n${example.errors}\n\nNow generate the BPMN for: ${userPrompt}` 
    });
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  return messages;
}

/**
 * Create initial conversation for BPMN generation
 * Similar to create_conversation() in prompt_engineering.py
 * @param processDescription - The process description to model
 * @param languageCode - ISO 639-1 language code
 * @param languageName - Human-readable language name
 * @param strictMode - If true, strictly follow description without domain knowledge
 * @param resourceAware - If true, include pool and lane information
 */
export function createBpmnConversation(
  processDescription: string,
  languageCode: string = 'en',
  languageName: string = 'English',
  strictMode: boolean = false,
  resourceAware: boolean = false
): Array<{ role: string; content: string }> {
  const systemPrompt = getBpmnSystemPrompt(languageCode, languageName, strictMode, resourceAware);
  const userPrompt = addProcessDescription(processDescription);
  const conversation = [
    { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` }
  ];
  return conversation;
}

/**
 * Update conversation with feedback for model refinement
 * Similar to update_conversation() in prompt_engineering.py
 * @param conversation - Existing conversation array
 * @param feedback - Feedback to incorporate
 */
export function updateBpmnConversation(
  conversation: Array<{ role: string; content: string }>,
  feedback: string
): Array<{ role: string; content: string }> {
  const updatePrompt = `Please update the BPMN model to fix it based on the provided feedback. Please make sure the returned model matches the initial process description, all previously provided feedback, and the new feedback comment as well. Make sure to return valid BPMN 2.0 XML. This is the new feedback comment: ${feedback}`;
  conversation.push({ role: 'user', content: updatePrompt });
  return conversation;
}

/**
 * Model self-improvement prompt
 * Similar to model_self_improvement_prompt() in prompt_engineering.py
 */
export function getBpmnSelfImprovementPrompt(): string {
  return `Thank you! The model was generated successfully! Could you further improve the model? Please critically evaluate the BPMN process model and improve it accordingly **only where genuinely beneficial**. Potential improvement steps might for instance include adding missing activities, managing additional exceptions, increasing concurrency in execution, or elevating choices to higher levels. If you find the model already optimized or see no significant areas for enhancement, it is perfectly acceptable to make minimal adjustments (e.g., relabeling some activities) or to return the same model without any changes.`;
}

/**
 * Model self-improvement prompt (short version)
 * Similar to model_self_improvement_prompt_short() in prompt_engineering.py
 */
export function getBpmnSelfImprovementPromptShort(): string {
  return `Thank you! The model was generated successfully! Could you further improve the model? Please critically evaluate the BPMN process model against the initial process description and improve it accordingly **only where genuinely beneficial**. If you see no significant areas for enhancement, it is perfectly acceptable to return the same model without any changes. Regardless of whether you improve the model or not, make sure to include valid BPMN 2.0 XML in your response.`;
}

/**
 * Description self-improvement prompt
 * Similar to description_self_improvement_prompt() in prompt_engineering.py
 * @param description - The process description to improve
 */
export function getDescriptionSelfImprovementPrompt(description: string): string {
  return `You are provided with a process description. Your task is to optimize this description to make it richer and more detailed, while ensuring that all additions are relevant, accurate, and directly related to the original process. The goal is to make the description more comprehensive and suitable for BPMN process modeling purposes.

Possible areas for enhancement include:
- **Detail Enhancement:** Add specific details that are missing but crucial for understanding the process flow.
- **Clarity Improvement:** Clarify any ambiguous or vague statements to ensure that the description is clear and understandable.
- **Explicit Process Constructs:** Rephrase parts of the description to explicitly incorporate BPMN constructs. For example, change 'X happens in most cases' to 'there is an exclusive choice between performing X or skipping it'.

Please answer by only returning the improved process description without any additional text in your response. Do not define concrete activity labels yourself!

The process description:

${description}`;
}
