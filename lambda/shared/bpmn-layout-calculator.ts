/**
 * BPMN Layout Calculator
 * 
 * Automatically calculates optimal positions and sizes for BPMN elements
 * using a simplified graph layout algorithm.
 */

import { BPMNElement, BPMNSequenceFlow, BPMNProcess } from './bpmn-json-schema';

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface LayoutNode {
    id: string;
    element: BPMNElement;
    bounds: Bounds;
    level: number; // Depth in the graph (for vertical positioning)
    column: number; // Position in the level (for horizontal positioning)
}

export interface LayoutEdge {
    id: string;
    flow: BPMNSequenceFlow;
    waypoints: Point[];
}

export interface Layout {
    nodes: Map<string, LayoutNode>;
    edges: Map<string, LayoutEdge>;
    totalWidth: number;
    totalHeight: number;
}

/**
 * Element size constants
 */
const ELEMENT_SIZES = {
    startEvent: { width: 36, height: 36 },
    endEvent: { width: 36, height: 36 },
    intermediateThrowEvent: { width: 36, height: 36 },
    intermediateCatchEvent: { width: 36, height: 36 },
    boundaryEvent: { width: 36, height: 36 },
    task: { width: 100, height: 80 },
    userTask: { width: 100, height: 80 },
    serviceTask: { width: 100, height: 80 },
    scriptTask: { width: 100, height: 80 },
    businessRuleTask: { width: 100, height: 80 },
    manualTask: { width: 100, height: 80 },
    sendTask: { width: 100, height: 80 },
    receiveTask: { width: 100, height: 80 },
    exclusiveGateway: { width: 50, height: 50 },
    parallelGateway: { width: 50, height: 50 },
    inclusiveGateway: { width: 50, height: 50 },
    eventBasedGateway: { width: 50, height: 50 },
    subprocess: { width: 350, height: 200 }, // Will be calculated dynamically
};

const LAYOUT_CONFIG = {
    horizontalSpacing: 80, // Space between elements horizontally
    verticalSpacing: 100, // Space between levels
    subprocessPadding: 50, // Padding inside subprocess
    minSubprocessWidth: 350,
    minSubprocessHeight: 200,
    startX: 100,
    startY: 100,
};

/**
 * Get element size based on type
 */
export function getElementSize(element: BPMNElement): { width: number; height: number } {
  return ELEMENT_SIZES[element.type] || ELEMENT_SIZES.task;
}

/**
 * Build a graph structure from BPMN elements and flows
 */
interface GraphNode {
    id: string;
    element: BPMNElement;
    incoming: string[]; // IDs of source nodes
    outgoing: string[]; // IDs of target nodes
    level?: number;
    column?: number;
}

function buildGraph(elements: BPMNElement[], flows: BPMNSequenceFlow[]): Map<string, GraphNode> {
    const graph = new Map<string, GraphNode>();

    // Initialize nodes
    elements.forEach(element => {
        graph.set(element.id, {
            id: element.id,
            element,
            incoming: [],
            outgoing: [],
        });
    });

    // Add edges
    flows.forEach(flow => {
        const sourceNode = graph.get(flow.sourceRef);
        const targetNode = graph.get(flow.targetRef);

        if (sourceNode && targetNode) {
            sourceNode.outgoing.push(flow.targetRef);
            targetNode.incoming.push(flow.sourceRef);
        }
    });

    return graph;
}

/**
 * Assign levels to nodes using topological sort (BFS)
 */
function assignLevels(graph: Map<string, GraphNode>): void {
    // Find start nodes (no incoming edges)
    const startNodes = Array.from(graph.values()).filter(node => node.incoming.length === 0);

    if (startNodes.length === 0) {
        // No clear start - pick the first node
        const firstNode = graph.values().next().value;
        if (firstNode) {
            startNodes.push(firstNode);
        }
    }

    // BFS to assign levels
    const queue: GraphNode[] = [...startNodes];
    const visited = new Set<string>();

    startNodes.forEach(node => {
        node.level = 0;
        visited.add(node.id);
    });

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLevel = current.level ?? 0;

        current.outgoing.forEach(targetId => {
            const target = graph.get(targetId);
            if (!target) return;

            // Set level to max of current level + 1 or existing level
            const newLevel = currentLevel + 1;
            if (target.level === undefined || target.level < newLevel) {
                target.level = newLevel;
            }

            if (!visited.has(targetId)) {
                visited.add(targetId);
                queue.push(target);
            }
        });
    }

    // Handle any unvisited nodes (disconnected components)
    graph.forEach(node => {
        if (node.level === undefined) {
            node.level = 0;
        }
    });
}

