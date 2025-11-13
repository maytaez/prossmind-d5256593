import { useState, useEffect } from "react";
import SubdomainTryProssMe from "@/components/SubdomainTryProssMe";
import BpmnViewerComponent from "@/components/BpmnViewer";
import PageContainer from "@/components/layout/PageContainer";
import { useParams } from "react-router-dom";
import { loadJobResult } from "@/utils/loadJobResult";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export function PidSubdomainPage() {
  const [diagramXml, setDiagramXml] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const { jobId } = useParams<{ jobId?: string }>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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
        <SubdomainTryProssMe
          user={user}
          diagramType="pid"
        />
        {diagramXml && <BpmnViewerComponent xml={diagramXml} diagramType="pid" />}
      </div>
    </PageContainer>
  );
}
