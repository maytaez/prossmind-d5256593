-- Seed initial templates with valid BPMN and PID XML
-- Note: created_by will be set to NULL initially, should be updated by admin when creating templates

-- Customer Onboarding (BPMN)
INSERT INTO public.templates (name, description, category, diagram_type, bpmn_xml, icon_name, is_active, usage_count)
VALUES (
  'Customer Onboarding',
  'Standard customer onboarding workflow with verification steps',
  'Business',
  'bpmn',
  '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_CustomerOnboarding" isExecutable="false">
    <startEvent id="StartEvent_1" name="New Customer"/>
    <userTask id="Task_1" name="Collect Customer Information"/>
    <userTask id="Task_2" name="Verify Identity"/>
    <exclusiveGateway id="Gateway_1" name="Verification Passed?"/>
    <userTask id="Task_3" name="Create Account"/>
    <userTask id="Task_4" name="Send Welcome Email"/>
    <userTask id="Task_5" name="Request Additional Documents"/>
    <endEvent id="EndEvent_1" name="Onboarding Complete"/>
    <endEvent id="EndEvent_2" name="Onboarding Failed"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2"/>
    <sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="Gateway_1"/>
    <sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_3" name="Yes"/>
    <sequenceFlow id="Flow_5" sourceRef="Gateway_1" targetRef="Task_5" name="No"/>
    <sequenceFlow id="Flow_6" sourceRef="Task_3" targetRef="Task_4"/>
    <sequenceFlow id="Flow_7" sourceRef="Task_4" targetRef="EndEvent_1"/>
    <sequenceFlow id="Flow_8" sourceRef="Task_5" targetRef="EndEvent_2"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_CustomerOnboarding">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="400" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="550" y="93" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="650" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_4_di" bpmnElement="Task_4">
        <dc:Bounds x="800" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_5_di" bpmnElement="Task_5">
        <dc:Bounds x="550" y="200" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="950" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_2_di" bpmnElement="EndEvent_2">
        <dc:Bounds x="700" y="220" width="36" height="36"/>
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
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="600" y="118"/>
        <di:waypoint x="650" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="575" y="143"/>
        <di:waypoint x="575" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="750" y="118"/>
        <di:waypoint x="800" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7">
        <di:waypoint x="900" y="118"/>
        <di:waypoint x="950" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8">
        <di:waypoint x="650" y="240"/>
        <di:waypoint x="700" y="238"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>',
  'Users',
  true,
  0
);

-- Order Fulfillment (BPMN)
INSERT INTO public.templates (name, description, category, diagram_type, bpmn_xml, icon_name, is_active, usage_count)
VALUES (
  'Order Fulfillment',
  'Complete order processing and fulfillment process',
  'E-Commerce',
  'bpmn',
  '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_OrderFulfillment" isExecutable="false">
    <startEvent id="StartEvent_1" name="Order Received"/>
    <userTask id="Task_1" name="Validate Order"/>
    <serviceTask id="Task_2" name="Check Inventory"/>
    <exclusiveGateway id="Gateway_1" name="In Stock?"/>
    <userTask id="Task_3" name="Process Payment"/>
    <userTask id="Task_4" name="Pick Items"/>
    <userTask id="Task_5" name="Pack Order"/>
    <userTask id="Task_6" name="Ship Order"/>
    <userTask id="Task_7" name="Notify Out of Stock"/>
    <endEvent id="EndEvent_1" name="Order Shipped"/>
    <endEvent id="EndEvent_2" name="Order Cancelled"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Task_2"/>
    <sequenceFlow id="Flow_3" sourceRef="Task_2" targetRef="Gateway_1"/>
    <sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_3" name="Yes"/>
    <sequenceFlow id="Flow_5" sourceRef="Gateway_1" targetRef="Task_7" name="No"/>
    <sequenceFlow id="Flow_6" sourceRef="Task_3" targetRef="Task_4"/>
    <sequenceFlow id="Flow_7" sourceRef="Task_4" targetRef="Task_5"/>
    <sequenceFlow id="Flow_8" sourceRef="Task_5" targetRef="Task_6"/>
    <sequenceFlow id="Flow_9" sourceRef="Task_6" targetRef="EndEvent_1"/>
    <sequenceFlow id="Flow_10" sourceRef="Task_7" targetRef="EndEvent_2"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_OrderFulfillment">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="400" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="550" y="93" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="650" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_4_di" bpmnElement="Task_4">
        <dc:Bounds x="800" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_5_di" bpmnElement="Task_5">
        <dc:Bounds x="950" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_6_di" bpmnElement="Task_6">
        <dc:Bounds x="1100" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_7_di" bpmnElement="Task_7">
        <dc:Bounds x="550" y="200" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="1250" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_2_di" bpmnElement="EndEvent_2">
        <dc:Bounds x="700" y="220" width="36" height="36"/>
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
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="600" y="118"/>
        <di:waypoint x="650" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="575" y="143"/>
        <di:waypoint x="575" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="750" y="118"/>
        <di:waypoint x="800" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7">
        <di:waypoint x="900" y="118"/>
        <di:waypoint x="950" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8">
        <di:waypoint x="1050" y="118"/>
        <di:waypoint x="1100" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9">
        <di:waypoint x="1200" y="118"/>
        <di:waypoint x="1250" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_10_di" bpmnElement="Flow_10">
        <di:waypoint x="650" y="240"/>
        <di:waypoint x="700" y="238"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>',
  'ShoppingCart',
  true,
  0
);

