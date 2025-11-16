import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";

const CaseStudies = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Case Studies</h1>
          <p className="text-xl text-muted-foreground">
            Real-world examples of ProssMind in action
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-12">
              Case studies coming soon. Check back later for customer success stories.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
};

export default CaseStudies;



