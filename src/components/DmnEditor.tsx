import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import DmnModeler from "dmn-js/lib/Modeler";

// dmn-js styles
import "dmn-js/dist/assets/diagram-js.css";
import "dmn-js/dist/assets/dmn-js-shared.css";
import "dmn-js/dist/assets/dmn-js-decision-table.css";
import "dmn-js/dist/assets/dmn-js-literal-expression.css";
import "dmn-js/dist/assets/dmn-js-drd.css";
import "dmn-js/dist/assets/dmn-font/css/dmn-embedded.css";

interface DmnEditorProps {
  xml: string;
  height?: string;
  onChange?: (xml: string) => void;
  onError?: (err: any) => void;
}

export default function DmnEditor({
  xml,
  height = "650px",
  onChange,        // returns XML on change
  onError          // returns error
}: DmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const [currentView, setCurrentView] = useState<string | null>(null);

  // Initialize the DMN modeler
  useEffect(() => {
    modelerRef.current = new DmnModeler({
      container: containerRef.current,
      height: "100%",
      keyboard: { bindTo: window },
    });

    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, []);

  // Load XML into the modeler
  useEffect(() => {
    if (!xml || !modelerRef.current) return;

    modelerRef.current.importXML(xml)
      .then(() => {
        const activeView = modelerRef.current.getActiveView();
        const activeViewer = modelerRef.current.getActiveViewer();
        setCurrentView(activeView.type);

        // zoom DRD
        if (activeView.type === "drd") {
          activeViewer.get("canvas").zoom("fit-viewport");
        }

        // event for XML changes
        modelerRef.current.on("commandStack.changed", async () => {
          try {
            const { xml } = await modelerRef.current.saveXML({ format: true });
            onChange && onChange(xml);
          } catch (err) {
            onError && onError(err);
          }
        });
      })
      .catch((err: any) => {
        console.error("DMN import error:", err);
        onError && onError(err);
      });
  }, [xml]);

  // Export DMN XML
  const handleSaveXML = async () => {
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      downloadFile(xml, "diagram.dmn", "text/xml");
    } catch (err) {
      onError && onError(err);
    }
  };

  // Export SVG
  const handleSaveSVG = async () => {
    try {
      const { svg } = await modelerRef.current.saveSVG();
      downloadFile(svg, "diagram.svg", "image/svg+xml");
    } catch (err) {
      onError && onError(err);
    }
  };

  // Undo / Redo
  const handleUndo = () => modelerRef.current.get("commandStack").undo();
  const handleRedo = () => modelerRef.current.get("commandStack").redo();

  // File download helper
  const downloadFile = (data: string, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6 }}>
      {/* Toolbar */}
      <div
        style={{
          padding: "8px",
          background: "#f7f7f7",
          borderBottom: "1px solid #ddd",
          display: "flex",
          gap: "10px",
        }}
      >
        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
        <button onClick={handleSaveXML}>Export XML</button>
        <button onClick={handleSaveSVG}>Export SVG</button>

        <span style={{ marginLeft: "auto", opacity: 0.6 }}>
          View: <strong>{currentView}</strong>
        </span>
      </div>

      {/* Editor Container */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height,
          background: "#fafafa",
        }}
      />
    </div>
  );
}
