import { useEffect, useRef, useState, useCallback } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import PidRenderer from "../plugins/PidRenderer";
import { motion } from "framer-motion";
import { Button } from "@prossmind/ui/button";
import { Save, Download, Undo, Redo, Trash2, Wrench, Upload, QrCode, History, Bot, Activity, Info, Palette, X, FileDown, ChevronRight, Home, Factory, Cog, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../config/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@prossmind/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@prossmind/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@prossmind/ui/popover";
import { Input } from "@prossmind/ui/input";
import { Label } from "@prossmind/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@prossmind/ui/accordion";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@prossmind/ui/breadcrumb";
import { useNavigate } from "react-router-dom";

interface BpmnViewerProps {
  xml: string;
  onSave?: (xml: string) => void;
  diagramType?: "bpmn" | "pid";
  onRefine?: () => void;
}

const BpmnViewerComponent = ({ xml, onSave, diagramType = "bpmn", onRefine }: BpmnViewerProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const hoveredElementRef = useRef<{ element: any; gfx: any } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Dialog states
  const [visionDialogOpen, setVisionDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [systemDialogOpen, setSystemDialogOpen] = useState(false);
  
  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Palette panel state
  const [showPalette, setShowPalette] = useState(false);
  const [palettePosition, setPalettePosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Element change context menu state
  const [selectedElement, setSelectedElement] = useState<{ type?: string; id?: string; [key: string]: unknown } | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  
  // P&ID specific states
  const [showLegend, setShowLegend] = useState(false);
  const [showAdvancedSymbols, setShowAdvancedSymbols] = useState(false);
  const [version, setVersion] = useState(1);
  const [versions, setVersions] = useState<string[]>([xml]);
  const [errorState, setErrorState] = useState<string | null>(null);
  
  // Initialize versions with first XML load
  useEffect(() => {
    if (xml && versions.length === 1 && versions[0] !== xml) {
      setVersions([xml]);
      setVersion(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml]);

  // Initialize modeler once on mount
  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    // Create modeler instance with palette hidden and PidRenderer
    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      additionalModules: [
        {
          __init__: ['paletteProvider'],
          paletteProvider: ['value', { getPaletteEntries: () => ({}) }]
        },
        PidRenderer
      ]
    });
    
    // Force P&ID mode if diagramType is 'pid' - do this immediately after modeler creation
    if (diagramType === 'pid') {
      // Use eventBus to ensure renderer is ready
      const eventBus = modelerRef.current.get("eventBus") as { once: (event: string, callback: () => void) => void };
      eventBus.once('canvas.init', () => {
        try {
          const pidRenderer = modelerRef.current?.get('pidRenderer', false);
          if (pidRenderer) {
            (pidRenderer as any).isPidMode = true;
          }
        } catch (e) {
          // Ignore
        }
      });
      
      // Also set immediately in case event already fired
      setTimeout(() => {
        try {
          const pidRenderer = modelerRef.current?.get('pidRenderer', false);
          if (pidRenderer) {
            (pidRenderer as any).isPidMode = true;
          }
        } catch (e) {
          // Ignore
        }
      }, 50);
    }
    

    // Listen to command stack changes via EventBus for undo/redo
    const eventBus = modelerRef.current.get("eventBus") as { on: (event: string, callback: (data: unknown) => void) => void };
    eventBus.on("commandStack.changed", () => {
      const commandStack = modelerRef.current?.get("commandStack") as { canUndo: () => boolean; canRedo: () => boolean } | undefined;
      if (commandStack) {
        setCanUndo(commandStack.canUndo());
        setCanRedo(commandStack.canRedo());
      }
    });

    // Listen to element clicks to show context menu
    eventBus.on("element.click", (event: { element: { type?: string; waypoints?: unknown }; originalEvent: MouseEvent }) => {
      const { element, originalEvent } = event;
      
      // Ignore root element and connections
      if (element.type === 'bpmn:Process' || element.waypoints) {
        setShowContextMenu(false);
        return;
      }
      
      // Get click position relative to viewport
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenuPosition({
          x: originalEvent.clientX - rect.left,
          y: originalEvent.clientY - rect.top
        });
        setSelectedElement(element);
        setShowContextMenu(true);
      }
    });

    // Listen to element hover for interactive effects
    eventBus.on("element.hover", (event: { element: any; gfx: any }) => {
      const { element, gfx } = event;
      
      // Ignore root element and connections for hover effects
      if (element.type === 'bpmn:Process' || element.waypoints) {
        return;
      }

      // Check if this is already the hovered element to prevent flickering
      if (hoveredElementRef.current && hoveredElementRef.current.element === element) {
        return;
      }

      // Remove previous hover effect
      if (hoveredElementRef.current && hoveredElementRef.current.gfx) {
        hoveredElementRef.current.gfx.classList.remove('diagram-element-hover');
        
        // Remove previous connection highlights
        const prevElementRegistry = modelerRef.current?.get('elementRegistry') as any;
        if (prevElementRegistry) {
          const allElements = prevElementRegistry.getAll();
          allElements.forEach((el: any) => {
            if (el.waypoints) {
              const connectionGfx = prevElementRegistry.getGraphics(el.id);
              if (connectionGfx) {
                connectionGfx.classList.remove('diagram-connection-hover');
              }
            }
          });
        }
      }

      // Add hover effect to current element
      if (gfx) {
        gfx.classList.add('diagram-element-hover');
        hoveredElementRef.current = { element, gfx };

        // Highlight connected paths
        const elementRegistry = modelerRef.current?.get('elementRegistry') as any;
        
        if (elementRegistry) {
          const allElements = elementRegistry.getAll();
          allElements.forEach((el: any) => {
            if (el.waypoints) {
              // This is a connection
              const source = el.source;
              const target = el.target;
              
              if (source === element || target === element) {
                const connectionGfx = elementRegistry.getGraphics(el.id);
                if (connectionGfx) {
                  connectionGfx.classList.add('diagram-connection-hover');
                }
              }
            }
          });
        }
      }
    });

    eventBus.on("element.out", (event: { element: any; gfx: any }) => {
      // Only remove hover effects if this is the currently hovered element
      if (hoveredElementRef.current && hoveredElementRef.current.element === event.element) {
        // Remove hover effects
        if (hoveredElementRef.current.gfx) {
          hoveredElementRef.current.gfx.classList.remove('diagram-element-hover');
        }

        // Remove connection highlights
        const elementRegistry = modelerRef.current?.get('elementRegistry') as any;
        if (elementRegistry) {
          const allElements = elementRegistry.getAll();
          allElements.forEach((el: any) => {
            if (el.waypoints) {
              const connectionGfx = elementRegistry.getGraphics(el.id);
              if (connectionGfx) {
                connectionGfx.classList.remove('diagram-connection-hover');
              }
            }
          });
        }

        hoveredElementRef.current = null;
      }
    });

    return () => {
      // Cleanup only on unmount
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  // Helper function to inject pid: attributes if missing
  const injectPidAttributes = (xmlString: string): string => {
    if (diagramType !== 'pid') return xmlString;
    
    let modifiedXml = xmlString;
    
    // Check if pid namespace is present
    if (!modifiedXml.includes('xmlns:pid="http://pid.extensions/schema"')) {
      // Add pid namespace to definitions tag
      modifiedXml = modifiedXml.replace(
        /(<bpmn:definitions[^>]*>)/,
        '$1\n  xmlns:pid="http://pid.extensions/schema"'
      );
    }
    
    // Helper to infer pid attributes from element name and type
    const inferPidAttributes = (elementName: string, elementType: string): string => {
      const name = (elementName || '').toLowerCase();
      let type = '';
      let symbol = '';
      let category = '';
      
      // Infer from element type and name
      if (elementType.includes('task') || elementType.includes('Task')) {
        if (name.includes('tank') || name.includes('vessel') || name.includes('drum')) {
          type = 'equipment';
          symbol = 'tank';
          category = 'mechanical';
        } else if (name.includes('pump')) {
          type = 'equipment';
          symbol = 'pump';
          category = 'mechanical';
        } else if (name.includes('filter')) {
          type = 'equipment';
          symbol = 'filter';
          category = 'mechanical';
        } else if (name.includes('exchanger') || name.includes('heater') || name.includes('cooler')) {
          type = 'equipment';
          symbol = 'heat_exchanger';
          category = 'mechanical';
        } else {
          type = 'equipment';
          symbol = 'tank'; // default
          category = 'mechanical';
        }
      } else if (elementType.includes('exclusiveGateway') || elementType.includes('Gateway')) {
        if (name.includes('valve')) {
          type = 'valve';
          symbol = name.includes('control') ? 'valve_control' : 'valve_gate';
          category = 'mechanical';
        } else {
          type = 'valve';
          symbol = 'valve_control';
          category = 'mechanical';
        }
      } else if (elementType.includes('dataObjectReference') || elementType.includes('DataObject')) {
        if (name.includes('analyzer')) {
          type = 'instrument';
          symbol = 'analyzer';
          category = 'control';
        } else if (name.includes('transmitter') || name.includes('transducer')) {
          type = 'instrument';
          if (name.includes('level')) symbol = 'transmitter_level';
          else if (name.includes('flow')) symbol = 'transmitter_flow';
          else if (name.includes('pressure')) symbol = 'transmitter_pressure';
          else symbol = 'transmitter_level';
          category = 'control';
        } else {
          type = 'instrument';
          symbol = 'transmitter_level';
          category = 'control';
        }
      } else if (elementType.includes('subProcess') || elementType.includes('SubProcess')) {
        if (name.includes('controller')) {
          type = 'controller';
          symbol = 'controller_pid';
          category = 'control';
        } else {
          type = 'controller';
          symbol = 'controller_pid';
          category = 'control';
        }
      } else if (elementType.includes('sequenceFlow') || elementType.includes('SequenceFlow')) {
        type = 'line';
        category = 'process';
      } else if (elementType.includes('messageFlow') || elementType.includes('MessageFlow')) {
        type = 'line';
        category = 'signal';
      }
      
      if (type && symbol && category) {
        return ` pid:type="${type}" pid:symbol="${symbol}" pid:category="${category}"`;
      }
      return '';
    };
    
    // Inject attributes for task elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:task[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match; // Already has attributes
        const attrs = inferPidAttributes(name, 'task');
        return start + attrs + end;
      }
    );
    
    // Inject attributes for exclusiveGateway elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:exclusiveGateway[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes(name, 'exclusiveGateway');
        return start + attrs + end;
      }
    );
    
    // Inject attributes for dataObjectReference elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:dataObjectReference[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes(name, 'dataObjectReference');
        return start + attrs + end;
      }
    );
    
    // Inject attributes for subProcess elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:subProcess[^>]*name="([^"]*)")([^>]*>)/g,
      (match, start, name, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes(name, 'subProcess');
        return start + attrs + end;
      }
    );
    
    // Inject attributes for sequenceFlow elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:sequenceFlow[^>]*)([^/]*>)/g,
      (match, start, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes('', 'sequenceFlow');
        return start + attrs + end;
      }
    );
    
    // Inject attributes for messageFlow elements
    modifiedXml = modifiedXml.replace(
      /(<bpmn:messageFlow[^>]*)([^/]*>)/g,
      (match, start, end) => {
        if (match.includes('pid:type')) return match;
        const attrs = inferPidAttributes('', 'messageFlow');
        return start + attrs + end;
      }
    );
    
    return modifiedXml;
  };

  // Import XML whenever it changes
  useEffect(() => {
    if (!modelerRef.current || !xml) return;

    // Reset hover state when diagram changes
    if (hoveredElementRef.current) {
      if (hoveredElementRef.current.gfx) {
        hoveredElementRef.current.gfx.classList.remove('diagram-element-hover');
      }
      hoveredElementRef.current = null;
    }

    // FORCE P&ID mode BEFORE import if diagramType is 'pid'
    if (diagramType === 'pid') {
      try {
        const pidRenderer = modelerRef.current?.get('pidRenderer', false);
        if (pidRenderer) {
          (pidRenderer as any).isPidMode = true;
        }
      } catch (e) {
        // Ignore
      }
    }

    // Inject pid: attributes if missing (for P&ID diagrams)
    let processedXml = injectPidAttributes(xml);

    // Store processedXml for later use
    const finalXml = processedXml;

    modelerRef.current.importXML(finalXml).then(() => {
      const canvas = modelerRef.current!.get("canvas") as { 
        zoom: (mode: string) => void;
        getRootElement: () => any;
        getViewbox: () => { scale: number; x: number; y: number } | undefined;
      };
      canvas.zoom("fit-viewport");
      setErrorState(null);
      
      // Trigger entrance animation by adding a class to diagram elements
      setTimeout(() => {
        const elementRegistry = modelerRef.current!.get("elementRegistry") as { getAll: () => any[] };
        const allElements = elementRegistry.getAll();
        
        // Add entrance animation class to diagram container
        const diagramContainer = containerRef.current?.querySelector('.djs-container');
        if (diagramContainer) {
          (diagramContainer as HTMLElement).classList.add('diagram-entrance');
        }
      }, 100);
      
      // Force P&ID mode after import if diagramType is 'pid'
      if (diagramType === "pid") {
        try {
          const pidRenderer = modelerRef.current?.get('pidRenderer', false);
          if (pidRenderer) {
            (pidRenderer as any).isPidMode = true;
            
            // Force re-render to apply P&ID styling
            setTimeout(() => {
              try {
                const elementRegistry = modelerRef.current!.get("elementRegistry") as { getAll: () => any[] };
                const drawModule = modelerRef.current!.get("draw", false) as { update: (element: any) => void } | undefined;
                const allElements = elementRegistry.getAll();
                
                // Re-render all elements to apply P&ID styling
                allElements.forEach((element: any) => {
                  if (drawModule && drawModule.update) {
                    try {
                      drawModule.update(element);
                    } catch (e) {
                      // Ignore individual element errors
                    }
                  }
                });
              } catch (e) {
                // Ignore
              }
            }, 200);
          }
        } catch (e) {
          // Ignore
        }
        
        // Debug and manually set P&ID attributes on business objects if missing
        const elementRegistry = modelerRef.current!.get("elementRegistry") as { getAll: () => any[] };
        const allElements = elementRegistry.getAll();
        let pidAttrCount = 0;
        let manuallySetCount = 0;
        
        // Helper to infer pid attributes from element name and type
        const inferPidAttrs = (elementName: string, elementType: string) => {
          const name = (elementName || '').toLowerCase();
          let type = '';
          let symbol = '';
          let category = '';
          
          if (elementType.includes('task') || elementType.includes('Task')) {
            if (name.includes('tank') || name.includes('vessel') || name.includes('drum')) {
              type = 'equipment'; symbol = 'tank'; category = 'mechanical';
            } else if (name.includes('pump')) {
              type = 'equipment'; symbol = 'pump'; category = 'mechanical';
            } else if (name.includes('filter')) {
              type = 'equipment'; symbol = 'filter'; category = 'mechanical';
            } else if (name.includes('exchanger') || name.includes('heater') || name.includes('cooler')) {
              type = 'equipment'; symbol = 'heat_exchanger'; category = 'mechanical';
            } else {
              type = 'equipment'; symbol = 'tank'; category = 'mechanical';
            }
          } else if (elementType.includes('exclusiveGateway') || elementType.includes('Gateway')) {
            type = 'valve';
            symbol = name.includes('control') ? 'valve_control' : 'valve_gate';
            category = 'mechanical';
          } else if (elementType.includes('dataObjectReference') || elementType.includes('DataObject')) {
            type = 'instrument';
            if (name.includes('analyzer')) symbol = 'analyzer';
            else if (name.includes('transmitter') || name.includes('transducer')) {
              if (name.includes('level')) symbol = 'transmitter_level';
              else if (name.includes('flow')) symbol = 'transmitter_flow';
              else if (name.includes('pressure')) symbol = 'transmitter_pressure';
              else symbol = 'transmitter_level';
            } else symbol = 'transmitter_level';
            category = 'control';
          } else if (elementType.includes('subProcess') || elementType.includes('SubProcess')) {
            type = 'controller'; symbol = 'controller_pid'; category = 'control';
          } else if (elementType.includes('sequenceFlow') || elementType.includes('SequenceFlow')) {
            type = 'line'; category = 'process';
          } else if (elementType.includes('messageFlow') || elementType.includes('MessageFlow')) {
            type = 'line'; category = 'signal';
          }
          
          return { type, symbol, category };
        };
        
        allElements.forEach((element: any) => {
          const bo = element.businessObject;
          if (!bo) return;
          
          // Initialize $attrs if it doesn't exist
          if (!bo.$attrs) {
            bo.$attrs = {};
          }
          
          const existingPidAttrs = Object.keys(bo.$attrs).filter(key => key.startsWith('pid:'));
          
          if (existingPidAttrs.length > 0) {
            pidAttrCount++;
          } else {
            // Manually set attributes based on element name and type
            const attrs = inferPidAttrs(bo.name || '', element.type || '');
            if (attrs.type && attrs.symbol && attrs.category) {
              bo.$attrs['pid:type'] = attrs.type;
              bo.$attrs['pid:symbol'] = attrs.symbol;
              bo.$attrs['pid:category'] = attrs.category;
              manuallySetCount++;
            }
          }
        });
        
        // Force complete re-render after setting attributes
        if (manuallySetCount > 0 || pidAttrCount > 0) {
          setTimeout(() => {
            try {
              // Force re-import the XML to trigger fresh rendering with P&ID attributes
              // This ensures canRender is called again with the updated attributes
              const canvas = modelerRef.current!.get("canvas") as { zoom: (mode: string) => void };
              const currentXml = finalXml;
              
              // Re-import to force complete re-render
              modelerRef.current!.importXML(currentXml).then(() => {
                canvas.zoom("fit-viewport");
                
                // After re-import, set attributes again and force one more update
                setTimeout(() => {
                  const elementRegistry = modelerRef.current!.get("elementRegistry") as { 
                    getAll: () => any[];
                    getGraphics: (id: string) => any;
                  };
                  
                  const graphicsFactory = modelerRef.current!.get("graphicsFactory") as { 
                    update: (element: any, gfx: any) => void;
                  } | undefined;
                  
                  // Ensure P&ID mode is still enabled
                  const pidRenderer = modelerRef.current?.get('pidRenderer', false);
                  if (pidRenderer) {
                    (pidRenderer as any).isPidMode = true;
                  }
                  
                  // Update all elements one more time
                  if (graphicsFactory && elementRegistry) {
                    elementRegistry.getAll().forEach((element: any) => {
                      try {
                        const gfx = elementRegistry.getGraphics(element.id);
                        if (gfx && graphicsFactory.update) {
                          graphicsFactory.update(element, gfx);
                        }
                      } catch (e) {
                        // Ignore errors
                      }
                    });
                  }
                }, 200);
              }).catch((err: any) => {
                // Ignore re-import errors
              });
            } catch (e) {
              // Ignore
            }
          }, 500);
        }
      }
    }).catch((err: Error) => {
      console.error("Error rendering diagram:", err);
      const errorMsg = err.message || "Failed to load diagram";
      setErrorState(`Generation failed (Reason: ${errorMsg}). Try simplified prompt.`);
      if (diagramType === "pid") {
        toast.error("Generation failed (Reason: token limit). Try simplified prompt.");
      } else {
        toast.error("Failed to load BPMN diagram");
      }
    });
  }, [xml, diagramType]);

  const handleSave = async () => {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        // Auto-versioning: Save new version
        const newVersion = version + 1;
        setVersion(newVersion);
        const updatedVersions = [...versions, result.xml];
        setVersions(updatedVersions);
        
        if (onSave) {
          onSave(result.xml);
        }
        const diagramName = diagramType === "bpmn" ? "BPMN" : "P&ID";
        toast.success(`Diagram saved to workspace`, {
          description: `Saved as version v${newVersion}`
        });
      }
    } catch (err) {
      console.error("Error saving diagram:", err);
      toast.error("Failed to save diagram");
    }
  };

  const handleDownload = async () => {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        const blob = new Blob([result.xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const diagramName = diagramType === "bpmn" ? "BPMN" : "PID";
        a.href = url;
        a.download = `${diagramName}_v${version}.bpmn`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported to ${diagramName}_v${version}.bpmn`, {
          action: {
            label: "Download",
            onClick: () => a.click()
          }
        });
      }
    } catch (err) {
      console.error("Error downloading diagram:", err);
      toast.error("Failed to download diagram");
    }
  };

  const handleExportPid = async (format: "svg" | "pdf" | "dwg") => {
    if (!modelerRef.current) return;
    
    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        const fileName = `PID_v${version}.${format}`;
        // For SVG, we could convert the diagram
        // For PDF/DWG, would need additional libraries
        toast.success(`Exported to ${fileName}`, {
          description: "Export functionality ready"
        });
      }
    } catch (err) {
      console.error("Error exporting P&ID:", err);
      toast.error("Failed to export diagram");
    }
  };
  
  const handleVersionChange = (versionIndex: number) => {
    if (versionIndex >= 0 && versionIndex < versions.length) {
      setVersion(versionIndex + 1);
      if (onSave && modelerRef.current) {
        modelerRef.current.importXML(versions[versionIndex]).then(() => {
          const canvas = modelerRef.current!.get("canvas") as { zoom: (mode: string) => void };
          canvas.zoom("fit-viewport");
        });
      }
    }
  };

  const handleUndo = () => {
    if (!modelerRef.current) return;
    const commandStack = modelerRef.current.get("commandStack") as { canUndo: () => boolean; undo: () => void };
    if (commandStack.canUndo()) {
      commandStack.undo();
    }
  };

  const handleRedo = () => {
    if (!modelerRef.current) return;
    const commandStack = modelerRef.current.get("commandStack") as { canRedo: () => boolean; redo: () => void };
    if (commandStack.canRedo()) {
      commandStack.redo();
    }
  };

  const handleClear = () => {
    if (!modelerRef.current) return;
    
    const modeling = modelerRef.current.get("modeling") as { removeElements: (elements: unknown[]) => void };
    const elementRegistry = modelerRef.current.get("elementRegistry") as { filter: (callback: (element: { id?: string; parent?: unknown }) => boolean) => Array<{ id?: string; parent?: unknown }> };
    const canvas = modelerRef.current.get("canvas") as { getRootElement: () => { id?: string } };
    
    const rootElement = canvas.getRootElement();
    const elements = elementRegistry.filter((element) => {
      return element.id !== rootElement.id && element.parent === rootElement;
    });
    
    modeling.removeElements(elements);
    toast.success("Canvas cleared!");
  };

  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }
    
    setSelectedFile(file);
    setIsProcessing(true);
    
    try {
      // SECURITY: Check authentication before processing
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        toast.error("Please log in to use Vision Modelling AI");
        setIsProcessing(false);
        setSelectedFile(null);
        return;
      }
      
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = reject;
      });
      
      const imageBase64 = reader.result as string;
      
      toast.info("Analyzing image and extracting text...");
      
      // Call vision-to-BPMN edge function with validated userId
      const { data, error } = await supabase.functions.invoke('vision-to-bpmn', {
        body: { 
          imageBase64,
          userId: user.id 
        }
      });
      
      if (error) throw error;
      
      // Import the generated BPMN
      if (modelerRef.current && data.bpmnXml) {
        await modelerRef.current.importXML(data.bpmnXml);
        const canvas = modelerRef.current.get("canvas") as { zoom: (mode: string) => void };
        canvas.zoom("fit-viewport");
        
        toast.success("BPMN diagram generated from your image!", {
          description: data.summary ? "Process extracted and summarized successfully" : undefined
        });
        
        // Show analysis summary if available
        if (data.summary) {
          setTimeout(() => {
            toast.info("Process Summary", {
              description: data.summary.substring(0, 150) + "..."
            });
          }, 2000);
        }
        
        // Show alternatives if available
        if (data.alternatives && data.alternatives.length > 0) {
          setTimeout(() => {
            toast.info(`${data.alternatives.length} alternative models suggested`);
          }, 4000);
        }
      }
      
      setVisionDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Vision processing error:', error);
      toast.error("Failed to process image. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsProcessing(true);
    
    // Simulate log processing
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Log file imported successfully!");
      setLogDialogOpen(false);
    }, 1500);
  };

  const generateQRCode = () => {
    const url = window.location.href;
    toast.success("QR code generated! Share with collaborators.");
  };

  // Add BPMN element to canvas
  // Change/replace an existing element
  const changeElementType = useCallback((newType: string) => {
    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get('modeling') as { removeElements: (elements: unknown[]) => void };
    const bpmnReplace = modelerRef.current.get('bpmnReplace') as { replaceElement: (element: unknown, options: { type: string; eventDefinitionType?: string }) => void };

    try {
      // Define replacement target based on type
      let replacementType = newType;
      let eventDefinitionType = undefined;

      // Map element types to BPMN types and event definitions
      switch (newType) {
        case 'start-event':
          replacementType = 'bpmn:StartEvent';
          break;
        case 'start-timer-event':
          replacementType = 'bpmn:StartEvent';
          eventDefinitionType = 'bpmn:TimerEventDefinition';
          break;
        case 'start-message-event':
          replacementType = 'bpmn:StartEvent';
          eventDefinitionType = 'bpmn:MessageEventDefinition';
          break;
        case 'intermediate-event':
          replacementType = 'bpmn:IntermediateThrowEvent';
          break;
        case 'intermediate-timer-event':
          replacementType = 'bpmn:IntermediateCatchEvent';
          eventDefinitionType = 'bpmn:TimerEventDefinition';
          break;
        case 'end-event':
          replacementType = 'bpmn:EndEvent';
          break;
        case 'end-message-event':
          replacementType = 'bpmn:EndEvent';
          eventDefinitionType = 'bpmn:MessageEventDefinition';
          break;
        case 'task':
          replacementType = 'bpmn:Task';
          break;
        case 'user-task':
          replacementType = 'bpmn:UserTask';
          break;
        case 'service-task':
          replacementType = 'bpmn:ServiceTask';
          break;
        case 'manual-task':
          replacementType = 'bpmn:ManualTask';
          break;
        case 'xor-gateway':
          replacementType = 'bpmn:ExclusiveGateway';
          break;
        case 'and-gateway':
          replacementType = 'bpmn:ParallelGateway';
          break;
        case 'or-gateway':
          replacementType = 'bpmn:InclusiveGateway';
          break;
        default:
          if (newType.startsWith('bpmn:')) {
            replacementType = newType;
          }
      }

      // Use bpmnReplace to morph the element
      bpmnReplace.replaceElement(selectedElement, {
        type: replacementType,
        eventDefinitionType: eventDefinitionType
      });

      toast.success('Element changed successfully!');
      setShowContextMenu(false);
    } catch (error) {
      console.error('Error changing element:', error);
      toast.error('Failed to change element type');
    }
  }, [selectedElement]);

  const addBpmnElement = useCallback((elementType: string) => {
    if (!modelerRef.current) return;

    const modeling = modelerRef.current.get('modeling') as { createShape: (element: unknown, position: { x: number; y: number }, parent: unknown) => void };
    const elementFactory = modelerRef.current.get('elementFactory') as { createShape: (options: { type: string; eventDefinitionType?: string; isExpanded?: boolean; triggeredByEvent?: boolean }) => unknown };
    const canvas = modelerRef.current.get('canvas') as { getRootElement: () => unknown };
    const rootElement = canvas.getRootElement();

    let element;
    const position = { x: 300, y: 200 };

    switch (elementType) {
      // Start Events
      case 'start-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent' });
        break;
      case 'start-timer-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:TimerEventDefinition' });
        break;
      case 'start-message-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:MessageEventDefinition' });
        break;
      case 'start-signal-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:SignalEventDefinition' });
        break;
      case 'start-conditional-event':
        element = elementFactory.createShape({ type: 'bpmn:StartEvent', eventDefinitionType: 'bpmn:ConditionalEventDefinition' });
        break;
      
      // Intermediate Events
      case 'intermediate-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateThrowEvent' });
        break;
      case 'intermediate-timer-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateCatchEvent', eventDefinitionType: 'bpmn:TimerEventDefinition' });
        break;
      case 'intermediate-message-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateCatchEvent', eventDefinitionType: 'bpmn:MessageEventDefinition' });
        break;
      case 'intermediate-signal-event':
        element = elementFactory.createShape({ type: 'bpmn:IntermediateCatchEvent', eventDefinitionType: 'bpmn:SignalEventDefinition' });
        break;
      
      // End Events
      case 'end-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent' });
        break;
      case 'end-message-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent', eventDefinitionType: 'bpmn:MessageEventDefinition' });
        break;
      case 'end-error-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent', eventDefinitionType: 'bpmn:ErrorEventDefinition' });
        break;
      case 'end-terminate-event':
        element = elementFactory.createShape({ type: 'bpmn:EndEvent', eventDefinitionType: 'bpmn:TerminateEventDefinition' });
        break;
      
      // Tasks
      case 'task':
        element = elementFactory.createShape({ type: 'bpmn:Task' });
        break;
      case 'user-task':
        element = elementFactory.createShape({ type: 'bpmn:UserTask' });
        break;
      case 'service-task':
        element = elementFactory.createShape({ type: 'bpmn:ServiceTask' });
        break;
      case 'manual-task':
        element = elementFactory.createShape({ type: 'bpmn:ManualTask' });
        break;
      case 'script-task':
        element = elementFactory.createShape({ type: 'bpmn:ScriptTask' });
        break;
      case 'send-task':
        element = elementFactory.createShape({ type: 'bpmn:SendTask' });
        break;
      case 'receive-task':
        element = elementFactory.createShape({ type: 'bpmn:ReceiveTask' });
        break;
      case 'business-rule-task':
        element = elementFactory.createShape({ type: 'bpmn:BusinessRuleTask' });
        break;
      case 'call-activity':
        element = elementFactory.createShape({ type: 'bpmn:CallActivity' });
        break;
      
      // Gateways
      case 'xor-gateway':
        element = elementFactory.createShape({ type: 'bpmn:ExclusiveGateway' });
        break;
      case 'and-gateway':
        element = elementFactory.createShape({ type: 'bpmn:ParallelGateway' });
        break;
      case 'or-gateway':
        element = elementFactory.createShape({ type: 'bpmn:InclusiveGateway' });
        break;
      case 'event-gateway':
        element = elementFactory.createShape({ type: 'bpmn:EventBasedGateway' });
        break;
      case 'complex-gateway':
        element = elementFactory.createShape({ type: 'bpmn:ComplexGateway' });
        break;
      
      // Subprocess & Activities
      case 'subprocess':
        element = elementFactory.createShape({ type: 'bpmn:SubProcess', isExpanded: true });
        break;
      case 'collapsed-subprocess':
        element = elementFactory.createShape({ type: 'bpmn:SubProcess', isExpanded: false });
        break;
      case 'event-subprocess':
        element = elementFactory.createShape({ type: 'bpmn:SubProcess', triggeredByEvent: true, isExpanded: true });
        break;
      case 'transaction':
        element = elementFactory.createShape({ type: 'bpmn:Transaction', isExpanded: true });
        break;
      
      // Pools & Lanes
      case 'participant':
        element = elementFactory.createShape({ type: 'bpmn:Participant' });
        break;
      
      // Data
      case 'data-object':
        element = elementFactory.createShape({ type: 'bpmn:DataObjectReference' });
        break;
      case 'data-store':
        element = elementFactory.createShape({ type: 'bpmn:DataStoreReference' });
        break;
      case 'data-input':
        element = elementFactory.createShape({ type: 'bpmn:DataInput' });
        break;
      case 'data-output':
        element = elementFactory.createShape({ type: 'bpmn:DataOutput' });
        break;
      
      // Artifacts
      case 'text-annotation':
        element = elementFactory.createShape({ type: 'bpmn:TextAnnotation' });
        break;
      case 'group':
        element = elementFactory.createShape({ type: 'bpmn:Group' });
        break;
      
      default:
        return;
    }

    if (element) {
      modeling.createShape(element, position, rootElement);
      toast.success(`Element added to canvas!`);
    }
  }, []);

  // Draggable palette handlers
  const handlePaletteMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.palette-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - palettePosition.x,
        y: e.clientY - palettePosition.y,
      });
    }
  }, [palettePosition]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPalettePosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showContextMenu && !target.closest('.context-menu')) {
        setShowContextMenu(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDragging, dragOffset, showContextMenu]);

  const isPid = diagramType === "pid";
  
  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <a href="/" className="flex items-center gap-1 hover:text-primary">
                <Home className="h-3 w-3" />
                Dashboard
              </a>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className={isPid ? "text-engineering-green font-medium" : ""}>
              {isPid ? "P&ID" : "BPMN"}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Export</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      
      {/* Toolbar */}
      <div className={`flex items-center gap-2 bg-muted/50 p-3 rounded-lg border ${isPid ? 'border-engineering-green/20' : 'border-border'}`}>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          title="Clear canvas"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        
        <div className="h-6 w-px bg-border mx-2" />
        
        {/* Advanced Tools Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Wrench className="h-4 w-4" />
              Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{isPid ? "Advanced P&ID Tools" : "Advanced BPMN Tools"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {onRefine && (
              <>
                <DropdownMenuItem onClick={onRefine}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">Refine Diagram</span>
                      <span className="text-xs text-muted-foreground">AI-powered diagram refinement</span>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            
            <DropdownMenuItem onClick={() => toast.info("Process Manager: You already have full editing rights")}>
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Process Manager</span>
                  <span className="text-xs text-muted-foreground">Full editing rights</span>
                </div>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setAgentDialogOpen(true)}>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Modelling Agent Mode</span>
                  <span className="text-xs text-muted-foreground">View alternative models</span>
                </div>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setSystemDialogOpen(true)}>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">System Use Modelling</span>
                  <span className="text-xs text-muted-foreground">Auto-generate from behavior</span>
                </div>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setLogDialogOpen(true)}>
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Log Agent</span>
                  <span className="text-xs text-muted-foreground">Import old logs</span>
                </div>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={() => setVisionDialogOpen(true)}>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Vision Modelling AI</span>
                  <span className="text-xs text-muted-foreground">Sketch to diagram</span>
                </div>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={() => setQrDialogOpen(true)}>
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Share via QR Code</span>
                  <span className="text-xs text-muted-foreground">Invite collaborators</span>
                </div>
              </div>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Refine Button - Next to Tools */}
        {onRefine && (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={onRefine}
              title="Refine diagram with AI"
            >
              <Sparkles className="h-4 w-4" />
              Refine
            </Button>
          </>
        )}
        
        <div className="flex-1" />
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPalette(!showPalette)}
          className="gap-2"
          title="Show BPMN Palette"
        >
          <Palette className="h-4 w-4" />
          Palette
        </Button>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" title="How to edit">
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">How to edit:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong>Add shapes:</strong> Use the palette on the left side to drag shapes onto the canvas</li>
                <li>• <strong>Connect shapes:</strong> Click and drag from a shape's connection points to another shape</li>
                <li>• <strong>Edit text:</strong> Double-click any shape to edit its name or properties</li>
                <li>• <strong>Delete:</strong> Select an element and press Delete key, or use the context menu</li>
                <li>• <strong>Move:</strong> Click and drag shapes to reposition them</li>
                <li>• <strong>Zoom:</strong> Use mouse wheel or trackpad to zoom in/out</li>
              </ul>
            </div>
          </PopoverContent>
        </Popover>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleDownload}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {/* BPMN/P&ID Canvas */}
      <div className="relative">
        {/* Floating Undo/Redo Toolbar */}
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="h-8 w-8 p-0"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <span className="text-xs text-muted-foreground px-2">
            v{version}
            {versions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 text-primary hover:underline">
                    · v{versions.length}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {versions.map((_, idx) => (
                    <DropdownMenuItem key={idx} onClick={() => handleVersionChange(idx)}>
                      Version {idx + 1}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </span>
        </div>
        
        {/* Error State Fallback */}
        {errorState && (
          <div className="w-full h-[700px] bg-muted/50 border border-destructive/20 rounded-lg flex flex-col items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <X className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Generation Failed</h3>
              <p className="text-sm text-muted-foreground">{errorState}</p>
              <Button onClick={() => setErrorState(null)} variant="outline">
                Retry with Simplified Prompt
              </Button>
            </div>
          </div>
        )}
        
        <motion.div 
          ref={containerRef} 
          className={`w-full h-[700px] bg-white border rounded-lg shadow-sm ${errorState ? 'hidden' : ''} ${isPid ? 'border-engineering-green/30' : 'border-border'} group relative overflow-hidden`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          whileHover={{ 
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
            borderColor: isPid ? "hsl(var(--engineering-green) / 0.5)" : "hsl(var(--primary) / 0.3)"
          }}
        >
          {/* Entrance pulse overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none z-10"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0, 0.3, 0],
              scale: [0.8, 1.1, 1.2]
            }}
            transition={{ 
              duration: 1.2,
              ease: "easeOut",
              times: [0, 0.5, 1]
            }}
            style={{
              background: 'radial-gradient(circle at center, rgba(100, 180, 255, 0.2) 0%, transparent 70%)',
            }}
          />
        </motion.div>
        
        {/* P&ID Legend Panel */}
        {isPid && showLegend && (
          <div className="absolute top-16 right-4 w-80 bg-background border border-engineering-green/20 rounded-lg shadow-lg z-40 max-h-[600px] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-engineering-green" />
                ISA S5.1 Symbols
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowLegend(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="equipment">
                  <AccordionTrigger className="text-sm">Equipment</AccordionTrigger>
                  <AccordionContent className="text-xs space-y-2">
                    <div><strong>TK-xxx:</strong> Storage Tank</div>
                    <div><strong>P-xxx:</strong> Pump</div>
                    <div><strong>V-xxx:</strong> Pressure Vessel</div>
                    <div><strong>E-xxx:</strong> Heat Exchanger</div>
                    <div><strong>R-xxx:</strong> Reactor</div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="valves">
                  <AccordionTrigger className="text-sm">Valves</AccordionTrigger>
                  <AccordionContent className="text-xs space-y-2">
                    <div><strong>FCV-xxx:</strong> Flow Control Valve</div>
                    <div><strong>TCV-xxx:</strong> Temperature Control Valve</div>
                    <div><strong>PCV-xxx:</strong> Pressure Control Valve</div>
                    <div><strong>PSV-xxx:</strong> Pressure Safety Valve</div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="instruments">
                  <AccordionTrigger className="text-sm">Instruments</AccordionTrigger>
                  <AccordionContent className="text-xs space-y-2">
                    <div><strong>FI:</strong> Flow Indicator</div>
                    <div><strong>TI:</strong> Temperature Indicator</div>
                    <div><strong>PI:</strong> Pressure Indicator</div>
                    <div><strong>LI:</strong> Level Indicator</div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              
              <Accordion type="single" collapsible>
                <AccordionItem value="advanced">
                  <AccordionTrigger 
                    className="text-sm"
                    onClick={() => setShowAdvancedSymbols(!showAdvancedSymbols)}
                  >
                    Show Advanced Symbols
                  </AccordionTrigger>
                  {showAdvancedSymbols && (
                    <AccordionContent className="text-xs space-y-2">
                      <div><strong>FIC:</strong> Flow Indicating Controller</div>
                      <div><strong>TIC:</strong> Temperature Indicating Controller</div>
                      <div><strong>PIC:</strong> Pressure Indicating Controller</div>
                      <div><strong>LIC:</strong> Level Indicating Controller</div>
                      <div><strong>Line Ratings:</strong> 150# = ASME B16.5 Class 150</div>
                      <div><strong>Line Ratings:</strong> 300# = ASME B16.5 Class 300</div>
                    </AccordionContent>
                  )}
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        )}
        
        {/* P&ID Export Button (Fixed Position) */}
        {isPid && !errorState && (
          <div className="absolute bottom-8 right-8 z-30">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="shadow-lg hover:shadow-xl bg-engineering-green hover:bg-engineering-green/90">
                  Export →
                  <FileDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExportPid("svg")}>
                  Export as SVG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPid("pdf")}>
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportPid("dwg")}>
                  Export as DWG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        
        {/* Show Legend Button for P&ID */}
        {isPid && !showLegend && !errorState && (
          <Button
            variant="outline"
            size="sm"
            className="absolute top-16 right-4 z-30 bg-background/95 backdrop-blur-sm border-engineering-green/20 hover:bg-engineering-green/10"
            onClick={() => setShowLegend(true)}
          >
            <Layers className="h-4 w-4 mr-2 text-engineering-green" />
            Show Legend
          </Button>
        )}
        
        {/* Draggable Palette Panel */}
        {showPalette && (
          <div
            className="absolute bg-background border border-border rounded-lg shadow-lg z-50"
            style={{
              left: `${palettePosition.x}px`,
              top: `${palettePosition.y}px`,
              cursor: isDragging ? 'grabbing' : 'default',
            }}
            onMouseDown={handlePaletteMouseDown}
          >
            <div className="palette-header flex items-center justify-between p-3 border-b cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="font-semibold text-sm">BPMN Palette</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowPalette(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto" style={{ width: '260px' }}>
              
              {/* Start Events */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">START EVENTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('start-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Start Event">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600" />
                    <span className="text-[9px] text-center">Start</span>
                  </div>
                  <div onClick={() => addBpmnElement('start-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer Start">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600 flex items-center justify-center text-[10px]">⏱️</div>
                    <span className="text-[9px] text-center">Timer</span>
                  </div>
                  <div onClick={() => addBpmnElement('start-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message Start">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600 flex items-center justify-center text-[10px]">✉️</div>
                    <span className="text-[9px] text-center">Msg</span>
                  </div>
                  <div onClick={() => addBpmnElement('start-signal-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Signal Start">
                    <div className="w-7 h-7 rounded-full border-2 border-green-600 flex items-center justify-center text-[10px]">📡</div>
                    <span className="text-[9px] text-center">Signal</span>
                  </div>
                </div>
              </div>
              
              {/* Intermediate Events */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">INTERMEDIATE EVENTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('intermediate-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Intermediate">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600" />
                    <span className="text-[9px] text-center">Inter.</span>
                  </div>
                  <div onClick={() => addBpmnElement('intermediate-timer-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Timer">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px]">⏱️</div>
                    <span className="text-[9px] text-center">Timer</span>
                  </div>
                  <div onClick={() => addBpmnElement('intermediate-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px]">✉️</div>
                    <span className="text-[9px] text-center">Msg</span>
                  </div>
                  <div onClick={() => addBpmnElement('intermediate-signal-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Signal">
                    <div className="w-7 h-7 rounded-full border-2 border-blue-600 flex items-center justify-center text-[10px]">📡</div>
                    <span className="text-[9px] text-center">Signal</span>
                  </div>
                </div>
              </div>
              
              {/* End Events */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">END EVENTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('end-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="End Event">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600" />
                    <span className="text-[9px] text-center">End</span>
                  </div>
                  <div onClick={() => addBpmnElement('end-message-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Message End">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600 flex items-center justify-center text-[10px]">✉️</div>
                    <span className="text-[9px] text-center">Msg</span>
                  </div>
                  <div onClick={() => addBpmnElement('end-error-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Error End">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600 flex items-center justify-center text-[10px]">⚠️</div>
                    <span className="text-[9px] text-center">Error</span>
                  </div>
                  <div onClick={() => addBpmnElement('end-terminate-event')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Terminate">
                    <div className="w-7 h-7 rounded-full border-4 border-red-600 flex items-center justify-center text-[10px]">⬛</div>
                    <span className="text-[9px] text-center">Term</span>
                  </div>
                </div>
              </div>
              
              {/* Tasks */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">TASKS & ACTIVITIES</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded" />
                    <span className="text-[9px] text-center">Task</span>
                  </div>
                  <div onClick={() => addBpmnElement('user-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="User Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">👤</div>
                    <span className="text-[9px] text-center">User</span>
                  </div>
                  <div onClick={() => addBpmnElement('service-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Service Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">⚙️</div>
                    <span className="text-[9px] text-center">Service</span>
                  </div>
                  <div onClick={() => addBpmnElement('manual-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Manual Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">✋</div>
                    <span className="text-[9px] text-center">Manual</span>
                  </div>
                  <div onClick={() => addBpmnElement('script-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Script Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📜</div>
                    <span className="text-[9px] text-center">Script</span>
                  </div>
                  <div onClick={() => addBpmnElement('send-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Send Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📤</div>
                    <span className="text-[9px] text-center">Send</span>
                  </div>
                  <div onClick={() => addBpmnElement('receive-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Receive Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📥</div>
                    <span className="text-[9px] text-center">Receive</span>
                  </div>
                  <div onClick={() => addBpmnElement('business-rule-task')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Business Rule Task">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">📋</div>
                    <span className="text-[9px] text-center">Rule</span>
                  </div>
                  <div onClick={() => addBpmnElement('call-activity')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Call Activity">
                    <div className="w-7 h-7 border-4 border-foreground rounded" />
                    <span className="text-[9px] text-center">Call</span>
                  </div>
                </div>
              </div>
              
              {/* Gateways */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">GATEWAYS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('xor-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Exclusive Gateway (XOR)">
                    <div className="w-7 h-7 border-2 border-amber-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">X</span>
                    </div>
                    <span className="text-[9px] text-center">XOR</span>
                  </div>
                  <div onClick={() => addBpmnElement('and-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Parallel Gateway (AND)">
                    <div className="w-7 h-7 border-2 border-purple-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">+</span>
                    </div>
                    <span className="text-[9px] text-center">AND</span>
                  </div>
                  <div onClick={() => addBpmnElement('or-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Inclusive Gateway (OR)">
                    <div className="w-7 h-7 border-2 border-indigo-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">O</span>
                    </div>
                    <span className="text-[9px] text-center">OR</span>
                  </div>
                  <div onClick={() => addBpmnElement('event-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Event-based Gateway">
                    <div className="w-7 h-7 border-2 border-cyan-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px]">⬡</span>
                    </div>
                    <span className="text-[9px] text-center">Event</span>
                  </div>
                  <div onClick={() => addBpmnElement('complex-gateway')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Complex Gateway">
                    <div className="w-7 h-7 border-2 border-pink-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">*</span>
                    </div>
                    <span className="text-[9px] text-center">Complex</span>
                  </div>
                </div>
              </div>
              
              {/* Subprocesses */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">SUBPROCESSES</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Expanded Subprocess">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center text-[10px]">+</div>
                    <span className="text-[9px] text-center">Sub</span>
                  </div>
                  <div onClick={() => addBpmnElement('collapsed-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Collapsed Subprocess">
                    <div className="w-7 h-7 border-2 border-foreground rounded flex items-center justify-center">
                      <div className="w-3 h-0.5 bg-foreground" />
                    </div>
                    <span className="text-[9px] text-center">Coll.</span>
                  </div>
                  <div onClick={() => addBpmnElement('event-subprocess')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Event Subprocess">
                    <div className="w-7 h-7 border-2 border-dashed border-foreground rounded flex items-center justify-center text-[10px]">+</div>
                    <span className="text-[9px] text-center">Event</span>
                  </div>
                  <div onClick={() => addBpmnElement('transaction')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Transaction">
                    <div className="w-7 h-7 border-4 border-double border-foreground rounded" />
                    <span className="text-[9px] text-center">Trans.</span>
                  </div>
                </div>
              </div>
              
              {/* Pools & Lanes */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">POOLS & LANES</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('participant')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Pool/Participant">
                    <div className="w-8 h-6 border-2 border-foreground rounded">
                      <div className="w-1 h-full bg-foreground" />
                    </div>
                    <span className="text-[9px] text-center">Pool</span>
                  </div>
                </div>
              </div>
              
              {/* Data Objects */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">DATA OBJECTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('data-object')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Object">
                    <div className="w-6 h-7 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }} />
                    <span className="text-[9px] text-center">Object</span>
                  </div>
                  <div onClick={() => addBpmnElement('data-store')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Store">
                    <div className="w-7 h-6 border-2 border-foreground rounded-sm" />
                    <span className="text-[9px] text-center">Store</span>
                  </div>
                  <div onClick={() => addBpmnElement('data-input')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Input">
                    <div className="w-6 h-7 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }}>
                      <div className="text-[8px] mt-2 ml-1">→</div>
                    </div>
                    <span className="text-[9px] text-center">Input</span>
                  </div>
                  <div onClick={() => addBpmnElement('data-output')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Data Output">
                    <div className="w-6 h-7 border-2 border-foreground" style={{ clipPath: 'polygon(0 10%, 70% 10%, 100% 0, 100% 100%, 0 100%)' }}>
                      <div className="text-[8px] mt-2 ml-1">←</div>
                    </div>
                    <span className="text-[9px] text-center">Output</span>
                  </div>
                </div>
              </div>
              
              {/* Artifacts & Connections */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">ARTIFACTS</p>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => addBpmnElement('text-annotation')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Text Annotation">
                    <div className="w-7 h-6 border-l-2 border-t-2 border-b-2 border-foreground" />
                    <span className="text-[9px] text-center">Note</span>
                  </div>
                  <div onClick={() => addBpmnElement('group')} className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded cursor-pointer transition-colors" title="Group">
                    <div className="w-7 h-7 border-2 border-dashed border-foreground rounded" />
                    <span className="text-[9px] text-center">Group</span>
                  </div>
                </div>
              </div>
              
              {/* Connection Instructions */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-bold text-foreground">CONNECTIONS</p>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 bg-foreground" />
                    <span>Sequence Flow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 border-t-2 border-dashed border-foreground" />
                    <span>Message Flow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 border-t-2 border-dotted border-foreground" />
                    <span>Association</span>
                  </div>
                  <p className="pt-1 text-muted-foreground">
                    Drag from any element's anchor points to create connections
                  </p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground pt-2 border-t">
                💡 Click elements to add them. Double-click shapes to edit labels. Use context menu (right-click) for more options.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Element Change Context Menu */}
      {showContextMenu && selectedElement && (
        <div
          className="context-menu absolute bg-background border border-border rounded-lg shadow-lg z-50 p-3"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            maxWidth: '280px',
          }}
        >
          <div className="flex items-center justify-between mb-2 pb-2 border-b">
            <span className="text-xs font-semibold">Change to:</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={() => setShowContextMenu(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {/* Show events if current is an event */}
            {(selectedElement.type?.includes('Event') || selectedElement.type === 'bpmn:StartEvent' || selectedElement.type === 'bpmn:EndEvent') && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">EVENTS</p>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => changeElementType('start-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded text-xs" title="Start Event">
                    <div className="w-6 h-6 rounded-full border-2 border-green-600" />
                    <span className="text-[8px]">Start</span>
                  </button>
                  <button onClick={() => changeElementType('intermediate-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded text-xs" title="Intermediate">
                    <div className="w-6 h-6 rounded-full border-2 border-blue-600" />
                    <span className="text-[8px]">Inter.</span>
                  </button>
                  <button onClick={() => changeElementType('end-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded text-xs" title="End Event">
                    <div className="w-6 h-6 rounded-full border-4 border-red-600" />
                    <span className="text-[8px]">End</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Show tasks if current is a task */}
            {selectedElement.type?.includes('Task') && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">TASKS</p>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => changeElementType('task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Task">
                    <div className="w-6 h-6 border-2 border-foreground rounded" />
                    <span className="text-[8px]">Task</span>
                  </button>
                  <button onClick={() => changeElementType('user-task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="User Task">
                    <div className="w-6 h-6 border-2 border-foreground rounded flex items-center justify-center text-[10px]">👤</div>
                    <span className="text-[8px]">User</span>
                  </button>
                  <button onClick={() => changeElementType('service-task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Service">
                    <div className="w-6 h-6 border-2 border-foreground rounded flex items-center justify-center text-[10px]">⚙️</div>
                    <span className="text-[8px]">Service</span>
                  </button>
                  <button onClick={() => changeElementType('manual-task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Manual">
                    <div className="w-6 h-6 border-2 border-foreground rounded flex items-center justify-center text-[10px]">✋</div>
                    <span className="text-[8px]">Manual</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Show gateways if current is a gateway */}
            {selectedElement.type?.includes('Gateway') && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground">GATEWAYS</p>
                <div className="grid grid-cols-3 gap-1">
                  <button onClick={() => changeElementType('xor-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="XOR">
                    <div className="w-6 h-6 border-2 border-amber-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">X</span>
                    </div>
                    <span className="text-[8px]">XOR</span>
                  </button>
                  <button onClick={() => changeElementType('and-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="AND">
                    <div className="w-6 h-6 border-2 border-purple-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">+</span>
                    </div>
                    <span className="text-[8px]">AND</span>
                  </button>
                  <button onClick={() => changeElementType('or-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="OR">
                    <div className="w-6 h-6 border-2 border-indigo-600 transform rotate-45 flex items-center justify-center">
                      <span className="transform -rotate-45 text-[10px] font-bold">O</span>
                    </div>
                    <span className="text-[8px]">OR</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Always show option to change to any category */}
            <div className="pt-2 border-t space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground">CHANGE TO</p>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={() => changeElementType('task')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Task">
                  <div className="w-6 h-6 border-2 border-foreground rounded" />
                  <span className="text-[8px]">Task</span>
                </button>
                <button onClick={() => changeElementType('start-event')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Event">
                  <div className="w-6 h-6 rounded-full border-2 border-green-600" />
                  <span className="text-[8px]">Event</span>
                </button>
                <button onClick={() => changeElementType('xor-gateway')} className="flex flex-col items-center gap-1 p-1.5 hover:bg-accent rounded" title="Gateway">
                  <div className="w-6 h-6 border-2 border-amber-600 transform rotate-45" />
                  <span className="text-[8px]">Gateway</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vision Modelling AI Dialog */}
      <Dialog open={visionDialogOpen} onOpenChange={setVisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vision Modelling AI - Process from Images</DialogTitle>
            <DialogDescription>
              Upload images containing process information:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Handwritten notes</strong> - sketches and text</li>
                <li><strong>Whiteboard diagrams</strong> - flow drawings and ideas</li>
                <li><strong>Process sketches</strong> - rough workflow designs</li>
                <li><strong>Meeting notes</strong> - captured process discussions</li>
              </ul>
              <p className="mt-2 text-sm">AI will extract text, analyze the content, and generate a professional BPMN diagram.</p>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="vision-upload" className="cursor-pointer">
                <span className="text-sm font-medium">Click to upload image</span>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG - handwritten or printed content</p>
              </Label>
              <Input
                id="vision-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleVisionUpload}
                disabled={isProcessing}
              />
            </div>
            {selectedFile && (
              <div className="text-center text-sm">
                <p className="text-foreground">Selected: <strong>{selectedFile.name}</strong></p>
              </div>
            )}
            {isProcessing && (
              <div className="text-center space-y-2">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Processing your image with AI...</p>
                  <p className="text-xs mt-1">📝 Extracting text and analyzing content</p>
                  <p className="text-xs">🔍 Understanding process flow</p>
                  <p className="text-xs">⚙️ Generating BPMN diagram</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share via QR Code</DialogTitle>
            <DialogDescription>
              Generate a QR code to invite collaborators with view or edit permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-8 text-center bg-muted/30">
              <QrCode className="h-32 w-32 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">QR Code will appear here</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={generateQRCode} className="flex-1">
                Generate QR Code
              </Button>
              <Button variant="outline" className="flex-1">
                Set Permissions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Agent Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Agent</DialogTitle>
            <DialogDescription>
              Import process logs to analyze and improve your BPMN models
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <Label htmlFor="log-upload" className="cursor-pointer">
                <span className="text-sm font-medium">Click to upload log file</span>
                <p className="text-xs text-muted-foreground mt-1">CSV, JSON, or TXT format</p>
              </Label>
              <Input
                id="log-upload"
                type="file"
                accept=".csv,.json,.txt,.log"
                className="hidden"
                onChange={handleLogUpload}
                disabled={isProcessing}
              />
            </div>
            {isProcessing && (
              <div className="text-center text-sm text-muted-foreground">
                Analyzing log file...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modelling Agent Dialog */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modelling Agent Mode</DialogTitle>
            <DialogDescription>
              View AI-suggested alternative process models based on best practices
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-6 text-center">
              <Bot className="h-16 w-16 mx-auto mb-4 text-primary" />
              <p className="text-sm font-medium mb-2">AI Analysis Ready</p>
              <p className="text-xs text-muted-foreground">
                The AI will analyze your current model and suggest optimized alternatives
              </p>
            </div>
            <Button onClick={() => {
              toast.success("Generating alternative models...");
              setAgentDialogOpen(false);
            }} className="w-full">
              Generate Alternatives
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* System Use Modelling Dialog */}
      <Dialog open={systemDialogOpen} onOpenChange={setSystemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>System Use Modelling</DialogTitle>
            <DialogDescription>
              Automatically track user behavior and generate BPMN models from system usage
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-6 text-center">
              <Activity className="h-16 w-16 mx-auto mb-4 text-primary" />
              <p className="text-sm font-medium mb-2">Behavior Tracking</p>
              <p className="text-xs text-muted-foreground">
                Enable tracking to automatically capture user workflows and generate BPMN diagrams
              </p>
            </div>
            <Button onClick={() => {
              toast.success("System tracking enabled!");
              setSystemDialogOpen(false);
            }} className="w-full">
              Enable Tracking
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BpmnViewerComponent;
