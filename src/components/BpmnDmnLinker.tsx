import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createDmnLink, getLinksForGateway, deleteDmnLink, type DmnLink } from "@/utils/dmn-links-service";
import { getProjects, type Project } from "@/utils/projects-service";
import { User } from "@supabase/supabase-js";
import { X } from "lucide-react";

interface BpmnDmnLinkerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bpmnProjectId: string;
  gatewayId: string;
  gatewayName?: string;
  user: User | null;
}

export function BpmnDmnLinker({
  open,
  onOpenChange,
  bpmnProjectId,
  gatewayId,
  gatewayName,
  user,
}: BpmnDmnLinkerProps) {
  const [dmnProjects, setDmnProjects] = useState<Project[]>([]);
  const [selectedDmnProject, setSelectedDmnProject] = useState<string>("");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string>("");
  const [existingLinks, setExistingLinks] = useState<DmnLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadDmnProjects();
      loadExistingLinks();
    }
  }, [open, user, bpmnProjectId, gatewayId]);

  const loadDmnProjects = async () => {
    if (!user) return;
    
    setIsLoading(true);
    const { data, error } = await getProjects(user.id, { diagramType: "dmn" });
    if (error) {
      toast.error("Failed to load DMN projects");
    } else if (data) {
      setDmnProjects(data);
    }
    setIsLoading(false);
  };

  const loadExistingLinks = async () => {
    const { data, error } = await getLinksForGateway(bpmnProjectId, gatewayId);
    if (error) {
      console.error("Failed to load existing links:", error);
    } else if (data) {
      setExistingLinks(data);
    }
  };

  const extractDecisionsFromXml = (xml: string): Array<{ id: string; name: string }> => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "application/xml");
      const decisions = doc.querySelectorAll("decision");
      const result: Array<{ id: string; name: string }> = [];
      
      decisions.forEach((decision) => {
        const id = decision.getAttribute("id") || "";
        const name = decision.getAttribute("name") || id;
        result.push({ id, name });
      });
      
      return result;
    } catch (err) {
      console.error("Failed to parse DMN XML:", err);
      return [];
    }
  };

  const handleCreateLink = async () => {
    if (!selectedDmnProject || !selectedDecisionId) {
      toast.error("Please select a DMN project and decision");
      return;
    }

    setIsLoading(true);
    const { data, error } = await createDmnLink({
      project_id: bpmnProjectId,
      bpmn_gateway_id: gatewayId,
      dmn_project_id: selectedDmnProject,
      dmn_decision_id: selectedDecisionId,
    });

    if (error) {
      toast.error("Failed to create link");
    } else {
      toast.success("Link created successfully");
      await loadExistingLinks();
      setSelectedDmnProject("");
      setSelectedDecisionId("");
    }
    setIsLoading(false);
  };

  const handleDeleteLink = async (linkId: string) => {
    setIsLoading(true);
    const { error } = await deleteDmnLink(linkId);
    if (error) {
      toast.error("Failed to delete link");
    } else {
      toast.success("Link deleted successfully");
      await loadExistingLinks();
    }
    setIsLoading(false);
  };

  const selectedProject = dmnProjects.find((p) => p.id === selectedDmnProject);
  const decisions = selectedProject
    ? extractDecisionsFromXml(selectedProject.bpmn_xml)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Link DMN Decision to Gateway
            {gatewayName && `: ${gatewayName}`}
          </DialogTitle>
          <DialogDescription>
            Link this BPMN gateway to a DMN decision table to externalize decision logic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Existing Links */}
          {existingLinks.length > 0 && (
            <div className="space-y-2">
              <Label>Existing Links</Label>
              <div className="space-y-2">
                {existingLinks.map((link) => {
                  const project = dmnProjects.find((p) => p.id === link.dmn_project_id);
                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {project?.name || "Unknown Project"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Decision: {link.dmn_decision_id}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLink(link.id)}
                        disabled={isLoading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Create New Link */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dmn-project">DMN Project</Label>
              <Select
                value={selectedDmnProject}
                onValueChange={(value) => {
                  setSelectedDmnProject(value);
                  setSelectedDecisionId("");
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="dmn-project">
                  <SelectValue placeholder="Select a DMN project" />
                </SelectTrigger>
                <SelectContent>
                  {dmnProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDmnProject && decisions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="dmn-decision">Decision Table</Label>
                <Select
                  value={selectedDecisionId}
                  onValueChange={setSelectedDecisionId}
                  disabled={isLoading}
                >
                  <SelectTrigger id="dmn-decision">
                    <SelectValue placeholder="Select a decision table" />
                  </SelectTrigger>
                  <SelectContent>
                    {decisions.map((decision) => (
                      <SelectItem key={decision.id} value={decision.id}>
                        {decision.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedDmnProject && decisions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No decision tables found in the selected DMN project.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleCreateLink}
            disabled={!selectedDmnProject || !selectedDecisionId || isLoading}
          >
            Create Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}






