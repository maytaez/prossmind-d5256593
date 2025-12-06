import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProjectNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => void;
  diagramType?: "bpmn" | "pid" | "dmn";
  defaultName?: string;
  defaultDescription?: string;
  isLoading?: boolean;
}

export function ProjectNameDialog({
  open,
  onOpenChange,
  onSave,
  diagramType = "bpmn",
  defaultName = "",
  defaultDescription = "",
  isLoading = false,
}: ProjectNameDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setName(defaultName || "");
      setDescription(defaultDescription || "");
    }
  }, [open, defaultName, defaultDescription]);

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }
    onSave(name.trim(), description.trim());
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  const diagramTypeName = diagramType === "bpmn" ? "BPMN" : diagramType === "pid" ? "P&ID" : "DMN";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save {diagramTypeName} Project</DialogTitle>
          <DialogDescription>
            Give your project a name and optional description to save it to your workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-name"
              placeholder={`My ${diagramTypeName} Diagram`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave();
                }
              }}
              maxLength={100}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description (Optional)</Label>
            <Textarea
              id="project-description"
              placeholder="Add a description for your project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? "Saving..." : "Save Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



