import { useState, useEffect } from "react";
import CombinedCamundaWebModeler from "@/components/CombinedCamundaWebModeler";
import "@miragon/camunda-web-modeler/dist/bundle.css";
import { useParams } from "react-router-dom";
import { loadJobResult } from "@/utils/loadJobResult";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export function DmnSubdomainPage() {
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

  const handleDmnChange = (xml: string) => {
    console.log("DMN changed:", xml.substring(0, 100));
    // You can save to Supabase or backend here
  };

  const handleBpmnChange = (xml: string) => {
    console.log("BPMN changed:", xml.substring(0, 100));
    // You can save to Supabase or backend here
  };

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        initialMode="dmn"
        initialDmnXml={diagramXml || undefined}
        onDmnChange={handleDmnChange}
        onBpmnChange={handleBpmnChange}
        userId={user?.id}
      />
    </div>
  );
}

export default DmnSubdomainPage;