/**
 * Assign columns within each level to minimize edge crossings
 */
function assignColumns(graph: Map<string, GraphNode>): void {
    // Group nodes by level
    const levelGroups = new Map<number, GraphNode[]>();

    graph.forEach(node => {
        const level = node.level ?? 0;
        if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
        }
        levelGroups.get(level)!.push(node);
    });

    // Assign columns within each level
    levelGroups.forEach(nodes => {
        nodes.forEach((node, index) => {
            node.column = index;
        });
    });
}

/**
 * Calculate bounds for all elements
 */
function calculateBounds(graph: Map<string, GraphNode>, startX: number, startY: number): Map<string, Bounds> {
    const bounds = new Map<string, Bounds>();

    // Group by level to calculate positions
    const levelGroups = new Map<number, GraphNode[]>();
    graph.forEach(node => {
        const level = node.level ?? 0;
        if (!levelGroups.has(level)) {
            levelGroups.set(level, []);
        }
        levelGroups.get(level)!.push(node);
    });

    // Calculate Y position for each level
    let currentY = startY;
    const levelYPositions = new Map<number, number>();

    Array.from(levelGroups.keys()).sort((a, b) => a - b).forEach(level => {
        levelYPositions.set(level, currentY);

        // Find max height in this level
        const maxHeight = Math.max(
            ...levelGroups.get(level)!.map(node => getElementSize(node.element).height)
        );

        currentY += maxHeight + LAYOUT_CONFIG.verticalSpacing;
    });

    // Calculate X position for each node
    levelGroups.forEach((nodes, level) => {
        const y = levelYPositions.get(level) ?? startY;

        // Sort by column
        nodes.sort((a, b) => (a.column ?? 0) - (b.column ?? 0));

        let currentX = startX;

        nodes.forEach(node => {
            const size = getElementSize(node.element);

            bounds.set(node.id, {
                x: currentX,
                y: y,
                width: size.width,
                height: size.height,
            });

            currentX += size.width + LAYOUT_CONFIG.horizontalSpacing;
        });
    });

    return bounds;
}

/**
 * Calculate waypoints for sequence flows
 */
function calculateWaypoints(
    flow: BPMNSequenceFlow,
    sourceBounds: Bounds,
    targetBounds: Bounds
): Point[] {
    // Simple direct connection with two waypoints
    // Start from right edge of source
    const sourcePoint: Point = {
        x: sourceBounds.x + sourceBounds.width,
        y: sourceBounds.y + sourceBounds.height / 2,
    };

    // End at left edge of target
    const targetPoint: Point = {
        x: targetBounds.x,
        y: targetBounds.y + targetBounds.height / 2,
    };

    // If target is directly to the right, use straight line
    if (targetBounds.x > sourceBounds.x + sourceBounds.width) {
        return [sourcePoint, targetPoint];
    }

    // If target is below or above, add intermediate points
    const midX = (sourcePoint.x + targetPoint.x) / 2;

    return [
        sourcePoint,
        { x: midX, y: sourcePoint.y },
        { x: midX, y: targetPoint.y },
        targetPoint,
    ];
}

/**
 * Calculate layout for subprocess (recursive)
 */
function calculateSubprocessLayout(element: BPMNElement): Bounds {
    if (!element.elements || !element.flows) {
        return {
            x: 0,
            y: 0,
            width: LAYOUT_CONFIG.minSubprocessWidth,
            height: LAYOUT_CONFIG.minSubprocessHeight,
        };
    }

    // Calculate layout for subprocess content
    const subLayout = calculateLayout(
        { id: element.id, name: element.name, elements: element.elements, flows: element.flows } as BPMNProcess,
        0,
        0
    );

    // Add padding
    const width = Math.max(
        subLayout.totalWidth + LAYOUT_CONFIG.subprocessPadding * 2,
        LAYOUT_CONFIG.minSubprocessWidth
    );

    const height = Math.max(
        subLayout.totalHeight + LAYOUT_CONFIG.subprocessPadding * 2,
        LAYOUT_CONFIG.minSubprocessHeight
    );

    return { x: 0, y: 0, width, height };
}

