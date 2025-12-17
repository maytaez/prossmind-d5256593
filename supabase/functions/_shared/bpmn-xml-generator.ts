/**
 * Stage 4: BPMN XML Generation (Deterministic)
 * Converts validated BPMN IR to BPMN 2.0 XML with diagram interchange
 * NO LLM calls - pure deterministic code
 */

import type { BpmnIR } from "./types/bpmn-ir.ts";
import type { EnterpriseStyleProfile } from "./types/bpmn-ir.ts";
import { calculateLayout } from "./bpmn-layout-calculator.ts";
import type { Layout, Bounds } from "./bpmn-layout-calculator.ts";
import type { BPMNElement, BPMNSequenceFlow, BPMNProcess, BPMNElementType } from "./bpmn-json-schema.ts";

const LAYOUT_CONFIG = {
  startX: 200,
  startY: 100,
  nodeWidth: 120,
  nodeHeight: 80,
  horizontalSpacing: 150,
  verticalSpacing: 100,
  laneHeight: 150,
  laneSpacing: 50,
};

/**
 * Generate BPMN 2.0 XML from BPMN IR
 */
export function generateBpmnXml(ir: BpmnIR, styleProfile: EnterpriseStyleProfile): string {
  // 1. Generate process structure XML
  const structureXml = generateProcessStructure(ir, styleProfile);

  // 2. Calculate layout
  const layout = calculateLayoutFromIR(ir);

  // 3. Generate diagram interchange XML
  const diXml = generateDiagramInterchange(ir, layout);

  // 4. Combine into complete BPMN XML
  return combineBpmnXml(structureXml, diXml);
}

/**
 * Generate BPMN process structure (process, lanes, nodes, flows)
 */
function generateProcessStructure(ir: BpmnIR, styleProfile: EnterpriseStyleProfile): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${ir.process.id}" name="${escapeXml(ir.process.name)}" isExecutable="false">`;

  // Generate lanes if present
  if (ir.lanes.length > 0) {
    xml += '\n    <bpmn:laneSet id="LaneSet_1">';
    for (const lane of ir.lanes) {
      xml += `\n      <bpmn:lane id="${lane.id}" name="${escapeXml(lane.name)}">`;
      // Add flowNodeRef for nodes in this lane
      const laneNodes = ir.nodes.filter((n) => n.lane === lane.id);
      for (const node of laneNodes) {
        xml += `\n        <bpmn:flowNodeRef>${node.id}</bpmn:flowNodeRef>`;
      }
      xml += "\n      </bpmn:lane>";
    }
    xml += "\n    </bpmn:laneSet>";
  }

  // Generate nodes
  for (const node of ir.nodes) {
    const nodeName = applyNamingConvention(node.name, node.type, styleProfile);
    xml += `\n    <bpmn:${mapNodeTypeToBpmnElement(node.type)} id="${node.id}" name="${escapeXml(nodeName)}"/>`;
  }

  // Generate flows
  for (const flow of ir.flows) {
    let flowXml = `\n    <bpmn:sequenceFlow id="Flow_${flow.from}_${flow.to}" sourceRef="${flow.from}" targetRef="${flow.to}"`;
    if (flow.condition) {
      flowXml += `>\n      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeXml(flow.condition)}</bpmn:conditionExpression>\n    </bpmn:sequenceFlow>`;
    } else {
      flowXml += "/>";
    }
    xml += flowXml;
  }

  xml += "\n  </bpmn:process>\n</bpmn:definitions>";

  return xml;
}

/**
 * Map IR node type to BPMN element name
 */
function mapNodeTypeToBpmnElement(nodeType: string): string {
  const mapping: Record<string, string> = {
    start_event: "startEvent",
    end_event: "endEvent",
    user_task: "userTask",
    service_task: "serviceTask",
    manual_task: "manualTask",
    exclusive_gateway: "exclusiveGateway",
    parallel_gateway: "parallelGateway",
    inclusive_gateway: "inclusiveGateway",
  };
  return mapping[nodeType] || "task";
}

/**
 * Apply naming convention from style profile
 */
function applyNamingConvention(name: string, nodeType: string, styleProfile: EnterpriseStyleProfile): string {
  if (nodeType === "service_task" && styleProfile.service_task_prefix) {
    if (!name.startsWith(styleProfile.service_task_prefix)) {
      return `${styleProfile.service_task_prefix} ${name}`;
    }
  }
  return name;
}

/**
 * Calculate layout from BPMN IR
 */
