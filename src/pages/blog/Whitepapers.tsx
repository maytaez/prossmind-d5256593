import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";

const Whitepapers = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Whitepapers</h1>
          <p className="text-xl text-muted-foreground">
            In-depth research and analysis on process automation
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground py-12">
              Whitepapers coming soon. Check back later for detailed research and insights.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
};

export default Whitepapers;



