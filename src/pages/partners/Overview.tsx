import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, Store, FileText, GraduationCap } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

const PartnersOverview = () => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Partner Program</h1>
          <p className="text-xl text-muted-foreground">
            Join our partner ecosystem and grow your business
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/marketplace'}>
            <CardHeader>
              <Store className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Marketplace</CardTitle>
              <CardDescription>Integration marketplace</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/resources'}>
            <CardHeader>
              <FileText className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Resources</CardTitle>
              <CardDescription>Partner resources</CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/training'}>
            <CardHeader>
              <GraduationCap className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Training</CardTitle>
              <CardDescription>Partner training</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Handshake className="h-8 w-8 text-primary mb-2" />
              <CardTitle>Become a Partner</CardTitle>
              <CardDescription>Join our partner program</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Apply Now</Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
};

export default PartnersOverview;




