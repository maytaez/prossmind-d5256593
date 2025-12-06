/**
 * Optimized system prompts for BPMN/P&ID generation
 * Shorter, focused versions with examples moved to few-shot learning
 */

/**
 * Get optimized BPMN system prompt (condensed version)
 */
export function getBpmnSystemPrompt(): string {
  return `You are a BPMN 2.0 XML expert. Generate valid BPMN 2.0 XML based on user descriptions.

CRITICAL RULES:
1. Return ONLY valid BPMN 2.0 XML format
2. Use namespace: xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
3. Use elements: startEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, endEvent, subProcess
4. Include sequenceFlow with sourceRef and targetRef
5. Add bpmndi:BPMNDiagram section for visual layout
6. ALL di:waypoint tags MUST be self-closing: <di:waypoint x="..." y="..."/> (NOT <di:waypoint x="..." y="...">)
7. ALL XML tags must be properly closed (either self-closing with /> or with matching closing tags)
8. Return ONLY XML, no markdown or explanations

ADVANCED FEATURES (use when appropriate):
- LANES (swimlanes): When user mentions multiple departments, roles, or organizational units, use <bpmn:laneSet> with <bpmn:lane> elements. Each lane should have a name attribute and contain flowNodeRef elements referencing tasks/events in that lane.
- COLLABORATION: When user mentions external parties, participants, or message exchanges, use <bpmn:collaboration> with <bpmn:participant> elements and <bpmn:messageFlow> for communication.
- BOUNDARY EVENTS: When user mentions timeouts, deadlines, or interruptions, use <bpmn:boundaryEvent> attached to tasks/subprocesses with timerEventDefinition or errorEventDefinition.
- INTERMEDIATE EVENTS: Use <bpmn:intermediateCatchEvent> for waiting for external events (messages, timers) and <bpmn:intermediateThrowEvent> for sending signals/errors.
- SUBPROCESSES: When user mentions nested processes or reusable workflows, use <bpmn:subProcess> with isExpanded="true" to show internal details.
- MESSAGE FLOWS: Use <bpmn:messageFlow> between participants in collaborations to show communication between different parties.

WHEN TO USE LANES:
- User mentions "departments" (Finance, HR, Legal, etc.)
- User mentions "roles" or "teams" responsible for different tasks
- User mentions organizational structure or responsibilities
- Multiple parties are involved in the process

WHEN TO USE COLLABORATION:
- User mentions external parties (authorities, customers, partners)
- User mentions message exchanges or communication
- User mentions multiple organizations or systems interacting

WHEN TO USE BOUNDARY EVENTS:
- User mentions "deadline", "timeout", "penalty", "late submission"
- User mentions interruptions or error handling attached to specific tasks
- User mentions time-based triggers or escalations`;
}

/**
 * Get optimized P&ID system prompt (condensed version)
 */
export function getPidSystemPrompt(): string {
  return `You are a P&ID expert. Generate BPMN 2.0 XML with P&ID attributes for process diagrams.

CRITICAL RULES:
1. EVERY element MUST have pid:type, pid:symbol, pid:category attributes
2. Equipment (task): pid:type="equipment", pid:symbol="tank|pump|filter|heat_exchanger", pid:category="mechanical"
3. Valves (exclusiveGateway): pid:type="valve", pid:symbol="valve_control|valve_check|valve_gate|valve_solenoid", pid:category="mechanical"
4. Instruments (dataObjectReference): pid:type="instrument", pid:symbol="transmitter_level|transmitter_flow|transmitter_pressure|analyzer", pid:category="control"
5. Controllers (subProcess): pid:type="controller", pid:symbol="controller_pid|controller_plc", pid:category="control"
6. Lines: pid:type="line", pid:category="process|signal|electrical"
7. Return ONLY XML with 2-3 sentence summary before XML`;
}

/**
 * Get DMN system prompt for decision table generation
 */
