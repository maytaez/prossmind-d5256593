import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Workflow, Factory, Building2, Cog, ShoppingCart, Users, Loader2, Upload, FileUp } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import { navigateWithSubdomain } from "@/utils/subdomain";
import { getTemplates, useTemplate, createTemplate } from "@/utils/templates-service";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import { featureFlags } from "@/config/featureFlags";
import { useAdminStatus } from "@/hooks/useAdminStatus";


type Template = Database["public"]["Tables"]["templates"]["Row"];
type TemplateInsert = Database["public"]["Tables"]["templates"]["Insert"];

interface TemplatesProps {
  user: User;
}

// Constants for template creation
const categories = ["Business", "E-Commerce", "Finance", "IT", "Manufacturing", "Utilities"];
const diagramTypes = ["bpmn", "pid"];
const iconNames = ["Users", "ShoppingCart", "Building2", "Cog", "Factory", "Workflow"];

// Icon mapping from icon_name to Lucide icon component
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  ShoppingCart,
  Building2,
  Cog,
  Factory,
  Workflow,
};

const getIcon = (iconName: string | null) => {
  if (!iconName) return Workflow;
  return iconMap[iconName] || Workflow;
};

const Templates = ({ user }: TemplatesProps) => {
  const navigate = useNavigate();
  const { isAdmin } = useAdminStatus(user);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload template state
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Partial<TemplateInsert>>({
    name: "",
    description: "",
    category: "Business",
    diagram_type: "bpmn",
    bpmn_xml: "",
    icon_name: "Workflow",
    is_active: true,
  });

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await getTemplates();
    
    if (fetchError) {
      setError(fetchError.message);
      toast.error("Failed to load templates");
    } else if (data) {
      // Filter out P&ID templates if feature flag is disabled
      const filteredData = featureFlags.enablePidDiagrams 
        ? data 
        : data.filter(t => t.diagram_type !== 'pid');
      setTemplates(filteredData);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const templateCategories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const handleUseTemplate = async (template: Template) => {
    try {
      const { data: xml, error: useError } = await useTemplate(template.id, user.id);
      
      if (useError || !xml) {
        toast.error("Failed to load template");
        return;
      }

      // Store template XML in localStorage (same pattern as Projects)
      const storageKey = template.diagram_type === 'bpmn' ? 'generatedBpmn' : 'generatedPid';
      localStorage.setItem(storageKey, xml);
      localStorage.setItem('diagramType', template.diagram_type);

      // Navigate to appropriate generator
      if (template.diagram_type === 'bpmn') {
        navigateWithSubdomain(navigate, '/bpmn-generator');
      } else {
        navigateWithSubdomain(navigate, '/pid-generator');
      }

      toast.success("Template loaded successfully!");
    } catch (err) {
      toast.error("Failed to use template");
      console.error(err);
    }
  };

  const handleUploadClick = () => {
    setUploadedFile(null);
    setFormData({
      name: "",
      description: "",
      category: "Business",
      diagram_type: "bpmn",
      bpmn_xml: "",
      icon_name: "Workflow",
      is_active: true,
    });
    setIsUploadDialogOpen(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.bpmn')) {
      toast.error("Please upload a valid XML or BPMN file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    try {
      const xmlContent = await file.text();
      
      // Validate XML structure
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
      const parseError = xmlDoc.querySelector("parsererror");
      
      if (parseError) {
        toast.error("Invalid XML file. Please check the file format.");
        return;
      }

      // Auto-detect diagram type
      let diagramType: "bpmn" | "pid" = "bpmn";
      if (xmlContent.includes("bpmn:definitions") || xmlContent.includes("bpmn2:definitions")) {
        diagramType = "bpmn";
      } else if (xmlContent.includes("P&ID") || xmlContent.includes("pid:") || xmlContent.includes("piping")) {
        diagramType = "pid";
      }

      // Try to extract name from XML (for BPMN)
      let extractedName = "";
      if (diagramType === "bpmn") {
        const processElement = xmlDoc.querySelector("process");
        if (processElement) {
          extractedName = processElement.getAttribute("name") || "";
        }
      }

      // Auto-populate form with extracted data
      setUploadedFile(file);
      setFormData(prev => ({
        ...prev,
        bpmn_xml: xmlContent,
        diagram_type: diagramType,
        name: extractedName || file.name.replace(/\.(xml|bpmn)$/, ""),
      }));

      toast.success("File uploaded successfully! Please review and complete the details.");
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Failed to read file. Please try again.");
    }
  };

  const handleUploadSave = async () => {
    if (!formData.name || !formData.bpmn_xml) {
      toast.error("Template name and XML content are required");
      return;
    }

    if (!formData.category) {
      toast.error("Please select a category");
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

    const { error } = await createTemplate(templateData);
    if (error) {
      toast.error("Failed to create template");
    } else {
      toast.success("Template uploaded successfully!");
      setIsUploadDialogOpen(false);
      setUploadedFile(null);
      loadTemplates(); // Refresh the templates list
    }
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

  if (error) {
    return (
      <div className="min-h-screen bg-background pt-24 pb-20">
        <PageContainer>
          <Card className="hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Workflow className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Error loading templates</h3>
              <p className="text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Templates</h1>
          <p className="text-muted-foreground">Start with a pre-built process template</p>
        </div>

        {/* Category Filter */}
        {templateCategories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {templateCategories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(category)}
                className="capitalize"
              >
                {category}
              </Button>
            ))}
          </div>
        )}

        {/* Templates Grid */}
        {filteredTemplates.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => {
              const Icon = getIcon(template.icon_name);
              return (
                <Card key={template.id} className="flex flex-col hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300">
                  <CardHeader className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <Icon className="h-8 w-8 text-primary flex-shrink-0" />
                      <Badge variant={template.diagram_type === 'bpmn' ? 'default' : 'secondary'}>
                        {template.diagram_type.toUpperCase()}
                      </Badge>
                    </div>
                    <CardTitle className="mb-2 min-h-[3rem]">{template.name}</CardTitle>
                    <CardDescription className="min-h-[4.5rem] max-h-[4.5rem] overflow-hidden">
                      <div className="line-clamp-3">
                        {template.description || 'No description available'}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="capitalize flex-shrink-0">
                        {template.category}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleUseTemplate(template)}
                        className="flex-shrink-0"
                      >
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Upload Template Card - Available to All Users */}
            <Card 
              onClick={handleUploadClick}
              className="flex flex-col hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-pointer border-dashed border-2 hover:border-primary/50"
            >
              <CardHeader className="flex-1">
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="mb-2 text-center">Upload New Template</CardTitle>
                  <CardDescription className="text-center">
                    Add a custom BPMN or P&ID template
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="capitalize">
                    Add Template
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card 
              onClick={handleUploadClick}
              className="flex flex-col hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05),0_0_20px_hsl(var(--primary)/0.3)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 cursor-pointer border-dashed border-2 hover:border-primary/50"
            >
              <CardHeader className="flex-1">
                <div className="flex flex-col items-center justify-center h-full py-8">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <CardTitle className="mb-2 text-center">Upload New Template</CardTitle>
                  <CardDescription className="text-center">
                    Add a custom BPMN or P&ID template
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-auto pt-0">
                <div className="flex items-center justify-center">
                  <Badge variant="outline" className="capitalize">
                    Add Template
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upload Template Dialog */}
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload New Template</DialogTitle>
              <DialogDescription>
                Upload a BPMN or P&ID XML file and provide template details
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* File Upload Section */}
              <div className="grid gap-2">
                <Label>Upload XML File *</Label>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-primary/50 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,.bpmn"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <FileUp className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium mb-1">
                      {uploadedFile ? uploadedFile.name : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      XML or BPMN files (max 5MB)
                    </p>
                  </label>
                </div>
                {uploadedFile && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="h-2 w-2 rounded-full bg-green-600" />
                    File loaded: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
                  </div>
                )}
              </div>

              {/* Template Details */}
              <div className="grid gap-4 border-t pt-4">
                <h3 className="font-semibold text-sm">Template Details</h3>
                
                <div className="grid gap-2">
                  <Label htmlFor="upload-name">Template Name *</Label>
                  <Input
                    id="upload-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Customer Onboarding Process"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="upload-description">Short Description</Label>
                  <Textarea
                    id="upload-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of what this template does..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="upload-category">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger id="upload-category">
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
                    <Label htmlFor="upload-diagram-type">Diagram Type *</Label>
                    <Select
                      value={formData.diagram_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, diagram_type: value as "bpmn" | "pid" })
                      }
                    >
                      <SelectTrigger id="upload-diagram-type">
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
                  <Label htmlFor="upload-icon">Icon</Label>
                  <Select
                    value={formData.icon_name || "Workflow"}
                    onValueChange={(value) => setFormData({ ...formData, icon_name: value })}
                  >
                    <SelectTrigger id="upload-icon">
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

                {/* XML Preview */}
                {formData.bpmn_xml && (
                  <div className="grid gap-2">
                    <Label>XML Content Preview</Label>
                    <div className="bg-muted p-3 rounded-md max-h-32 overflow-y-auto">
                      <code className="text-xs font-mono">
                        {formData.bpmn_xml.substring(0, 200)}...
                      </code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total size: {formData.bpmn_xml.length} characters
                    </p>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUploadSave} disabled={!formData.bpmn_xml || !formData.name}>
                Upload Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </div>
  );
};

export default Templates;

