import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Workflow, Factory, Eye, FileText } from "lucide-react";

const Guides = () => {
  const guides = [
    {
      title: "BPMN Diagram Guide",
      description: "Learn how to create effective business process models",
      icon: Workflow,
      topics: ["Elements and symbols", "Swimlanes and pools", "Gateways and events", "Best practices"],
    },
    {
      title: "P&ID Diagram Guide",
      description: "Master piping and instrumentation diagrams",
      icon: Factory,
      topics: ["Equipment symbols", "Instrumentation tags", "Piping connections", "ISA standards"],
    },
    {
      title: "Vision AI Guide",
      description: "Convert images and documents to diagrams",
      icon: Eye,
      topics: ["Supported formats", "Image requirements", "Processing tips", "Troubleshooting"],
    },
    {
      title: "Export and Integration",
      description: "Export diagrams and integrate with other tools",
      icon: FileText,
      topics: ["Export formats", "SAP Signavio", "Camunda", "Flowable"],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">User Guides</h1>
        <p className="text-xl text-muted-foreground">
          Comprehensive guides to help you get the most out of ProssMind.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {guides.map((guide) => {
          const Icon = guide.icon;
          return (
            <Card key={guide.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {guide.title}
                </CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {guide.topics.map((topic, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      • {topic}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Guides;



