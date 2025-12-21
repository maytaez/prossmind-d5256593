/**
 * BPMN TypeScript Type Definitions
 *
 * Type definitions for BPMN elements, flows, and processes
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
  attachedToRef?: string; // For boundary events
  elements?: BPMNElement[]; // For subprocesses
  flows?: BPMNSequenceFlow[]; // For subprocesses
}

export interface BPMNSequenceFlow {
  id: string;
  sourceRef: string;
  targetRef: string;
  name?: string;
}

export interface BPMNLane {
  id: string;
  name: string;
  flowNodeRefs: string[];
}

export interface BPMNProcess {
  id: string;
  name?: string;
  elements: BPMNElement[];
  flows: BPMNSequenceFlow[];
  lanes?: BPMNLane[];
}

export interface BPMNParticipant {
  id: string;
  name: string;
  processRef: string;
}

export interface BPMNCollaboration {
  participants: BPMNParticipant[];
}
