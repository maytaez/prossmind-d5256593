import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Users, Key } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

interface OrganizationProps {
  user: User;
}

const Organization = ({ user }: OrganizationProps) => {
  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Organization Settings</h1>
          <p className="text-muted-foreground">Manage your organization configuration</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Details
              </CardTitle>
              <CardDescription>Basic organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="orgName">Organization Name</Label>
                <Input id="orgName" defaultValue="Your Organization" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="orgEmail">Contact Email</Label>
                <Input id="orgEmail" type="email" defaultValue={user.email} className="mt-1" />
              </div>
              <Button>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Single Sign-On (SSO)
              </CardTitle>
              <CardDescription>Configure SSO for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                SSO configuration allows your organization to use your identity provider for authentication.
              </p>
              <Button variant="outline">Configure SSO</Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
};

export default Organization;



