import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";

const ApiPlayground = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">API Playground</h1>
          <p className="text-xl text-muted-foreground">
            Test API endpoints interactively
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Interactive Playground</CardTitle>
            <CardDescription>API playground coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              An interactive API playground will be available here. Check back soon!
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
};

export default ApiPlayground;





