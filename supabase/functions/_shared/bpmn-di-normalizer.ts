/**
 * BPMN DI (Diagram Interchange) Normalizer
 * 
 * Fixes common DI issues from LLM-generated BPMN XML:
 * - Elements with too-small bounds (renders as tiny dots)
 * - Lane/participant bounds that don't encompass their children
 * - Overlapping elements at same position
 * - Missing or zero-size bounds
 */

// Minimum sizes for different BPMN element types
const MIN_SIZES: Record<string, { width: number; height: number }> = {
  "startEvent": { width: 36, height: 36 },
  "endEvent": { width: 36, height: 36 },
  "intermediateThrowEvent": { width: 36, height: 36 },
  "intermediateCatchEvent": { width: 36, height: 36 },
  "boundaryEvent": { width: 36, height: 36 },
  "task": { width: 100, height: 80 },
  "userTask": { width: 100, height: 80 },
  "serviceTask": { width: 100, height: 80 },
  "manualTask": { width: 100, height: 80 },
  "sendTask": { width: 100, height: 80 },
  "receiveTask": { width: 100, height: 80 },
  "scriptTask": { width: 100, height: 80 },
  "businessRuleTask": { width: 100, height: 80 },
  "callActivity": { width: 100, height: 80 },
  "subProcess": { width: 200, height: 150 },
  "exclusiveGateway": { width: 50, height: 50 },
  "parallelGateway": { width: 50, height: 50 },
  "inclusiveGateway": { width: 50, height: 50 },
  "eventBasedGateway": { width: 50, height: 50 },
  "complexGateway": { width: 50, height: 50 },
  "textAnnotation": { width: 100, height: 30 },
  "dataObjectReference": { width: 36, height: 50 },
  "dataStoreReference": { width: 50, height: 50 },
};

const DEFAULT_MIN_SIZE = { width: 100, height: 80 };
const LANE_PADDING = 30;
const PARTICIPANT_PADDING = 50;

