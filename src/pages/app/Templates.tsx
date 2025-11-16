import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Workflow, Factory, Building2, Cog, ShoppingCart, Users, Loader2 } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import { navigateWithSubdomain } from "@/utils/subdomain";
import { getTemplates, useTemplate } from "@/utils/templates-service";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type Template = Database["public"]["Tables"]["templates"]["Row"];

interface TemplatesProps {
  user: User;
}

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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplates = async () => {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await getTemplates();
      
      if (fetchError) {
        setError(fetchError.message);
        toast.error("Failed to load templates");
      } else if (data) {
        setTemplates(data);
      }
      setIsLoading(false);
    };

    loadTemplates();
  }, []);

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

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
          <Card>
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
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((category) => (
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
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Icon className="h-8 w-8 text-primary" />
                      <Badge variant={template.diagram_type === 'bpmn' ? 'default' : 'secondary'}>
                        {template.diagram_type.toUpperCase()}
                      </Badge>
                    </div>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description || 'No description available'}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {template.category}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleUseTemplate(template)}
                      >
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Workflow className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground">Try selecting a different category</p>
            </CardContent>
          </Card>
        )}
      </PageContainer>
    </div>
  );
};

export default Templates;