function calculateLayoutFromIR(ir: BpmnIR): Layout & { laneHeights?: Map<string, number>; laneYPositions?: Map<string, number>; totalWidth?: number; totalHeight?: number } {
  // Convert IR to format expected by layout calculator
  const elements: BPMNElement[] = ir.nodes.map((node) => ({
    id: node.id,
    type: mapNodeTypeToBpmnElement(node.type) as BPMNElementType,
    type: mapNodeTypeToBpmnElement(node.type) as BPMNElementType,
    name: node.name,
  }));

  const flows: BPMNSequenceFlow[] = ir.flows.map((flow, index) => ({
    id: `Flow_${flow.from}_${flow.to}`,
    sourceRef: flow.from,
    targetRef: flow.to,
    name: flow.name || undefined,
  }));

  const process: BPMNProcess = {
    id: ir.process.id,
    name: ir.process.name,
    elements,
    flows,
    lanes: ir.lanes.map((lane) => ({
      id: lane.id,
      name: lane.name,
      flowNodeRefs: ir.nodes.filter(n => n.lane === lane.id).map(n => n.id),
    })),
  };

  const layout = calculateLayout(process, LAYOUT_CONFIG.startX, LAYOUT_CONFIG.startY);

  // Add lane layout information
  const laneHeights = new Map<string, number>();
  const laneYPositions = new Map<string, number>();

  if (ir.lanes.length > 0) {
    let currentY = LAYOUT_CONFIG.startY;
    for (const lane of ir.lanes) {
      const laneNodes = ir.nodes.filter((n) => n.lane === lane.id);
      const maxY = Math.max(
        ...laneNodes.map((n) => {
          const node = layout.nodes.get(n.id);
          return node ? node.bounds.y + node.bounds.height : 0;
        }),
        LAYOUT_CONFIG.laneHeight,
      );
      const laneHeight = maxY - currentY + 50; // Add padding
      laneHeights.set(lane.id, laneHeight);
      laneYPositions.set(lane.id, currentY);
      currentY += laneHeight + LAYOUT_CONFIG.laneSpacing;
    }
  }

  return {
    ...layout,
    laneHeights,
    laneYPositions,
  };
}

/**
 * Generate diagram interchange XML
 */
function generateDiagramInterchange(ir: BpmnIR, layout: Layout & { laneHeights?: Map<string, number>; laneYPositions?: Map<string, number>; totalWidth?: number; totalHeight?: number }): string {
  let xml = `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${ir.process.id}">`;

  // Generate lane shapes if present
  if (ir.lanes.length > 0) {
    let laneY = LAYOUT_CONFIG.startY;
    for (const lane of ir.lanes) {
      const laneHeight = layout.laneHeights?.get(lane.id) || LAYOUT_CONFIG.laneHeight;
      const laneWidth = layout.totalWidth || 800;
      xml += `\n      <bpmndi:BPMNShape id="Shape_${lane.id}" bpmnElement="${lane.id}" isHorizontal="true">
        <dc:Bounds x="${LAYOUT_CONFIG.startX}" y="${laneY}" width="${laneWidth}" height="${laneHeight}"/>
      </bpmndi:BPMNShape>`;
      laneY += laneHeight + LAYOUT_CONFIG.laneSpacing;
    }
  }

  // Generate node shapes
  if (layout.nodes instanceof Map) {
    layout.nodes.forEach((node: any, id: string) => {
      const bounds = node.bounds || node;
      xml += `\n      <bpmndi:BPMNShape id="Shape_${id}" bpmnElement="${id}">
        <dc:Bounds x="${Math.round(bounds.x)}" y="${Math.round(bounds.y)}" width="${Math.round(bounds.width)}" height="${Math.round(bounds.height)}"/>
      </bpmndi:BPMNShape>`;
    });
  }

  // Generate edge shapes (flows)
  if (layout.edges instanceof Map) {
    layout.edges.forEach((edge: any, id: string) => {
      xml += `\n      <bpmndi:BPMNEdge id="Edge_${id}" bpmnElement="${id}">`;
      if (edge.waypoints && Array.isArray(edge.waypoints)) {
        for (const waypoint of edge.waypoints) {
          xml += `\n        <di:waypoint x="${Math.round(waypoint.x)}" y="${Math.round(waypoint.y)}"/>`;
        }
      } else {
        // Fallback: simple start and end points
        const sourceBounds = layout.nodes instanceof Map ? layout.nodes.get(edge.flow?.sourceRef)?.bounds : null;
        const targetBounds = layout.nodes instanceof Map ? layout.nodes.get(edge.flow?.targetRef)?.bounds : null;
        if (sourceBounds && targetBounds) {
          xml += `\n        <di:waypoint x="${Math.round(sourceBounds.x + sourceBounds.width)}" y="${Math.round(sourceBounds.y + sourceBounds.height / 2)}"/>`;
          xml += `\n        <di:waypoint x="${Math.round(targetBounds.x)}" y="${Math.round(targetBounds.y + targetBounds.height / 2)}"/>`;
        }
      }
      xml += "\n      </bpmndi:BPMNEdge>";
    });
  }

  xml += "\n    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>";

  return xml;
}

/**
 * Combine structure XML and diagram interchange XML
 */
function combineBpmnXml(structureXml: string, diXml: string): string {
  // Insert DI before closing </bpmn:definitions>
  return structureXml.replace("</bpmn:definitions>", `${diXml}\n</bpmn:definitions>`);
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
