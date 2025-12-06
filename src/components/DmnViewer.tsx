import { useEffect, useRef, useState, useCallback } from "react";
import DmnModeler from "dmn-js/lib/Modeler";
import "dmn-js/dist/assets/diagram-js.css";
import "dmn-js/dist/assets/dmn-font/css/dmn-embedded.css";
import { Button } from "@/components/ui/button";
import { Save, Download, Undo, Redo, Upload, FileDown, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DmnViewerProps {
  xml: string;
  onSave?: (xml: string) => void;
  onRefine?: () => void;
}

const DmnViewerComponent = ({ xml, onSave, onRefine }: DmnViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<DmnModeler | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [version, setVersion] = useState(1);
  const [versions, setVersions] = useState<string[]>([xml]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [refinePrompt, setRefinePrompt] = useState("");

  // Initialize modeler once on mount
  useEffect(() => {
    if (!containerRef.current || modelerRef.current) return;

    // Create DMN modeler instance
    modelerRef.current = new DmnModeler({
      container: containerRef.current,
    });

    // Wait a bit for modeler to fully initialize before accessing services
    setTimeout(() => {
      if (!modelerRef.current) return;
      
      try {
        // Listen to command stack changes for undo/redo
        const eventBus = modelerRef.current.get("eventBus") as {
          on: (event: string, callback: (data: unknown) => void) => void;
        } | null;
        
        if (eventBus) {
          eventBus.on("commandStack.changed", () => {
            if (!modelerRef.current) return;
            try {
              const commandStack = modelerRef.current.get("commandStack") as {
                canUndo: () => boolean;
                canRedo: () => boolean;
              } | null;
              if (commandStack) {
                setCanUndo(commandStack.canUndo());
                setCanRedo(commandStack.canRedo());
              }
            } catch (e) {
              console.warn("Error accessing command stack:", e);
            }
          });
        }
      } catch (e) {
        console.warn("Error setting up event bus:", e);
      }
    }, 100);

    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  // Load XML when it changes
  useEffect(() => {
    if (!modelerRef.current || !xml) return;

    let isCancelled = false;

    modelerRef.current
      .importXML(xml)
      .then(() => {
        if (isCancelled) return;
        
        // Wait for modeler services to be ready after importXML
        // importXML may reset services, so we need to wait a bit
        const tryAccessCanvas = (attempt: number = 0) => {
          if (isCancelled || !modelerRef.current) return;
          
          try {
            // Check if get method exists
            if (typeof modelerRef.current.get !== 'function') {
              if (attempt < 5) {
                // Retry with exponential backoff
                setTimeout(() => {
                  if (!isCancelled) tryAccessCanvas(attempt + 1);
                }, 50 * (attempt + 1));
              } else {
                console.warn("Modeler get method not available after multiple retries");
              }
              return;
            }
            
            const canvas = modelerRef.current.get("canvas") as {
              zoom: (mode: string) => void;
            } | null;
            
            if (canvas && typeof canvas.zoom === 'function') {
              canvas.zoom("fit-viewport");
            } else if (attempt < 5) {
              // Canvas might not be ready yet, retry
              setTimeout(() => {
                if (!isCancelled) tryAccessCanvas(attempt + 1);
              }, 50 * (attempt + 1));
            }
          } catch (e) {
            if (attempt < 5) {
              // Retry on error
              setTimeout(() => {
                if (!isCancelled) tryAccessCanvas(attempt + 1);
              }, 50 * (attempt + 1));
            } else {
              console.warn("Error accessing canvas after multiple retries:", e);
            }
          }
        };
        
        // Start trying to access canvas after a short delay
        setTimeout(() => {
          if (!isCancelled) tryAccessCanvas();
        }, 100);
      })
      .catch((err: Error) => {
        if (isCancelled) return;
        console.error("Error loading DMN diagram:", err);
        toast.error("Failed to load DMN diagram");
      });

    return () => {
      isCancelled = true;
    };
  }, [xml]);

  const handleSave = async () => {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        const newVersion = version + 1;
        setVersion(newVersion);
        const updatedVersions = [...versions, result.xml];
        setVersions(updatedVersions);

        if (onSave) {
          onSave(result.xml);
        }

        toast.success(`DMN diagram saved`, {
          description: `Saved as version v${newVersion}`,
        });
      }
    } catch (err) {
      console.error("Error saving DMN diagram:", err);
      toast.error("Failed to save DMN diagram");
    }
  };

  const handleDownload = async () => {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      if (result.xml) {
        const blob = new Blob([result.xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `DMN_v${version}.dmn`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported to DMN_v${version}.dmn`);
      }
    } catch (err) {
      console.error("Error downloading DMN diagram:", err);
      toast.error("Failed to download DMN diagram");
    }
  };

  const handleUndo = () => {
    if (!modelerRef.current) return;
    const commandStack = modelerRef.current.get("commandStack") as {
      canUndo: () => boolean;
      undo: () => void;
    };
    if (commandStack.canUndo()) {
      commandStack.undo();
    }
  };

  const handleRedo = () => {
    if (!modelerRef.current) return;
    const commandStack = modelerRef.current.get("commandStack") as {
      canRedo: () => boolean;
      redo: () => void;
    };
    if (commandStack.canRedo()) {
      commandStack.redo();
    }
  };

  const handleZoomIn = () => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas") as {
      zoom: (factor: number) => void;
      getViewbox: () => { scale: number } | undefined;
    };
    const viewbox = canvas.getViewbox();
    if (viewbox) {
      canvas.zoom(viewbox.scale * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas") as {
      zoom: (factor: number) => void;
      getViewbox: () => { scale: number } | undefined;
    };
    const viewbox = canvas.getViewbox();
    if (viewbox) {
      canvas.zoom(viewbox.scale * 0.8);
    }
  };

  const handleFitViewport = () => {
    if (!modelerRef.current) return;
    const canvas = modelerRef.current.get("canvas") as {
      zoom: (mode: string) => void;
    };
    canvas.zoom("fit-viewport");
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleRefine = () => {
    if (onRefine) {
      onRefine();
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dmn,.xml";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        if (modelerRef.current) {
          await modelerRef.current.importXML(text);
          toast.success("DMN diagram imported successfully");
          if (onSave) {
            const result = await modelerRef.current.saveXML({ format: true });
            if (result.xml) {
              onSave(result.xml);
            }
          }
        }
      } catch (err) {
        console.error("Error importing DMN:", err);
        toast.error("Failed to import DMN diagram");
      }
    };
    input.click();
  };

  return (
    <div className="flex flex-col h-full w-full">
      <style>{`
        .dmn-definitions-name,
        .drd-name,
        .view-drd-name,
        .dmn-navigation,
        .tjs-navigation {
          display: none !important;
        }
      `}</style>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-card">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          title="Save (Ctrl+S)"
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImport}
          title="Import DMN"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFitViewport}
          title="Fit to Viewport"
        >
          Fit
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleFullscreen}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        {onRefine && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefine}
              title="Refine with AI"
            >
              Refine
            </Button>
          </>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          v{version}
        </div>
      </div>

      {/* DMN Canvas */}
      <div
        ref={containerRef}
        className="flex-1 w-full bg-white border border-border relative"
        style={{ minHeight: "75vh" }}
      />

    </div>
  );
};

export default DmnViewerComponent;
