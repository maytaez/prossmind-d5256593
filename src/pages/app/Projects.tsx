import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Workflow, Factory, Search, Trash2, Edit, FileText, Loader2, RefreshCw, Gauge } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { navigateWithSubdomain } from "@/utils/subdomain";
import { getProjects, deleteProject, updateLastAccessed, type Project } from "@/utils/projects-service";
import { toast } from "sonner";

interface ProjectsProps {
  user: User;
}

const Projects = ({ user }: ProjectsProps) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "bpmn" | "pid" | "dmn">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProjects = async () => {
    setIsLoading(true);
    const filters = filterType !== "all" ? { diagramType: filterType } : undefined;
    const { data, error } = await getProjects(user.id, filters);

    if (error) {
      toast.error("Failed to load projects");
      console.error(error);
      setIsLoading(false);
      return;
    }

    if (data) {
      setProjects(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, [user.id, filterType]);

  useEffect(() => {
    // Filter projects based on search query
    let filtered = projects;

    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProjects(filtered);
  }, [projects, searchQuery]);

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    const { error } = await deleteProject(projectToDelete.id, user.id);

    if (error) {
      toast.error("Failed to delete project");
      console.error(error);
    } else {
      toast.success("Project deleted successfully");
      await loadProjects();
    }

    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleEdit = async (project: Project) => {
    // Update last accessed timestamp
    await updateLastAccessed(project.id, user.id);

    // Store project data and navigate to generator
    const storageKey = project.diagram_type === 'bpmn' ? 'generatedBpmn' : project.diagram_type === 'pid' ? 'generatedPid' : 'generatedDmn';
    localStorage.setItem(storageKey, project.bpmn_xml);
    localStorage.setItem('diagramType', project.diagram_type);
    localStorage.setItem('currentProjectId', project.id);

    const route = project.diagram_type === 'bpmn' ? '/bpmn-generator' : project.diagram_type === 'pid' ? '/pid-generator' : '/dmn-generator';
    navigateWithSubdomain(navigate, route);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-20">
        <PageContainer>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Projects</h1>
              <p className="text-muted-foreground">Manage your diagrams and processes</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadProjects}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "bpmn" | "pid" | "dmn")}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="bpmn">BPMN</SelectItem>
              <SelectItem value="pid">P&ID</SelectItem>
              <SelectItem value="dmn">DMN</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigateWithSubdomain(navigate, '/bpmn-generator')}>
            <FileText className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {project.diagram_type === 'bpmn' ? (
                        <Workflow className="h-6 w-6 text-primary flex-shrink-0" />
                      ) : project.diagram_type === 'pid' ? (
                        <Factory className="h-6 w-6 text-primary flex-shrink-0" />
                      ) : (
                        <Gauge className="h-6 w-6 text-primary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                        <CardDescription>
                          {new Date(project.created_at).toLocaleDateString()}
                        </CardDescription>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant={project.diagram_type === 'bpmn' ? 'default' : 'secondary'} className="ml-2 flex-shrink-0">
                      {project.diagram_type.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(project)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground text-center mb-6">
                {searchQuery || filterType !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first diagram to get started"}
              </p>
              <Button onClick={() => navigateWithSubdomain(navigate, '/bpmn-generator')}>
                <FileText className="h-4 w-4 mr-2" />
                Create New Project
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{projectToDelete?.name}". This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </div>
  );
};

export default Projects;