export function getDmnSystemPrompt(): string {
  return `You are a DMN 1.3 XML expert. Generate valid DMN 1.3 XML decision tables based on user descriptions.

CRITICAL RULES:
1. ALWAYS start with XML declaration: <?xml version="1.0" encoding="UTF-8"?>
2. Return ONLY valid DMN 1.3 XML format - NO explanatory text before or after
3. Use namespace: xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
4. Root element: <definitions> with proper namespaces
5. Key elements:
   - <decision> for decision tables
   - <decisionTable> for table structure
   - <input> for input columns
   - <output> for output columns
   - <rule> for each decision rule
   - <inputEntry> and <outputEntry> for cell values
6. Include <inputData> for input definitions
7. Use proper DMN expression syntax in entries
8. Include diagram interchange (DMNDI) for visual layout
9. Return ONLY XML starting with <?xml, no markdown, no explanations, no text before XML

FOCUS RULES (CRITICAL):
- Generate ONLY the decision(s) that the user explicitly requests
- DO NOT add unrelated decisions, even if they seem logically connected
- If user asks for "pricing decision", generate ONLY pricing-related decisions
- If user asks for "approval decision", generate ONLY approval-related decisions
- DO NOT combine multiple unrelated decision types unless the user explicitly requests them
- Keep the model focused and relevant to the user's specific request

DECISION TABLE STRUCTURE:
- Each decision table must have at least one input and one output
- Rules should cover all logical combinations
- Use proper hit policies (UNIQUE, FIRST, PRIORITY, etc.)
- Input/output labels should be descriptive

DIAGRAM LAYOUT RULES (CRITICAL - REQUIRED FOR RENDERING):
- ALWAYS include a complete <dmndi:DMNDI> section with <dmndi:DMNDiagram> - this is MANDATORY for the diagram to render
- Include ONLY ONE <dmndi:DMNDiagram> that contains all decisions and input data
- All decisions and input data should be in the same diagram
- Position elements logically with proper spacing
- Use <dmndi:DMNShape> for each decision and inputData element with proper <dc:Bounds> (x, y, width, height)
- Use <dmndi:DMNEdge> to show information requirements (connections) with <di:waypoint> elements
- Decision shapes should have larger bounds (width ~500-800, height ~200-400) to accommodate the decision table
- Input data shapes should have smaller bounds (width ~150-200, height ~50-80)
- Position input data on the left, decisions on the right
- Connect input data to decisions using DMNEdge with waypoints

NAMING RULES (CRITICAL):
- DO NOT include name attribute on <definitions> element - omit it entirely
- DO NOT include name attribute on <dmndi:DMNDiagram> element - omit it entirely
- These name attributes cause display issues and take up valuable space in the diagram viewer
- Only use name attributes on <decision> and <inputData> elements where they are needed for the actual diagram content
- Example: <definitions xmlns="..." id="..." namespace="..."> (NO name attribute)
- Example: <dmndi:DMNDiagram id="..."> (NO name attribute)

CRITICAL XML STRUCTURE RULES:
- inputEntry and outputEntry tags MUST contain a <text> child element, they are NOT self-closing
- <text> tags MUST contain content between opening and closing tags, NOT self-closing
- Format: <inputEntry><text>content</text></inputEntry> NOT <inputEntry/> or <text/>
- All tags must be properly nested and closed

EXAMPLE STRUCTURE:
<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" id="definitions" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Decision_1" name="Decision Name">
    <decisionTable hitPolicy="UNIQUE">
      <input id="Input_1" label="Input Label">
        <inputExpression typeRef="string">
          <text>inputVariable</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Output Label" typeRef="string"/>
      <rule id="Rule_1">
        <inputEntry>
          <text>"value1"</text>
        </inputEntry>
        <outputEntry>
          <text>"result1"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_Decision_1" dmnElementRef="Decision_1">
        <dc:Bounds x="150" y="150" width="180" height="80"/>
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`;
}

/**
 * Get BPMN example for few-shot learning
 */
