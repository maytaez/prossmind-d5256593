import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PageContainer from "@/components/layout/PageContainer";

const ApiReference = () => {
  const endpoints = [
    {
      method: "POST",
      path: "/diagrams/generate",
      description: "Generate a BPMN or P&ID diagram from a text description",
    },
    {
      method: "GET",
      path: "/diagrams/{id}",
      description: "Retrieve a diagram by ID",
    },
    {
      method: "GET",
      path: "/diagrams",
      description: "List all diagrams for the authenticated user",
    },
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">API Reference</h1>
          <p className="text-xl text-muted-foreground">
            Complete reference for all API endpoints
          </p>
        </div>

        <div className="space-y-6">
          {endpoints.map((endpoint, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge variant={endpoint.method === "POST" ? "default" : "secondary"}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-lg">{endpoint.path}</code>
                </div>
                <CardDescription>{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Full API documentation coming soon. For now, please use the web interface or contact support for API access.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContainer>
    </div>
  );
};

export default ApiReference;