-- Invoice Approval (BPMN)
INSERT INTO public.templates (name, description, category, diagram_type, bpmn_xml, icon_name, is_active, usage_count)
VALUES (
  'Invoice Approval',
  'Multi-level invoice approval workflow',
  'Finance',
  'bpmn',
  '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_InvoiceApproval" isExecutable="false">
    <startEvent id="StartEvent_1" name="Invoice Received"/>
    <userTask id="Task_1" name="Review Invoice"/>
    <exclusiveGateway id="Gateway_1" name="Amount Check"/>
    <userTask id="Task_2" name="Manager Approval"/>
    <exclusiveGateway id="Gateway_2" name="Manager Approved?"/>
    <userTask id="Task_3" name="Finance Approval"/>
    <userTask id="Task_4" name="Process Payment"/>
    <userTask id="Task_5" name="Request Clarification"/>
    <endEvent id="EndEvent_1" name="Payment Processed"/>
    <endEvent id="EndEvent_2" name="Invoice Rejected"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1"/>
    <sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="Task_2" name="> $1000"/>
    <sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_4" name="<= $1000"/>
    <sequenceFlow id="Flow_5" sourceRef="Task_2" targetRef="Gateway_2"/>
    <sequenceFlow id="Flow_6" sourceRef="Gateway_2" targetRef="Task_3" name="Yes"/>
    <sequenceFlow id="Flow_7" sourceRef="Gateway_2" targetRef="Task_5" name="No"/>
    <sequenceFlow id="Flow_8" sourceRef="Task_3" targetRef="Task_4"/>
    <sequenceFlow id="Flow_9" sourceRef="Task_4" targetRef="EndEvent_1"/>
    <sequenceFlow id="Flow_10" sourceRef="Task_5" targetRef="EndEvent_2"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_InvoiceApproval">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="400" y="93" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="500" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_2_di" bpmnElement="Gateway_2" isMarkerVisible="true">
        <dc:Bounds x="650" y="93" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="750" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_4_di" bpmnElement="Task_4">
        <dc:Bounds x="900" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_5_di" bpmnElement="Task_5">
        <dc:Bounds x="650" y="200" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="1050" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_2_di" bpmnElement="EndEvent_2">
        <dc:Bounds x="800" y="220" width="36" height="36"/>
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
        <di:waypoint x="425" y="118"/>
        <di:waypoint x="500" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="425" y="168"/>
        <di:waypoint x="950" y="168"/>
        <di:waypoint x="950" y="158"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="600" y="118"/>
        <di:waypoint x="650" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="700" y="118"/>
        <di:waypoint x="750" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7">
        <di:waypoint x="675" y="143"/>
        <di:waypoint x="675" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8">
        <di:waypoint x="850" y="118"/>
        <di:waypoint x="900" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9">
        <di:waypoint x="1000" y="118"/>
        <di:waypoint x="1050" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_10_di" bpmnElement="Flow_10">
        <di:waypoint x="750" y="240"/>
        <di:waypoint x="800" y="238"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>',
  'Building2',
  true,
  0
);