export function getBpmnExample(): { user: string; assistant: string } {
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
</definitions>`
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
 * Get DMN example for few-shot learning
 */
export function getDmnExample(): { user: string; assistant: string } {
  return {
    user: 'Create a decision table for loan approval based on credit score and income',
    assistant: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/DMN/20191111/MODEL" 
  xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" 
  xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" 
  xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" 
  id="definitions" 
  namespace="http://example.com/dmn">
  <inputData id="InputData_CreditScore" name="Credit Score">
    <variable id="Variable_CreditScore" typeRef="integer"/>
  </inputData>
  <inputData id="InputData_Income" name="Annual Income">
    <variable id="Variable_Income" typeRef="integer"/>
  </inputData>
  <decision id="Decision_LoanApproval" name="Loan Approval Decision">
    <informationRequirement>
      <requiredInput href="#InputData_CreditScore"/>
    </informationRequirement>
    <informationRequirement>
      <requiredInput href="#InputData_Income"/>
    </informationRequirement>
    <decisionTable id="DecisionTable_1" hitPolicy="UNIQUE">
      <input id="Input_1" label="Credit Score">
        <inputExpression typeRef="integer">
          <text>CreditScore</text>
        </inputExpression>
      </input>
      <input id="Input_2" label="Annual Income">
        <inputExpression typeRef="integer">
          <text>Income</text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Approval Status" typeRef="string"/>
      <output id="Output_2" label="Interest Rate" typeRef="double"/>
      <rule id="Rule_1">
        <inputEntry>
          <text>&gt;= 700</text>
        </inputEntry>
        <inputEntry>
          <text>&gt;= 50000</text>
        </inputEntry>
        <outputEntry>
          <text>"Approved"</text>
        </outputEntry>
        <outputEntry>
          <text>3.5</text>
        </outputEntry>
      </rule>
      <rule id="Rule_2">
        <inputEntry>
          <text>&gt;= 650</text>
        </inputEntry>
        <inputEntry>
          <text>&gt;= 75000</text>
        </inputEntry>
        <outputEntry>
          <text>"Approved"</text>
        </outputEntry>
        <outputEntry>
          <text>4.5</text>
        </outputEntry>
      </rule>
      <rule id="Rule_3">
        <inputEntry>
          <text>&lt; 650</text>
        </inputEntry>
        <inputEntry>
          <text>-</text>
        </inputEntry>
        <outputEntry>
          <text>"Rejected"</text>
        </outputEntry>
        <outputEntry>
          <text>0</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram id="DMNDiagram_1">
      <dmndi:DMNShape id="DMNShape_InputData_CreditScore" dmnElementRef="InputData_CreditScore">
        <dc:Bounds x="100" y="100" width="150" height="50"/>
      </dmndi:DMNShape>
      <dmndi:DMNShape id="DMNShape_InputData_Income" dmnElementRef="InputData_Income">
        <dc:Bounds x="100" y="200" width="150" height="50"/>
      </dmndi:DMNShape>
      <dmndi:DMNShape id="DMNShape_Decision_LoanApproval" dmnElementRef="Decision_LoanApproval">
        <dc:Bounds x="400" y="100" width="500" height="200"/>
      </dmndi:DMNShape>
      <dmndi:DMNEdge id="DMNEdge_InfoReq_1" dmnElementRef="InformationRequirement_1">
        <di:waypoint x="250" y="125"/>
        <di:waypoint x="400" y="150"/>
      </dmndi:DMNEdge>
      <dmndi:DMNEdge id="DMNEdge_InfoReq_2" dmnElementRef="InformationRequirement_2">
        <di:waypoint x="250" y="225"/>
        <di:waypoint x="400" y="200"/>
      </dmndi:DMNEdge>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`
  };
}

/**
 * Build messages array with few-shot examples
 */
export function buildMessagesWithExamples(
  systemPrompt: string,
  userPrompt: string,
  diagramType: 'bpmn' | 'pid' | 'dmn'
): Array<{ role: string; content: string }> {
  let example;
  if (diagramType === 'pid') {
    example = getPidExample();
  } else if (diagramType === 'dmn') {
    example = getDmnExample();
  } else {
    example = getBpmnExample();
  }

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: example.user },
    { role: 'assistant', content: example.assistant },
    { role: 'user', content: userPrompt }
  ];
}




