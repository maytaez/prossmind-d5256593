import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import DmnViewer from "dmn-js/lib/Viewer";

// dmn-js styles
import "dmn-js/dist/assets/diagram-js.css";
import "dmn-js/dist/assets/dmn-js-shared.css";
import "dmn-js/dist/assets/dmn-js-decision-table.css";
import "dmn-js/dist/assets/dmn-js-literal-expression.css";
import "dmn-js/dist/assets/dmn-js-drd.css";
import "dmn-js/dist/assets/dmn-font/css/dmn-embedded.css";

interface DmnRendererProps {
  xml: string;
  height?: string;
}

export default function DmnRenderer({ xml, height = "600px" }: DmnRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!xml) return;

    // initialize the viewer
    viewerRef.current = new DmnViewer({
      container: containerRef.current,
      height: "100%",
    });

    // import XML
    viewerRef.current
      .importXML(xml)
      .then(() => {
        const activeView = viewerRef.current.getActiveView();
        const activeViewer = viewerRef.current.getActiveViewer();

        // Auto-zoom DRD diagrams
        if (activeView.type === "drd") {
          const canvas = activeViewer.get("canvas");
          canvas.zoom("fit-viewport");
        }
      })
      .catch((err: any) => {
        console.error("DMN render error:", err);
        setError(err.message);
      });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [xml]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6 }}>
      {error && (
        <div style={{ padding: 12, color: "red" }}>
          Failed to render DMN: {error}
        </div>
      )}
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
