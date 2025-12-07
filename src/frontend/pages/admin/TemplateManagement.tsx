import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Search, Trash2, Edit, Plus, Eye, Loader2 } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import {
  getAllTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/utils/templates-service";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Template = Database["public"]["Tables"]["templates"]["Row"];
type TemplateInsert = Database["public"]["Tables"]["templates"]["Insert"];

interface TemplateManagementProps {
  user: User;
}

const categories = ["Business", "E-Commerce", "Finance", "IT", "Manufacturing", "Utilities"];
const diagramTypes = ["bpmn", "pid"];
const iconNames = ["Users", "ShoppingCart", "Building2", "Cog", "Factory", "Workflow"];

const TemplateManagement = ({ user }: TemplateManagementProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewXml, setPreviewXml] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState<Partial<TemplateInsert>>({
    name: "",
    description: "",
    category: "Business",
    diagram_type: "bpmn",
    bpmn_xml: "",
    icon_name: "Workflow",
    is_active: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await getAllTemplates();
    if (error) {
      toast.error("Failed to load templates");
    } else if (data) {
      setTemplates(data);
    }
    setIsLoading(false);
  };

  const handleCreate = () => {
    setSelectedTemplate(null);
    setFormData({
      name: "",
      description: "",
      category: "Business",
      diagram_type: "bpmn",
      bpmn_xml: "",
      icon_name: "Workflow",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category,
      diagram_type: template.diagram_type as "bpmn" | "pid",
      bpmn_xml: template.bpmn_xml,
      icon_name: template.icon_name || "Workflow",
      is_active: template.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (template: Template) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedTemplate) return;

    const { error } = await deleteTemplate(selectedTemplate.id);
    if (error) {
      toast.error("Failed to delete template");
    } else {
      toast.success("Template deleted successfully");
      loadTemplates();
    }
    setIsDeleteDialogOpen(false);
    setSelectedTemplate(null);
  };

  const handlePreview = (template: Template) => {
    setPreviewXml(template.bpmn_xml);
    setIsPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.bpmn_xml) {
      toast.error("Name and XML are required");
      return;
    }

    const templateData: TemplateInsert = {
      name: formData.name,
      description: formData.description || null,
      category: formData.category!,
      diagram_type: formData.diagram_type!,
      bpmn_xml: formData.bpmn_xml,
      icon_name: formData.icon_name || null,
      is_active: formData.is_active ?? true,
      created_by: user.id,
    };

    if (selectedTemplate) {
      // Update existing
      const { error } = await updateTemplate(selectedTemplate.id, templateData);
      if (error) {
        toast.error("Failed to update template");
      } else {
        toast.success("Template updated successfully");
        setIsDialogOpen(false);
        loadTemplates();
      }
    } else {
      // Create new
      const { error } = await createTemplate(templateData);
      if (error) {
        toast.error("Failed to create template");
      } else {
        toast.success("Template created successfully");
        setIsDialogOpen(false);
        loadTemplates();
      }
    }
  };

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h1 className="text-4xl font-bold mb-2">Template Management</h1>
          <p className="text-muted-foreground">Manage BPMN and P&ID diagram templates</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Templates</CardTitle>
                <CardDescription>Create and manage diagram templates</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    className="pl-10 w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No templates found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.diagram_type === "bpmn" ? "default" : "secondary"}>
                          {template.diagram_type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.usage_count}</TableCell>
                      <TableCell>
                        {new Date(template.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate ? "Edit Template" : "Create New Template"}
              </DialogTitle>
              <DialogDescription>
                {selectedTemplate
                  ? "Update template details and XML content"
                  : "Create a new diagram template"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Template name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Template description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="diagram_type">Diagram Type *</Label>
                  <Select
                    value={formData.diagram_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, diagram_type: value as "bpmn" | "pid" })
                    }
                  >
                    <SelectTrigger id="diagram_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {diagramTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="icon_name">Icon</Label>
                <Select
                  value={formData.icon_name || "Workflow"}
                  onValueChange={(value) => setFormData({ ...formData, icon_name: value })}
                >
                  <SelectTrigger id="icon_name">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconNames.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bpmn_xml">BPMN/PID XML *</Label>
                <Textarea
                  id="bpmn_xml"
                  value={formData.bpmn_xml}
                  onChange={(e) => setFormData({ ...formData, bpmn_xml: e.target.value })}
                  placeholder="Paste BPMN or PID XML here"
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {selectedTemplate ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Template XML Preview</DialogTitle>
              <DialogDescription>View the template XML content</DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                <code>{previewXml}</code>
              </pre>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will deactivate the template "{selectedTemplate?.name}". This action cannot be
                undone, but you can reactivate it later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContainer>
    </div>
  );
};

export default TemplateManagement;



