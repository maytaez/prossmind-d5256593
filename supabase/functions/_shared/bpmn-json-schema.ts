/**
 * BPMN JSON Schema Type Definitions
 * 
 * Type definitions for BPMN elements, flows, and processes
 * used by the layout calculator and other BPMN utilities.
 */

export type BPMNElementType =
  | "startEvent"
  | "endEvent"
  | "intermediateThrowEvent"
  | "intermediateCatchEvent"
  | "boundaryEvent"
  | "task"
  | "userTask"
  | "serviceTask"
  | "scriptTask"
  | "businessRuleTask"
  | "manualTask"
  | "sendTask"
  | "receiveTask"
  | "exclusiveGateway"
  | "parallelGateway"
  | "inclusiveGateway"
  | "eventBasedGateway"
  | "subprocess";

export interface BPMNElement {
  id: string;
  type: BPMNElementType;
  name?: string;
  // For subprocesses
  elements?: BPMNElement[];
  flows?: BPMNSequenceFlow[];
  // Additional properties
  [key: string]: unknown;
}

export interface BPMNSequenceFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
  name?: string;
  conditionExpression?: string;
}

export interface BPMNLane {
  id: string;
  name: string;
  flowNodeRefs: string[];
}

export interface BPMNParticipant {
  id: string;
  name: string;
  processRef?: string;
}

export interface BPMNProcess {
  id: string;
  name?: string;
  elements: BPMNElement[];
  flows: BPMNSequenceFlow[];
  lanes?: BPMNLane[];
}

export interface BPMNCollaboration {
  id: string;
  participants: BPMNParticipant[];
  messageFlows?: BPMNMessageFlow[];
}

export interface BPMNMessageFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
  name?: string;
}

export interface BPMNDefinitions {
  id: string;
  name?: string;
  targetNamespace?: string;
  collaboration?: BPMNCollaboration;
  processes: BPMNProcess[];
}
