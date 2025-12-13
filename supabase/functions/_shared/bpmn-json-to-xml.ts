/**
 * BPMN JSON to XML Converter
 * 
 * Converts BPMN JSON structure to valid BPMN 2.0 XML with Diagram Interchange (DI)
 */

import {
    BPMNDefinitions,
    BPMNProcess,
    BPMNElement,
    BPMNSequenceFlow,
    validateBPMNDefinitions
} from './bpmn-json-schema.ts';
import { calculateLayout, Layout, offsetLayout } from './bpmn-layout-calculator.ts';

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generate BPMN element XML
 */
function generateElementXml(element: BPMNElement, indent: string = '    '): string {
    const attrs: string[] = [
        `id="${element.id}"`,
        `name="${escapeXml(element.name)}"`,
    ];

    // Add type-specific attributes
    if (element.type === 'subprocess') {
        // Subprocess has child elements
        let xml = `${indent}<bpmn:subProcess ${attrs.join(' ')}>\n`;

        // Add subprocess elements
        if (element.elements) {
            element.elements.forEach(subElement => {
                xml += generateElementXml(subElement, indent + '  ');
            });
        }

        // Add subprocess flows
        if (element.flows) {
            element.flows.forEach(flow => {
                xml += generateSequenceFlowXml(flow, indent + '  ');
            });
        }

        xml += `${indent}</bpmn:subProcess>\n`;
        return xml;
    }

    // Gateway direction
    if (element.type.includes('Gateway') && element.gatewayDirection) {
        attrs.push(`gatewayDirection="${element.gatewayDirection}"`);
    }

    // Boundary event attributes
    if (element.type === 'boundaryEvent') {
        if (element.attachedToRef) {
            attrs.push(`attachedToRef="${element.attachedToRef}"`);
        }
        if (element.cancelActivity !== undefined) {
            attrs.push(`cancelActivity="${element.cancelActivity}"`);
        }
    }

    // Map element type to BPMN tag
    const tagName = element.type;

    // Check if element has event definition
    if (element.eventDefinitionType && element.type.includes('Event')) {
        let xml = `${indent}<bpmn:${tagName} ${attrs.join(' ')}>\n`;
        xml += `${indent}  <bpmn:${element.eventDefinitionType}EventDefinition />\n`;
        xml += `${indent}</bpmn:${tagName}>\n`;
        return xml;
    }

    // Self-closing tag for simple elements
    return `${indent}<bpmn:${tagName} ${attrs.join(' ')} />\n`;
}

/**
 * Generate sequence flow XML
 */
function generateSequenceFlowXml(flow: BPMNSequenceFlow, indent: string = '    '): string {
    const attrs: string[] = [
        `id="${flow.id}"`,
        `sourceRef="${flow.sourceRef}"`,
        `targetRef="${flow.targetRef}"`,
    ];

    if (flow.name) {
        attrs.push(`name="${escapeXml(flow.name)}"`);
    }

    if (flow.isDefault) {
        // This is handled as an attribute on the gateway, not the flow
    }

    if (flow.conditionExpression) {
        let xml = `${indent}<bpmn:sequenceFlow ${attrs.join(' ')}>\n`;
        xml += `${indent}  <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">${escapeXml(flow.conditionExpression)}</bpmn:conditionExpression>\n`;
        xml += `${indent}</bpmn:sequenceFlow>\n`;
        return xml;
    }

    return `${indent}<bpmn:sequenceFlow ${attrs.join(' ')} />\n`;
}

/**
 * Generate process XML
 */
function generateProcessXml(process: BPMNProcess): string {
    const isExecutable = process.isExecutable !== undefined ? process.isExecutable : false;

    let xml = `  <bpmn:process id="${process.id}" name="${escapeXml(process.name)}" isExecutable="${isExecutable}">\n`;

    // Add documentation if present
    if (process.documentation) {
        xml += `    <bpmn:documentation>${escapeXml(process.documentation)}</bpmn:documentation>\n`;
    }

    // Add all elements
    process.elements.forEach(element => {
        xml += generateElementXml(element);
    });

    // Add all sequence flows
    process.flows.forEach(flow => {
        xml += generateSequenceFlowXml(flow);
    });

    xml += '  </bpmn:process>\n';
    return xml;
}

/**
 * Generate BPMN Shape XML for DI
 */
function generateShapeXml(
    elementId: string,
    x: number,
    y: number,
    width: number,
    height: number,
    isExpanded: boolean = false,
    indent: string = '      '
): string {
    const attrs = [
        `id="Shape_${elementId}"`,
        `bpmnElement="${elementId}"`,
    ];

    if (isExpanded) {
        attrs.push('isExpanded="true"');
    }

    let xml = `${indent}<bpmndi:BPMNShape ${attrs.join(' ')}>\n`;
    xml += `${indent}  <dc:Bounds x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(width)}" height="${Math.round(height)}" />\n`;
    xml += `${indent}</bpmndi:BPMNShape>\n`;

    return xml;
}

