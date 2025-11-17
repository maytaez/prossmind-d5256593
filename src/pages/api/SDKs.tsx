import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

const ApiSDKs = () => {
  const sdks = [
    { name: "JavaScript/TypeScript", version: "1.0.0", language: "npm" },
    { name: "Python", version: "1.0.0", language: "pip" },
    { name: "Go", version: "1.0.0", language: "go get" },
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">SDKs & Libraries</h1>
          <p className="text-xl text-muted-foreground">
            Client libraries for popular programming languages
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sdks.map((sdk) => (
            <Card key={sdk.name}>
              <CardHeader>
                <CardTitle>{sdk.name}</CardTitle>
                <CardDescription>Version {sdk.version}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-lg font-mono text-sm mb-4">
                  <code>{sdk.language} install prossmind-sdk</code>
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PageContainer>
    </div>
  );
};

export default ApiSDKs;