/**
 * Main layout calculation function
 */
export function calculateLayout(
    process: BPMNProcess,
    startX: number = LAYOUT_CONFIG.startX,
    startY: number = LAYOUT_CONFIG.startY
): Layout {
  const nodes = new Map<string, LayoutNode>();
  const edges = new Map<string, LayoutEdge>();

  // Build graph
  const graph = buildGraph(process.elements, process.flows);

  // Assign levels and columns
  assignLevels(graph);
  assignColumns(graph);

  // Calculate bounds for each element
  const boundsMap = calculateBounds(graph, startX, startY);

  // Handle subprocesses - recalculate their size based on content
  process.elements.forEach((element) => {
    if (element.type === "subprocess") {
      const subprocessBounds = calculateSubprocessLayout(element);
      const currentBounds = boundsMap.get(element.id);
      if (currentBounds) {
        currentBounds.width = subprocessBounds.width;
        currentBounds.height = subprocessBounds.height;
      }
    }
  });

  // Create layout nodes
  graph.forEach((graphNode, id) => {
    const bounds = boundsMap.get(id);
    if (bounds) {
      nodes.set(id, {
        id,
        element: graphNode.element,
        bounds,
        level: graphNode.level ?? 0,
        column: graphNode.column ?? 0,
      });
    }
  });

  // Calculate waypoints for edges
  process.flows.forEach((flow) => {
    const sourceBounds = boundsMap.get(flow.sourceRef);
    const targetBounds = boundsMap.get(flow.targetRef);

    if (sourceBounds && targetBounds) {
      const waypoints = calculateWaypoints(flow, sourceBounds, targetBounds);
      edges.set(flow.id, {
        id: flow.id,
        flow,
        waypoints,
      });
    }
  });

  // Calculate total dimensions
  let maxX = 0;
  let maxY = 0;

  nodes.forEach((node) => {
    const right = node.bounds.x + node.bounds.width;
    const bottom = node.bounds.y + node.bounds.height;

    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  });

  return {
    nodes,
    edges,
    totalWidth: maxX - startX,
    totalHeight: maxY - startY,
  };
}

/**
 * Adjust layout positions by offset (for placing subprocesses)
 */
export function offsetLayout(layout: Layout, offsetX: number, offsetY: number): Layout {
    const newNodes = new Map<string, LayoutNode>();
    const newEdges = new Map<string, LayoutEdge>();

    layout.nodes.forEach((node, id) => {
        newNodes.set(id, {
            ...node,
            bounds: {
                x: node.bounds.x + offsetX,
                y: node.bounds.y + offsetY,
                width: node.bounds.width,
                height: node.bounds.height,
            },
        });
    });

    layout.edges.forEach((edge, id) => {
        newEdges.set(id, {
            ...edge,
            waypoints: edge.waypoints.map(point => ({
                x: point.x + offsetX,
                y: point.y + offsetY,
            })),
        });
    });

    return {
        nodes: newNodes,
        edges: newEdges,
        totalWidth: layout.totalWidth,
        totalHeight: layout.totalHeight,
    };
}

/**
 * Lane layout interfaces and functions
 */
export interface LaneLayout {
    id: string;
    name: string;
    flowNodeRefs: string[];
    y: number;
    height: number;
}

/**
 * Calculate lane layout - stack lanes vertically based on content
 */
export function calculateLaneLayout(
    lanes: Array<{ id: string; name: string; flowNodeRefs: string[] }>,
    boundsMap: Map<string, Bounds>,
    startY: number = 100
): { lanes: LaneLayout[]; totalHeight: number } {
    const laneLayouts: LaneLayout[] = [];
    let currentY = startY;

    const MIN_LANE_HEIGHT = 150;
    const LANE_PADDING = 40;

    lanes.forEach(lane => {
        // Find all elements in this lane
        const laneElements = lane.flowNodeRefs
            .map(ref => boundsMap.get(ref))
            .filter(bounds => bounds != null) as Bounds[];

        // Calculate required height based on elements
        let maxBottom = currentY + MIN_LANE_HEIGHT;
        laneElements.forEach(bounds => {
            const bottom = bounds.y + bounds.height + LANE_PADDING;
            if (bottom > maxBottom) {
                maxBottom = bottom;
            }
        });

        const laneHeight = Math.max(MIN_LANE_HEIGHT, maxBottom - currentY);

        laneLayouts.push({
            id: lane.id,
            name: lane.name,
            flowNodeRefs: lane.flowNodeRefs,
            y: currentY,
            height: laneHeight
        });

        currentY += laneHeight;
    });

    return {
        lanes: laneLayouts,
        totalHeight: currentY - startY
    };
}

