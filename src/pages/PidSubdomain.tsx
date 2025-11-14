
import { useState, useEffect } from "react";
import { DiagramGenerator } from "@/components/DiagramGenerator";
import BpmnViewerComponent from "@/components/BpmnViewer";
import PageContainer from "@/components/layout/PageContainer";
import { useParams } from "react-router-dom";
import { loadJobResult } from "@/utils/loadJobResult";

export function PidSubdomainPage() {
  const [diagramXml, setDiagramXml] = useState<string | null>(null);
  const { jobId } = useParams<{ jobId?: string }>();

  useEffect(() => {
    if (jobId) {
      const fetchJobResult = async () => {
        try {
          const xml = await loadJobResult(jobId);
          setDiagramXml(xml);
        } catch (error) {
          console.error("Error loading job result:", error);
        }
      };
      fetchJobResult();
    }
  }, [jobId]);

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <DiagramGenerator
          diagramType="P&ID"
          onDiagramGenerated={setDiagramXml}
        />
        {diagramXml && <BpmnViewerComponent xml={diagramXml} diagramType="pid" />}
      </div>
    </PageContainer>
  );
}
