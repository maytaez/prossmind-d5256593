import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Key } from "lucide-react";

const ApiReference = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Integrate ProssMind into your applications using our REST API.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Authentication
          </CardTitle>
          <CardDescription>API authentication and authorization</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            All API requests require authentication using an API key. You can generate API keys in your account settings.
          </p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            <code>Authorization: Bearer YOUR_API_KEY</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Endpoints
          </CardTitle>
          <CardDescription>Available API endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            API documentation is coming soon. For now, please use the web interface or contact support for API access.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">POST</span>
              <code>/api/v1/diagrams/generate</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">GET</span>
              <code>/api/v1/diagrams/{'{id}'}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">GET</span>
              <code>/api/v1/diagrams</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiReference;