interface BoundsInfo {
  shapeId: string;   // bpmnElement ref
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normalize DI bounds in BPMN XML to fix rendering issues
 */
export function normalizeBpmnDI(xml: string): string {
  try {
    // Step 1: Build a map of bpmn element IDs to their types
    const elementTypes = extractElementTypes(xml);
    
    // Step 2: Build a map of lanes to their flowNodeRefs
    const laneChildren = extractLaneChildren(xml);
    
    // Step 3: Build a map of participants to their process IDs
    const participantProcesses = extractParticipantProcesses(xml);
    
    // Step 4: Parse all BPMNShape bounds
    const shapes = parseBpmnShapes(xml);
    
    if (shapes.length === 0) {
      console.log("[DI Normalizer] No BPMNShapes found, skipping normalization");
      return xml;
    }
    
    // Step 5: Fix element sizes
    let result = xml;
    const updatedBounds = new Map<string, BoundsInfo>();
    
    for (const shape of shapes) {
      const elementType = elementTypes.get(shape.shapeId);
      if (!elementType) continue;
      
      // Skip participants and lanes for now - handle them after children
      if (elementType === "participant" || elementType === "lane") {
        updatedBounds.set(shape.shapeId, { ...shape });
        continue;
      }
      
      const minSize = MIN_SIZES[elementType] || DEFAULT_MIN_SIZE;
      
      let newWidth = shape.width;
      let newHeight = shape.height;
      let needsUpdate = false;
      
      // Fix too-small elements
      if (shape.width < minSize.width || shape.width <= 0) {
        newWidth = minSize.width;
        needsUpdate = true;
      }
      if (shape.height < minSize.height || shape.height <= 0) {
        newHeight = minSize.height;
        needsUpdate = true;
      }
      
      // Fix extremely large elements (LLM sometimes generates 10000+ px)
      if (shape.width > 500 && !elementType.includes("subProcess")) {
        newWidth = minSize.width;
        needsUpdate = true;
      }
      if (shape.height > 300 && !elementType.includes("subProcess")) {
        newHeight = minSize.height;
        needsUpdate = true;
      }
      
      updatedBounds.set(shape.shapeId, {
        ...shape,
        width: newWidth,
        height: newHeight,
      });
      
      if (needsUpdate) {
        result = updateShapeBounds(result, shape.shapeId, shape.x, shape.y, newWidth, newHeight);
      }
    }
    
    // Step 6: Add missing lane BPMNShapes and fix lane bounds
    for (const [laneId, childIds] of laneChildren.entries()) {
      let laneBounds = updatedBounds.get(laneId);
      
      // If lane has no BPMNShape, create one based on its children
      if (!laneBounds && childIds.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const childId of childIds) {
          const childBounds = updatedBounds.get(childId);
          if (!childBounds) continue;
          minX = Math.min(minX, childBounds.x);
          minY = Math.min(minY, childBounds.y);
          maxX = Math.max(maxX, childBounds.x + childBounds.width);
          maxY = Math.max(maxY, childBounds.y + childBounds.height);
        }
        if (minX !== Infinity) {
          const newBounds: BoundsInfo = {
            shapeId: laneId,
            x: minX - LANE_PADDING,
            y: minY - LANE_PADDING,
            width: (maxX - minX) + (LANE_PADDING * 2),
            height: (maxY - minY) + (LANE_PADDING * 2),
          };
          // Insert BPMNShape before </BPMNPlane>
          const laneShapeXml = `      <bpmndi:BPMNShape id="${laneId}_Shape" bpmnElement="${laneId}" isHorizontal="true">\n        <dc:Bounds x="${newBounds.x}" y="${newBounds.y}" width="${newBounds.width}" height="${newBounds.height}" />\n      </bpmndi:BPMNShape>\n`;
          result = result.replace(/<\/bpmndi:BPMNPlane>/, laneShapeXml + "    </bpmndi:BPMNPlane>");
          updatedBounds.set(laneId, newBounds);
          console.log(`[DI Normalizer] Added missing BPMNShape for lane: ${laneId}`);
        }
        continue;
      }
      
      if (!laneBounds) continue;
      
      // Calculate bounding box of all children
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasChildren = false;
      
      for (const childId of childIds) {
        const childBounds = updatedBounds.get(childId);
        if (!childBounds) continue;
        hasChildren = true;
        minX = Math.min(minX, childBounds.x);
        minY = Math.min(minY, childBounds.y);
        maxX = Math.max(maxX, childBounds.x + childBounds.width);
        maxY = Math.max(maxY, childBounds.y + childBounds.height);
      }
      
      if (hasChildren) {
        const requiredX = minX - LANE_PADDING;
        const requiredY = minY - LANE_PADDING;
        const requiredWidth = (maxX - minX) + (LANE_PADDING * 2);
        const requiredHeight = (maxY - minY) + (LANE_PADDING * 2);
        
        // Only expand lanes, never shrink them
        const newX = Math.min(laneBounds.x, requiredX);
        const newY = Math.min(laneBounds.y, requiredY);
        const newWidth = Math.max(laneBounds.width, requiredWidth, laneBounds.x + laneBounds.width - newX);
        const newHeight = Math.max(laneBounds.height, requiredHeight, laneBounds.y + laneBounds.height - newY);
        
        if (newX !== laneBounds.x || newY !== laneBounds.y || 
            newWidth !== laneBounds.width || newHeight !== laneBounds.height) {
          result = updateShapeBounds(result, laneId, newX, newY, newWidth, newHeight);
          updatedBounds.set(laneId, { shapeId: laneId, x: newX, y: newY, width: newWidth, height: newHeight });
        }
      }
    }
    
    // Step 7: Fix overlapping participants - map each participant to its lanes
    // Build lane-to-participant mapping
    const laneToParticipant = new Map<string, string>();
    for (const [participantId, processId] of participantProcesses.entries()) {
      // Find lanes that belong to this participant's process
      // Try to match by checking if the lane's children overlap with the participant's expected area
      // Or use the laneSet structure in the XML
      const laneSetPattern = new RegExp(
        `<bpmn:process[^>]*id="${escapeRegex(processId)}"[^>]*>[\\s\\S]*?<bpmn:laneSet[^>]*>([\\s\\S]*?)<\\/bpmn:laneSet>`,
        "g"
      );
      const lsMatch = laneSetPattern.exec(xml);
      if (lsMatch) {
        const laneSetContent = lsMatch[1];
        const laneIdPattern = /<bpmn:lane\s[^>]*id="([^"]+)"/g;
        let lm;
        while ((lm = laneIdPattern.exec(laneSetContent)) !== null) {
          laneToParticipant.set(lm[1], participantId);
        }
      }
    }
    
    // Fix participant bounds based on their own lanes/elements only
    const participantEntries = Array.from(participantProcesses.entries());
    
    // Detect if participants overlap (same bounds)
    const participantBoundsList: Array<{ id: string; bounds: BoundsInfo }> = [];
    for (const [participantId] of participantEntries) {
      const bounds = updatedBounds.get(participantId);
      if (bounds) participantBoundsList.push({ id: participantId, bounds });
    }
    
    const hasOverlap = participantBoundsList.length >= 2 && participantBoundsList.every(
      p => p.bounds.x === participantBoundsList[0].bounds.x && 
           p.bounds.y === participantBoundsList[0].bounds.y
    );
    
    if (hasOverlap && participantBoundsList.length >= 2) {
      console.log(`[DI Normalizer] Detected ${participantBoundsList.length} overlapping participants, repositioning...`);
      
      // For each participant, compute bounds from its lanes' children
      let currentY = participantBoundsList[0].bounds.y;
      
      for (const [participantId] of participantEntries) {
        const participantBounds = updatedBounds.get(participantId);
        if (!participantBounds) continue;
        
        // Find all elements belonging to this participant's lanes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasContent = false;
        
        for (const [laneId, childIds] of laneChildren.entries()) {
          if (laneToParticipant.get(laneId) !== participantId) continue;
          for (const childId of childIds) {
            const childBounds = updatedBounds.get(childId);
            if (!childBounds) continue;
            hasContent = true;
            minX = Math.min(minX, childBounds.x);
            minY = Math.min(minY, childBounds.y);
            maxX = Math.max(maxX, childBounds.x + childBounds.width);
            maxY = Math.max(maxY, childBounds.y + childBounds.height);
          }
        }
        
        if (hasContent) {
          const newX = Math.min(participantBounds.x, minX - PARTICIPANT_PADDING);
          const height = (maxY - minY) + (PARTICIPANT_PADDING * 2);
          const width = Math.max(participantBounds.width, (maxX - minX) + (PARTICIPANT_PADDING * 2));
          
          result = updateShapeBounds(result, participantId, newX, currentY, width, height);
          updatedBounds.set(participantId, { shapeId: participantId, x: newX, y: currentY, width, height });
          
          // Update lane bounds to be within this participant
          for (const [laneId] of laneChildren.entries()) {
            if (laneToParticipant.get(laneId) !== participantId) continue;
            const laneBounds = updatedBounds.get(laneId);
            if (laneBounds) {
              const laneY = currentY + LANE_PADDING;
              const laneHeight = height - (LANE_PADDING * 2);
              result = updateShapeBounds(result, laneId, laneBounds.x, laneY, laneBounds.width, laneHeight);
              updatedBounds.set(laneId, { ...laneBounds, y: laneY, height: laneHeight });
            }
          }
          
          currentY += height + 20; // 20px gap between participants
        } else {
          // No content found, give it a default height
          const height = 150;
          result = updateShapeBounds(result, participantId, participantBounds.x, currentY, participantBounds.width, height);
          currentY += height + 20;
        }
      }
    } else {
      // Non-overlapping: just ensure each participant encompasses its content
      for (const [participantId] of participantEntries) {
        const participantBounds = updatedBounds.get(participantId);
        if (!participantBounds) continue;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasContent = false;
        
        // Check lanes belonging to this participant
        for (const [laneId] of laneChildren.entries()) {
          const laneBounds = updatedBounds.get(laneId);
          if (!laneBounds) continue;
          hasContent = true;
          minX = Math.min(minX, laneBounds.x);
          minY = Math.min(minY, laneBounds.y);
          maxX = Math.max(maxX, laneBounds.x + laneBounds.width);
          maxY = Math.max(maxY, laneBounds.y + laneBounds.height);
        }
        
        // Also check all elements directly
        for (const [elemId, bounds] of updatedBounds.entries()) {
          const elemType = elementTypes.get(elemId);
          if (elemType && elemType !== "participant" && elemType !== "lane") {
            hasContent = true;
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
          }
        }
        
        if (hasContent) {
          const newX = Math.min(participantBounds.x, minX - PARTICIPANT_PADDING);
          const newY = Math.min(participantBounds.y, minY - PARTICIPANT_PADDING);
          const newRight = Math.max(participantBounds.x + participantBounds.width, maxX + PARTICIPANT_PADDING);
          const newBottom = Math.max(participantBounds.y + participantBounds.height, maxY + PARTICIPANT_PADDING);
          
          result = updateShapeBounds(result, participantId, newX, newY, newRight - newX, newBottom - newY);
        }
      }
    }
    
    console.log(`[DI Normalizer] Processed ${shapes.length} shapes, ${laneChildren.size} lanes, ${participantProcesses.size} participants`);
    return result;
  } catch (error) {
    console.error("[DI Normalizer] Error normalizing DI, returning original XML:", error);
    return xml;
  }
}