/**
 * Generate BPMN Edge XML for DI
 */
function generateEdgeXml(
    flowId: string,
    waypoints: Array<{ x: number; y: number }>,
    indent: string = '      '
): string {
    let xml = `${indent}<bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">\n`;

    waypoints.forEach(point => {
        xml += `${indent}  <di:waypoint x="${Math.round(point.x)}" y="${Math.round(point.y)}" />\n`;
    });

    xml += `${indent}</bpmndi:BPMNEdge>\n`;

    return xml;
}

/**
 * Generate DI for subprocess (recursive)
 */
function generateSubprocessDI(
    element: BPMNElement,
    parentX: number,
    parentY: number,
    indent: string = '      '
): string {
    if (!element.elements || !element.flows) {
        return '';
    }

    // Calculate layout for subprocess content
    const subLayout = calculateLayout(
        {
            id: element.id,
            name: element.name,
            elements: element.elements,
            flows: element.flows
        } as BPMNProcess,
        0,
        0
    );

    // Offset layout to be inside the subprocess
    const padding = 50;
    const offsettedLayout = offsetLayout(subLayout, parentX + padding, parentY + padding);

    let xml = '';

    // Generate shapes for subprocess elements
    offsettedLayout.nodes.forEach(node => {
        const isSubprocess = node.element.type === 'subprocess';
        xml += generateShapeXml(
            node.id,
            node.bounds.x,
            node.bounds.y,
            node.bounds.width,
            node.bounds.height,
            isSubprocess,
            indent
        );

        // Recursively generate DI for nested subprocesses
        if (isSubprocess) {
            xml += generateSubprocessDI(
                node.element,
                node.bounds.x,
                node.bounds.y,
                indent
            );
        }
    });

    // Generate edges for subprocess flows
    offsettedLayout.edges.forEach(edge => {
        xml += generateEdgeXml(edge.id, edge.waypoints, indent);
    });

    return xml;
}

/**
 * Generate Diagram Interchange (DI) XML
 */
function generateDiagramXml(process: BPMNProcess, layout: Layout): string {
    let xml = `  <bpmndi:BPMNDiagram id="BPMNDiagram_${process.id}">\n`;
    xml += `    <bpmndi:BPMNPlane id="BPMNPlane_${process.id}" bpmnElement="${process.id}">\n`;

    // Generate shapes for all elements
    layout.nodes.forEach(node => {
        const isSubprocess = node.element.type === 'subprocess';
        xml += generateShapeXml(
            node.id,
            node.bounds.x,
            node.bounds.y,
            node.bounds.width,
            node.bounds.height,
            isSubprocess
        );

        // If it's a subprocess, generate DI for its content
        if (isSubprocess) {
            xml += generateSubprocessDI(
                node.element,
                node.bounds.x,
                node.bounds.y
            );
        }
    });

    // Generate edges for all flows
    layout.edges.forEach(edge => {
        xml += generateEdgeXml(edge.id, edge.waypoints);
    });

    xml += '    </bpmndi:BPMNPlane>\n';
    xml += '  </bpmndi:BPMNDiagram>\n';

    return xml;
}

/**
 * Main conversion function: JSON to XML
 */
export function convertBpmnJsonToXml(definitions: BPMNDefinitions): string {
    // Validate input
    const validation = validateBPMNDefinitions(definitions);
    if (!validation.valid) {
        const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        throw new Error(`Invalid BPMN JSON: ${errorMessages}`);
    }

    const targetNamespace = definitions.targetNamespace || 'http://bpmn.io/schema/bpmn';

    // Start XML document
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<bpmn:definitions ';
    xml += `xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" `;
    xml += `xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" `;
    xml += `xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" `;
    xml += `xmlns:di="http://www.omg.org/spec/DD/20100524/DI" `;
    xml += `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `;
    xml += `id="${definitions.id}" `;
    xml += `targetNamespace="${targetNamespace}">\n`;

    // Generate process XML
    definitions.processes.forEach(process => {
        xml += generateProcessXml(process);
    });

    // Generate DI for each process
    definitions.processes.forEach(process => {
        const layout = calculateLayout(process);
        xml += generateDiagramXml(process, layout);
    });

    xml += '</bpmn:definitions>';

    return xml;
}

/**
 * Convert a single process to XML (convenience function)
 */
export function convertProcessToXml(process: BPMNProcess): string {
    const definitions: BPMNDefinitions = {
        id: `Definitions_${process.id}`,
        name: process.name,
        targetNamespace: 'http://bpmn.io/schema/bpmn',
        processes: [process],
    };

    return convertBpmnJsonToXml(definitions);
}