-- IT Service Request (BPMN)
INSERT INTO public.templates (name, description, category, diagram_type, bpmn_xml, icon_name, is_active, usage_count)
VALUES (
  'IT Service Request',
  'IT support ticket and resolution process',
  'IT',
  'bpmn',
  '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="definitions" targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_ITServiceRequest" isExecutable="false">
    <startEvent id="StartEvent_1" name="Ticket Created"/>
    <userTask id="Task_1" name="Triage Request"/>
    <exclusiveGateway id="Gateway_1" name="Priority"/>
    <userTask id="Task_2" name="Assign to Technician"/>
    <userTask id="Task_3" name="Investigate Issue"/>
    <userTask id="Task_4" name="Resolve Issue"/>
    <userTask id="Task_5" name="Verify Resolution"/>
    <userTask id="Task_6" name="Escalate to Specialist"/>
    <endEvent id="EndEvent_1" name="Ticket Closed"/>
    <sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1"/>
    <sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1"/>
    <sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="Task_2" name="Standard"/>
    <sequenceFlow id="Flow_4" sourceRef="Gateway_1" targetRef="Task_6" name="High Priority"/>
    <sequenceFlow id="Flow_5" sourceRef="Task_2" targetRef="Task_3"/>
    <sequenceFlow id="Flow_6" sourceRef="Task_3" targetRef="Task_4"/>
    <sequenceFlow id="Flow_7" sourceRef="Task_4" targetRef="Task_5"/>
    <sequenceFlow id="Flow_8" sourceRef="Task_5" targetRef="EndEvent_1"/>
    <sequenceFlow id="Flow_9" sourceRef="Task_6" targetRef="Task_3"/>
  </process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_ITServiceRequest">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="150" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="400" y="93" width="50" height="50"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2">
        <dc:Bounds x="500" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_3_di" bpmnElement="Task_3">
        <dc:Bounds x="650" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_4_di" bpmnElement="Task_4">
        <dc:Bounds x="800" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_5_di" bpmnElement="Task_5">
        <dc:Bounds x="950" y="78" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_6_di" bpmnElement="Task_6">
        <dc:Bounds x="400" y="200" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="1100" y="100" width="36" height="36"/>
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
        <di:waypoint x="450" y="118"/>
        <di:waypoint x="500" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4">
        <di:waypoint x="425" y="143"/>
        <di:waypoint x="425" y="200"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5">
        <di:waypoint x="600" y="118"/>
        <di:waypoint x="650" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6">
        <di:waypoint x="750" y="118"/>
        <di:waypoint x="800" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7">
        <di:waypoint x="900" y="118"/>
        <di:waypoint x="950" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_8_di" bpmnElement="Flow_8">
        <di:waypoint x="1050" y="118"/>
        <di:waypoint x="1100" y="118"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_9_di" bpmnElement="Flow_9">
        <di:waypoint x="450" y="240"/>
        <di:waypoint x="650" y="158"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</definitions>',
  'Cog',
  true,
  0
);