/**
 * Extract element types from BPMN process structure
 */
function extractElementTypes(xml: string): Map<string, string> {
  const types = new Map<string, string>();
  
  // Match elements with id attribute in bpmn: namespace
  const elementPattern = /<bpmn:(\w+)\s[^>]*id="([^"]+)"/g;
  let match;
  while ((match = elementPattern.exec(xml)) !== null) {
    types.set(match[2], match[1]);
  }
  
  // Also match without namespace prefix
  const noNsPattern = /<(\w+)\s[^>]*id="([^"]+)"/g;
  while ((match = noNsPattern.exec(xml)) !== null) {
    const tag = match[1];
    // Skip non-BPMN elements
    if (["definitions", "BPMNDiagram", "BPMNPlane", "BPMNShape", "BPMNEdge", "Bounds", "waypoint"].includes(tag)) continue;
    if (!types.has(match[2])) {
      types.set(match[2], tag);
    }
  }
  
  return types;
}

/**
 * Extract lane -> child element ID mappings
 */
function extractLaneChildren(xml: string): Map<string, string[]> {
  const laneChildren = new Map<string, string[]>();
  
  // Match lane elements with flowNodeRef children
  const lanePattern = /<bpmn:lane\s[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/bpmn:lane>/g;
  let laneMatch;
  while ((laneMatch = lanePattern.exec(xml)) !== null) {
    const laneId = laneMatch[1];
    const laneContent = laneMatch[2];
    const children: string[] = [];
    
    const refPattern = /<bpmn:flowNodeRef>([^<]+)<\/bpmn:flowNodeRef>/g;
    let refMatch;
    while ((refMatch = refPattern.exec(laneContent)) !== null) {
      children.push(refMatch[1].trim());
    }
    
    laneChildren.set(laneId, children);
  }
  
  // Also try without namespace
  const lanePattern2 = /<lane\s[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/lane>/g;
  while ((laneMatch = lanePattern2.exec(xml)) !== null) {
    const laneId = laneMatch[1];
    if (laneChildren.has(laneId)) continue;
    const laneContent = laneMatch[2];
    const children: string[] = [];
    
    const refPattern = /<flowNodeRef>([^<]+)<\/flowNodeRef>/g;
    let refMatch;
    while ((refMatch = refPattern.exec(laneContent)) !== null) {
      children.push(refMatch[1].trim());
    }
    
    laneChildren.set(laneId, children);
  }
  
  return laneChildren;
}

/**
 * Extract participant -> process ID mappings
 */
function extractParticipantProcesses(xml: string): Map<string, string> {
  const mapping = new Map<string, string>();
  
  const pattern = /<bpmn:participant\s[^>]*id="([^"]+)"[^>]*processRef="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    mapping.set(match[1], match[2]);
  }
  
  // Without namespace
  const pattern2 = /<participant\s[^>]*id="([^"]+)"[^>]*processRef="([^"]+)"/g;
  while ((match = pattern2.exec(xml)) !== null) {
    if (!mapping.has(match[1])) {
      mapping.set(match[1], match[2]);
    }
  }
  
  return mapping;
}

/**
 * Parse all BPMNShape elements and their bounds
 */
function parseBpmnShapes(xml: string): BoundsInfo[] {
  const shapes: BoundsInfo[] = [];
  
  // Match BPMNShape with nested Bounds
  const shapePattern = /<bpmndi:BPMNShape[^>]*bpmnElement="([^"]+)"[^>]*>[\s\S]*?<dc:Bounds\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/g;
  let match;
  while ((match = shapePattern.exec(xml)) !== null) {
    shapes.push({
      shapeId: match[1],
      x: parseFloat(match[2]) || 0,
      y: parseFloat(match[3]) || 0,
      width: parseFloat(match[4]) || 0,
      height: parseFloat(match[5]) || 0,
    });
  }
  
  return shapes;
}

/**
 * Update bounds for a specific BPMNShape in the XML
 */
function updateShapeBounds(
  xml: string,
  elementId: string,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  // Find the BPMNShape for this element and replace its Bounds
  const pattern = new RegExp(
    `(<bpmndi:BPMNShape[^>]*bpmnElement="${escapeRegex(elementId)}"[^>]*>[\\s\\S]*?<dc:Bounds\\s+)x="[^"]*"\\s+y="[^"]*"\\s+width="[^"]*"\\s+height="[^"]*"`,
    "g"
  );
  
  return xml.replace(pattern, `$1x="${x}" y="${y}" width="${width}" height="${height}"`);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
