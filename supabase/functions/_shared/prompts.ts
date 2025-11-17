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
3. Use elements: startEvent, task, userTask, serviceTask, exclusiveGateway, parallelGateway, endEvent
4. Include sequenceFlow with sourceRef and targetRef
5. Add bpmndi:BPMNDiagram section for visual layout
6. Return ONLY XML, no markdown or explanations`;
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
 * Build messages array with few-shot examples
 */
export function buildMessagesWithExamples(
  systemPrompt: string,
  userPrompt: string,
  diagramType: 'bpmn' | 'pid'
): Array<{ role: string; content: string }> {
  const example = diagramType === 'pid' ? getPidExample() : getBpmnExample();
  
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: example.user },
    { role: 'assistant', content: example.assistant },
    { role: 'user', content: userPrompt }
  ];
}




