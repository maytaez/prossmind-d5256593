/**
 * BPMN XML Parser
 * 
 * Utilities for parsing structure-only BPMN XML and extracting process elements
 */

export interface ParsedLane {
    id: string;
    name: string;
    flowNodeRefs: string[];
}

export interface ParsedProcess {
    id: string;
    name?: string;
    lanes: ParsedLane[];
    elements: any[];
    flows: any[];
}

export interface ParsedCollaboration {
    participants: Array<{
        id: string;
        name: string;
        processRef: string;
    }>;
}

/**
 * Parse structure-only BPMN XML to extract process definition
 */
export async function parseStructureXml(xml: string): Promise<{
  process: ParsedProcess;
  collaboration?: ParsedCollaboration;
}> {
  // Simple XML parsing using regex (lightweight, no external deps)
  // For production, consider using a proper XML parser

  const result: {
    process: ParsedProcess;
    collaboration?: ParsedCollaboration;
}> {
    // Simple XML parsing using regex (lightweight, no external deps)
    // For production, consider using a proper XML parser

    const result: {
        process: ParsedProcess;
        collaboration?: ParsedCollaboration;
    } = {
        process: {
            id: '',
            lanes: [],
            elements: [],
            flows: []
        }
    };

    // Extract process
    const processMatch = xml.match(/<bpmn:process[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/);
    if (processMatch) {
        result.process.id = processMatch[1];
        result.process.name = processMatch[2];
    }

    // Extract lanes
    const laneMatches = xml.matchAll(/<bpmn:lane[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/bpmn:lane>/g);
    for (const match of laneMatches) {
        const laneId = match[1];
        const laneName = match[2];
        const laneContent = match[3];

        // Extract flowNodeRefs
        const flowNodeRefs: string[] = [];
        const flowNodeMatches = laneContent.matchAll(/<bpmn:flowNodeRef>([^<]*)<\/bpmn:flowNodeRef>/g);
        for (const nodeMatch of flowNodeMatches) {
            flowNodeRefs.push(nodeMatch[1]);
        }

        result.process.lanes.push({
            id: laneId,
            name: laneName,
            flowNodeRefs
        });
    }

    // Extract elements (tasks, events, gateways, etc.)
    const elementPatterns = [
        { type: 'startEvent', regex: /<bpmn:startEvent[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'endEvent', regex: /<bpmn:endEvent[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'userTask', regex: /<bpmn:userTask[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'task', regex: /<bpmn:task[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'serviceTask', regex: /<bpmn:serviceTask[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'sendTask', regex: /<bpmn:sendTask[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'receiveTask', regex: /<bpmn:receiveTask[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'exclusiveGateway', regex: /<bpmn:exclusiveGateway[^>]*id="([^"]*)"[^>]*(?:name="([^"]*)")?[^>]*>/g },
        { type: 'parallelGateway', regex: /<bpmn:parallelGateway[^>]*id="([^"]*)"[^>]*(?:name="([^"]*)")?[^>]*>/g },
        { type: 'inclusiveGateway', regex: /<bpmn:inclusiveGateway[^>]*id="([^"]*)"[^>]*(?:name="([^"]*)")?[^>]*>/g },
        { type: 'subprocess', regex: /<bpmn:subProcess[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
        { type: 'boundaryEvent', regex: /<bpmn:boundaryEvent[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*attachedToRef="([^"]*)"[^>]*>/g },
        { type: 'intermediateThrowEvent', regex: /<bpmn:intermediateThrowEvent[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*>/g },
    ];

    elementPatterns.forEach(({ type, regex }) => {
        const matches = xml.matchAll(regex);
        for (const match of matches) {
            const element: any = {
                id: match[1],
                type,
                name: match[2] || ''
            };

            // For boundary events, capture attachedToRef
            if (type === 'boundaryEvent' && match[3]) {
                element.attachedToRef = match[3];
            }

            result.process.elements.push(element);
        }
    });

    // Extract sequence flows
    const flowMatches = xml.matchAll(/<bpmn:sequenceFlow[^>]*id="([^"]*)"[^>]*sourceRef="([^"]*)"[^>]*targetRef="([^"]*)"[^>]*(?:name="([^"]*)")?[^>]*>/g);
    for (const match of flowMatches) {
        result.process.flows.push({
            id: match[1],
            sourceRef: match[2],
            targetRef: match[3],
            name: match[4] || ''
        });
    }

    // Extract collaboration (if present)
    const collaborationMatch = xml.match(/<bpmn:collaboration[^>]*>/);
    if (collaborationMatch) {
        result.collaboration = { participants: [] };

        const participantMatches = xml.matchAll(/<bpmn:participant[^>]*id="([^"]*)"[^>]*name="([^"]*)"[^>]*processRef="([^"]*)"[^>]*>/g);
        for (const match of participantMatches) {
            result.collaboration.participants.push({
                id: match[1],
                name: match[2],
                processRef: match[3]
            });
        }
    }

  // Infer lane assignments if flowNodeRefs are empty
  const hasFlowNodeRefs = result.process.lanes.some((lane) => lane.flowNodeRefs.length > 0);
  if (!hasFlowNodeRefs && result.process.lanes.length > 0) {
    console.log("[XML Parser] flowNodeRefs empty, inferring lane assignments...");
    const { inferLaneAssignments } = await import("./bpmn-lane-inference.ts");
    result.process.lanes = inferLaneAssignments(result.process.lanes, result.process.elements);
  }

  return result;
}

/**
 * Generate BPMN DI XML from layout
 */
export function generateDiagramXml(layout: any, processId: string, lanes: ParsedLane[] = []): string {
    let xml = '  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n';
    xml += `    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">\n`;

    // Generate lane shapes if present
    lanes.forEach((lane, index) => {
        const laneHeight = layout.laneHeights?.get(lane.id) || 150;
        const laneY = layout.laneYPositions?.get(lane.id) || (index * 150);

        xml += `      <bpmndi:BPMNShape id="Shape_${lane.id}" bpmnElement="${lane.id}" isHorizontal="true">\n`;
        xml += `        <dc:Bounds x="160" y="${laneY}" width="${layout.totalWidth + 100}" height="${laneHeight}"/>\n`;
        xml += `      </bpmndi:BPMNShape>\n`;
    });

    // Generate element shapes - handle both Map and direct bounds
    if (layout.nodes instanceof Map) {
        // layout.nodes is Map<string, LayoutNode> or Map<string, Bounds>
        layout.nodes.forEach((node: any, id: string) => {
            const bounds = node.bounds || node; // Handle both LayoutNode and Bounds
            xml += `      <bpmndi:BPMNShape id="Shape_${id}" bpmnElement="${id}">\n`;
            xml += `        <dc:Bounds x="${Math.round(bounds.x)}" y="${Math.round(bounds.y)}" width="${Math.round(bounds.width)}" height="${Math.round(bounds.height)}"/>\n`;
            xml += `      </bpmndi:BPMNShape>\n`;
        });
    }

    // Generate edges
    if (layout.edges instanceof Map) {
        layout.edges.forEach((edge: any, id: string) => {
            xml += `      <bpmndi:BPMNEdge id="Edge_${id}" bpmnElement="${id}">\n`;
            edge.waypoints.forEach((point: any) => {
                xml += `        <di:waypoint x="${Math.round(point.x)}" y="${Math.round(point.y)}"/>\n`;
            });
            xml += `      </bpmndi:BPMNEdge>\n`;
        });
    }

    xml += '    </bpmndi:BPMNPlane>\n';
    xml += '  </bpmndi:BPMNDiagram>\n';

    return xml;
}

/**
 * Insert diagram XML before closing </bpmn:definitions>
 */
export function insertDiagram(structureXml: string, diagramXml: string): string {
    return structureXml.replace('</bpmn:definitions>', diagramXml + '</bpmn:definitions>');
}