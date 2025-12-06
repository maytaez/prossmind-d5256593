import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import CombinedCamundaWebModeler from "@/components/CombinedCamundaWebModeler";
import "@miragon/camunda-web-modeler/dist/bundle.css";
import PageContainer from "@/components/layout/PageContainer";

const CombinedModelerPage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleBpmnChange = (xml: string) => {
    console.log("BPMN changed:", xml.substring(0, 100));
    // You can save to Supabase or backend here
  };

  const handleDmnChange = (xml: string) => {
    console.log("DMN changed:", xml.substring(0, 100));
    // You can save to Supabase or backend here
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading modeler...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        onBpmnChange={handleBpmnChange}
        onDmnChange={handleDmnChange}
        userId={user?.id}
      />
    </div>
  );
};

export default CombinedModelerPage;
