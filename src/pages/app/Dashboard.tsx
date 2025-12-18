import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFreePrompts } from "@/hooks/useFreePrompts";
import { Workflow, Factory, Eye, FileText, Plus, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageContainer from "@/components/layout/PageContainer";
import { navigateWithSubdomain } from "@/utils/subdomain";
import { getRecentProjects, updateLastAccessed, type Project } from "@/utils/projects-service";
import { featureFlags } from "@/config/featureFlags";

interface DashboardProps {
  user: User;
}

const Dashboard = ({ user }: DashboardProps) => {
  const navigate = useNavigate();
  const { remainingPrompts, isUnlimited } = useFreePrompts(true);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  useEffect(() => {
    const loadRecentProjects = async () => {
      setIsLoadingProjects(true);
      const { data, error } = await getRecentProjects(user.id, 6);

      if (error) {
        console.error("Failed to load recent projects:", error);
        setRecentProjects([]);
      } else if (data) {
        // Filter out P&ID projects if feature flag is disabled
        const filteredProjects = featureFlags.enablePidDiagrams 
          ? data 
          : data.filter(p => p.diagram_type !== 'pid');
        setRecentProjects(filteredProjects);
      }
      setIsLoadingProjects(false);
    };

    if (user?.id) {
      loadRecentProjects();
    }
  }, [user?.id]);

  const handleProjectClick = async (project: Project) => {
    // Update last accessed timestamp
    await updateLastAccessed(project.id, user.id);

    // Store project data and navigate to editor
    const storageKey = project.diagram_type === 'bpmn' ? 'generatedBpmn' : 'generatedPid';
    localStorage.setItem(storageKey, project.bpmn_xml);
    localStorage.setItem('diagramType', project.diagram_type);
    localStorage.setItem('currentProjectId', project.id);

    const route = project.diagram_type === 'bpmn' ? '/bpmn-generator' : '/pid-generator';
    navigateWithSubdomain(navigate, route);
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.email}</p>
        </div>

        {/* Quick Actions */}
        <div className={`grid gap-6 mb-8 ${featureFlags.enablePidDiagrams ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <Card className="cursor-pointer hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col" onClick={() => navigateWithSubdomain(navigate, '/bpmn-generator')}>
            <CardHeader className="flex-1">
              <div className="flex flex-col items-center text-center mb-4">
                <Workflow className="h-10 w-10 text-primary mb-4" />
                <CardTitle>New BPMN Diagram</CardTitle>
              </div>
              <CardDescription className="text-center">Create a new business process diagram</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigateWithSubdomain(navigate, '/bpmn-generator'); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create BPMN
              </Button>
            </CardContent>
          </Card>

          {featureFlags.enablePidDiagrams && (
            <Card className="cursor-pointer hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col" onClick={() => navigateWithSubdomain(navigate, '/pid-generator')}>
              <CardHeader className="flex-1">
                <div className="flex flex-col items-center text-center mb-4">
                  <Factory className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>New P&ID Diagram</CardTitle>
                </div>
                <CardDescription className="text-center">Create a new piping and instrumentation diagram</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigateWithSubdomain(navigate, '/pid-generator'); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create P&ID
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="cursor-pointer hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 flex flex-col" onClick={() => navigateWithSubdomain(navigate, '/vision-ai')}>
            <CardHeader className="flex-1">
              <div className="flex flex-col items-center text-center mb-4">
                <Eye className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Vision AI</CardTitle>
              </div>
              <CardDescription className="text-center">Upload images to generate diagrams</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigateWithSubdomain(navigate, '/vision-ai'); }}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Usage Statistics */}
          <Card className="flex flex-col hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <CardHeader className="flex-1">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="h-10 w-10 mb-4 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-xl">∞</span>
                  </div>
                </div>
                <CardTitle>Usage Statistics</CardTitle>
              </div>
              <CardDescription className="text-center">Your current plan usage</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Free Prompts Remaining</span>
                  <span className="text-2xl font-bold">
                    {isUnlimited ? '∞' : remainingPrompts}
                  </span>
                </div>
                {!isUnlimited && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(remainingPrompts / 5) * 100}%` }}
                    />
                  </div>
                )}
              </div>
              <div className="mt-auto pt-4">
                <Button variant="outline" className="w-full" onClick={() => navigateWithSubdomain(navigate, '/settings')}>
                  View Plan Details
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="flex flex-col hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <CardHeader className="flex-1">
              <div className="flex flex-col items-center text-center mb-4">
                <div className="h-10 w-10 mb-4 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <CardTitle>Recent Projects</CardTitle>
              </div>
              <CardDescription className="text-center">Your recently created diagrams</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1">
                {isLoadingProjects ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : recentProjects.length > 0 ? (
                  <div className="space-y-3">
                    {recentProjects.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => handleProjectClick(project)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {project.diagram_type === 'bpmn' ? (
                            <Workflow className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <Factory className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {project.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {project.diagram_type === 'bpmn' ? 'BPMN' : 'P&ID'} · {new Date(project.last_accessed_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent projects</p>
                    <p className="text-sm mt-2">Create your first diagram to get started</p>
                  </div>
                )}
              </div>
              <div className="mt-auto pt-4">
                <Button variant="outline" className="w-full" onClick={() => navigateWithSubdomain(navigate, '/projects')}>
                  View All Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
};

export default Dashboard;