-- Chemical Process Flow (PID)
INSERT INTO public.templates (name, description, category, diagram_type, bpmn_xml, icon_name, is_active, usage_count)
VALUES (
  'Chemical Process Flow',
  'Standard chemical processing P&ID template',
  'Manufacturing',
  'pid',
  '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:pid="http://pid.extensions/schema"
  id="Definitions_ChemicalProcess"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_Chemical" isExecutable="false">
    <bpmn:task id="Reactor_1" name="Chemical Reactor" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Pump_1" name="Feed Pump" pid:type="equipment" pid:symbol="pump" pid:category="mechanical" />
    <bpmn:task id="HeatExchanger_1" name="Heat Exchanger" pid:type="equipment" pid:symbol="heat_exchanger" pid:category="mechanical" />
    <bpmn:exclusiveGateway id="CV_101" name="Control Valve (CV-101)" pid:type="valve" pid:symbol="valve_control" pid:category="mechanical" />
    <bpmn:task id="Tank_1" name="Product Storage" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:dataObjectReference id="TT_101" name="Temperature Transmitter (TT-101)" pid:type="instrument" pid:symbol="transmitter_temperature" pid:category="control" />
    <bpmn:subProcess id="TC_101" name="Temperature Controller (TC-101)" pid:type="controller" pid:symbol="controller_pid" pid:category="control" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Pump_1" targetRef="Reactor_1" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Reactor_1" targetRef="HeatExchanger_1" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="HeatExchanger_1" targetRef="CV_101" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="CV_101" targetRef="Tank_1" pid:type="line" pid:category="process" />
    <bpmn:messageFlow id="Signal_1" sourceRef="Reactor_1" targetRef="TT_101" pid:type="line" pid:category="signal" pid:style="dashed" />
    <bpmn:messageFlow id="Signal_2" sourceRef="TT_101" targetRef="TC_101" pid:type="line" pid:category="signal" pid:style="dashed" />
    <bpmn:messageFlow id="Signal_3" sourceRef="TC_101" targetRef="CV_101" pid:type="line" pid:category="signal" pid:style="dashed" />
  </bpmn:process>
</bpmn:definitions>',
  'Factory',
  true,
  0
);

-- Water Treatment System (PID)
INSERT INTO public.templates (name, description, category, diagram_type, bpmn_xml, icon_name, is_active, usage_count)
VALUES (
  'Water Treatment System',
  'Water treatment facility P&ID template',
  'Utilities',
  'pid',
  '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:pid="http://pid.extensions/schema"
  id="Definitions_WaterTreatment"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_WaterTreatment" isExecutable="false">
    <bpmn:task id="Tank_1" name="Raw Water Tank" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Pump_1" name="Feed Pump" pid:type="equipment" pid:symbol="pump" pid:category="mechanical" />
    <bpmn:task id="Tank_2" name="Mixing Tank" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Tank_3" name="Settling Tank" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:task id="Filter_1" name="Sand Filter" pid:type="equipment" pid:symbol="filter" pid:category="mechanical" />
    <bpmn:task id="Tank_4" name="Treated Water Storage" pid:type="equipment" pid:symbol="tank" pid:category="mechanical" />
    <bpmn:exclusiveGateway id="CV_101" name="Control Valve (CV-101)" pid:type="valve" pid:symbol="valve_control" pid:category="mechanical" />
    <bpmn:dataObjectReference id="LT_101" name="Level Transmitter (LT-101)" pid:type="instrument" pid:symbol="transmitter_level" pid:category="control" />
    <bpmn:subProcess id="LC_101" name="Level Controller (LC-101)" pid:type="controller" pid:symbol="controller_pid" pid:category="control" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Tank_1" targetRef="Pump_1" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Pump_1" targetRef="Tank_2" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Tank_2" targetRef="Tank_3" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Tank_3" targetRef="Filter_1" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Filter_1" targetRef="CV_101" pid:type="line" pid:category="process" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="CV_101" targetRef="Tank_4" pid:type="line" pid:category="process" />
    <bpmn:messageFlow id="Signal_1" sourceRef="Tank_4" targetRef="LT_101" pid:type="line" pid:category="signal" pid:style="dashed" />
    <bpmn:messageFlow id="Signal_2" sourceRef="LT_101" targetRef="LC_101" pid:type="line" pid:category="signal" pid:style="dashed" />
    <bpmn:messageFlow id="Signal_3" sourceRef="LC_101" targetRef="CV_101" pid:type="line" pid:category="signal" pid:style="dashed" />
  </bpmn:process>
</bpmn:definitions>',
  'Factory',
  true,
  0
);


