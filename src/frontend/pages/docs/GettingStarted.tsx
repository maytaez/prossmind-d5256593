import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, ArrowRight, CheckCircle } from "lucide-react";
import { navigateToApp } from "@/utils/subdomain";

const GettingStarted = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Getting Started</h1>
        <p className="text-xl text-muted-foreground">
          Welcome to ProssMind! Learn how to create your first BPMN or P&ID diagram.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Quick Start
            </CardTitle>
            <CardDescription>Get up and running in minutes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li>Sign up for a free account</li>
              <li>Choose your diagram type (BPMN or P&ID)</li>
              <li>Describe your process or upload an image</li>
              <li>Download your generated diagram</li>
            </ol>
            <Button onClick={() => navigateToApp('/auth')} className="w-full">
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What You Get</CardTitle>
            <CardDescription>Features included in your free account</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>5 free diagram generations</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>BPMN and P&ID diagram support</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Vision AI image conversion</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Export to standard formats</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Ready to create your first diagram? Check out our guides and tutorials to learn more about
            creating professional process diagrams with ProssMind.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigateToApp('/dashboard')}>
              Go to Dashboard
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/guides'}>
              View Guides
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GettingStarted;





