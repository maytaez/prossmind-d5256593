/**
 * XML utility functions for BPMN/P&ID processing
 */

/**
 * Extract summary from BPMN XML to reduce token usage
 */
export function extractXmlSummary(xml: string): string {
  try {
    // Extract element counts
    const taskCount = (xml.match(/<task|<userTask|<serviceTask/gi) || []).length;
    const gatewayCount = (xml.match(/<exclusiveGateway|<parallelGateway|<inclusiveGateway/gi) || []).length;
    const eventCount = (xml.match(/<startEvent|<endEvent|<intermediateEvent/gi) || []).length;
    const flowCount = (xml.match(/<sequenceFlow|<messageFlow/gi) || []).length;
    const poolCount = (xml.match(/<process/gi) || []).length;
    const laneCount = (xml.match(/<lane/gi) || []).length;
    const subprocessCount = (xml.match(/<subProcess/gi) || []).length;

    // Extract first 10 element names/IDs
    const elementMatches = xml.match(/id="([^"]+)"/g) || [];
    const elementIds = elementMatches.slice(0, 10).map(m => m.replace(/id="|"/g, ''));

    // Extract structure info
    const hasSwimlanes = laneCount > 0;
    const hasSubprocesses = subprocessCount > 0;
    const hasMessageFlows = xml.includes('<messageFlow');

    // Build summary
    const summary = `BPMN Diagram Summary:
- Tasks: ${taskCount}
- Gateways: ${gatewayCount}
- Events: ${eventCount}
- Flows: ${flowCount}
- Processes: ${poolCount}
- Swimlanes: ${laneCount}
- Subprocesses: ${subprocessCount}
- Has swimlanes: ${hasSwimlanes}
- Has subprocesses: ${hasSubprocesses}
- Has message flows: ${hasMessageFlows}
- Key element IDs: ${elementIds.join(', ')}`;

    return summary;
  } catch (error) {
    console.warn('Failed to extract XML summary, using fallback:', error);
    // Fallback: return first 500 chars
    return xml.substring(0, 500) + '...';
  }
}