/**
 * Adjust element positions to fit within their assigned lanes
 */
export function constrainElementsToLanes(
    boundsMap: Map<string, Bounds>,
    lanes: LaneLayout[]
): Map<string, Bounds> {
    const adjustedBounds = new Map<string, Bounds>();

    lanes.forEach(lane => {
        const LANE_TOP_MARGIN = 30; // Space for lane label
        const LANE_BOTTOM_MARGIN = 20;

        lane.flowNodeRefs.forEach(elementId => {
            const bounds = boundsMap.get(elementId);
            if (!bounds) return;

            // Adjust Y position to be within lane
            const minY = lane.y + LANE_TOP_MARGIN;
            const maxY = lane.y + lane.height - LANE_BOTTOM_MARGIN - bounds.height;

            const adjustedY = Math.max(minY, Math.min(bounds.y, maxY));

            adjustedBounds.set(elementId, {
                ...bounds,
                y: adjustedY
            });
        });
    });

    // Copy non-lane elements as-is
    boundsMap.forEach((bounds, id) => {
        if (!adjustedBounds.has(id)) {
            adjustedBounds.set(id, bounds);
        }
    });

    return adjustedBounds;
}

/**
 * Calculate position for boundary event attached to a task
 */
export function calculateBoundaryEventPosition(
    boundaryEventId: string,
    attachedToId: string,
    attachedToBounds: Bounds,
    position: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
    offset: number = 0
): Bounds {
    const size = ELEMENT_SIZES.boundaryEvent;
    const halfWidth = size.width / 2;
    const halfHeight = size.height / 2;

    let x, y;

    switch (position) {
        case 'bottom':
            x = attachedToBounds.x + attachedToBounds.width / 2 + offset - halfWidth;
            y = attachedToBounds.y + attachedToBounds.height - halfHeight;
            break;
        case 'top':
            x = attachedToBounds.x + attachedToBounds.width / 2 + offset - halfWidth;
            y = attachedToBounds.y - halfHeight;
            break;
        case 'left':
            x = attachedToBounds.x - halfWidth;
            y = attachedToBounds.y + attachedToBounds.height / 2 + offset - halfHeight;
            break;
        case 'right':
            x = attachedToBounds.x + attachedToBounds.width - halfWidth;
            y = attachedToBounds.y + attachedToBounds.height / 2 + offset - halfHeight;
            break;
    }

    return {
        x,
        y,
        width: size.width,
        height: size.height
    };
}

/**
 * Position all boundary events attached to tasks
 */
export function positionBoundaryEvents(
    boundaryEvents: Array<{ id: string; attachedToRef: string }>,
    boundsMap: Map<string, Bounds>
): Map<string, Bounds> {
    const boundaryBounds = new Map<string, Bounds>();

    // Group by attached element to handle multiple boundary events
    const groupedEvents = new Map<string, Array<{ id: string; attachedToRef: string }>>();
    boundaryEvents.forEach(event => {
        if (!groupedEvents.has(event.attachedToRef)) {
            groupedEvents.set(event.attachedToRef, []);
        }
        groupedEvents.get(event.attachedToRef)!.push(event);
    });

    // Position each group
    groupedEvents.forEach((events, attachedToId) => {
        const attachedToBounds = boundsMap.get(attachedToId);
        if (!attachedToBounds) return;

        // Distribute events evenly on bottom edge
        const spacing = 50;
        const totalWidth = (events.length - 1) * spacing;
        const startOffset = -totalWidth / 2;

        events.forEach((event, index) => {
            const offset = startOffset + index * spacing;
            const bounds = calculateBoundaryEventPosition(
                event.id,
                attachedToId,
                attachedToBounds,
                'bottom',
                offset
            );
            boundaryBounds.set(event.id, bounds);
        });
    });

    return boundaryBounds;
}