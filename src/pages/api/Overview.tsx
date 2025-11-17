import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Key, Book, Play } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import { navigateToApp } from "@/utils/subdomain";

const ApiOverview = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">API Overview</h1>
          <p className="text-xl text-muted-foreground">
            Integrate ProssMind into your applications with our REST API
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Authentication
              </CardTitle>
              <CardDescription>Get started with API keys</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                All API requests require authentication using an API key. Generate your API key in your account settings.
              </p>
              <Button onClick={() => navigateToApp('/settings')}>
                Generate API Key
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                Base URL
              </CardTitle>
              <CardDescription>API endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                <code>https://api.prossmind.com/v1</code>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/reference'}>
            <CardHeader>
              <Book className="h-8 w-8 text-primary mb-2" />
              <CardTitle>API Reference</CardTitle>
              <CardDescription>Complete API documentation</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/sdks'}>
            <CardHeader>
              <Code className="h-8 w-8 text-primary mb-2" />
              <CardTitle>SDKs</CardTitle>
              <CardDescription>Client libraries and tools</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/playground'}>
            <CardHeader>
              <Play className="h-8 w-8 text-primary mb-2" />
              <CardTitle>API Playground</CardTitle>
              <CardDescription>Test API endpoints</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
};

export default ApiOverview;




