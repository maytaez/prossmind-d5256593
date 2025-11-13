import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LoadDiagram = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const loadLatestDiagram = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error("Please log in");
          navigate('/auth');
          return;
        }

        // Get the most recent completed job
        const { data, error } = await supabase
          .from('vision_bpmn_jobs')
          .select('bpmn_xml')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        if (error || !data?.bpmn_xml) {
          toast.error("No completed diagrams found");
          navigate('/vision-ai');
          return;
        }

        // Check if there's a diagram type stored
        const diagramType = localStorage.getItem('diagramType') || 'bpmn';
        const storageKey = diagramType === 'bpmn' ? 'generatedBpmn' : 'generatedPid';
        
        // Store and redirect
        localStorage.setItem(storageKey, data.bpmn_xml);
        const diagramName = diagramType === 'bpmn' ? 'BPMN' : 'P&ID';
        toast.success(`${diagramName} diagram loaded successfully!`);
        navigate('/');
      } catch (err) {
        console.error('Error loading diagram:', err);
        toast.error("Failed to load diagram");
        navigate('/vision-ai');
      }
    };

    loadLatestDiagram();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading your diagram...</p>
      </div>
    </div>
  );
};

export default LoadDiagram;
