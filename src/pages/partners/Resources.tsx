import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";

const Resources = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Partner Resources</h1>
          <p className="text-xl text-muted-foreground">
            Download resources and materials for partners
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-12">
              Partner resources coming soon. Check back later for downloadable materials.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
};

export default Resources;



