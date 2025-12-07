import Navigation from "@/components/Navigation";
import StatusIndicator from "@/components/status/StatusIndicator";
import IncidentList from "@/components/status/IncidentList";
import SubscribeForm from "@/components/status/SubscribeForm";
import PageContainer from "@/components/layout/PageContainer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const StatusSubdomain = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="pt-24 pb-20">
        <PageContainer>
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Service Status</h1>
            <p className="text-xl text-muted-foreground">
              Real-time status of ProssMind services
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Current operational status</CardDescription>
              </CardHeader>
              <CardContent>
                <StatusIndicator />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscribe to Updates</CardTitle>
                <CardDescription>Get notified about service incidents</CardDescription>
              </CardHeader>
              <CardContent>
                <SubscribeForm />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Incident History</CardTitle>
              <CardDescription>Past incidents and maintenance windows</CardDescription>
            </CardHeader>
            <CardContent>
              <IncidentList />
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    </div>
  );
};

export default StatusSubdomain;





