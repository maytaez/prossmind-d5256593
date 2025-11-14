import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { Button } from "@prossmind/ui/button";

const Templates = () => {
  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Templates</h1>
          <p className="text-muted-foreground">Browse and use process templates</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Customer Onboarding</CardTitle>
              <CardDescription>Standard customer onboarding process</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Use Template</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order Fulfillment</CardTitle>
              <CardDescription>E-commerce order processing workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Use Template</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Ticket Resolution</CardTitle>
              <CardDescription>Customer support workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Use Template</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Templates;




