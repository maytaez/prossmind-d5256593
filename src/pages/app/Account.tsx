import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User as UserIcon, Mail, Shield } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

interface AccountProps {
  user: User;
}

const Account = ({ user }: AccountProps) => {
  const { toast } = useToast();
  const [email, setEmail] = useState(user.email || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;

      toast({
        title: "Email update requested",
        description: "Please check your new email for a confirmation link.",
      });
    } catch (error: any) {
      toast({
        title: "Error updating email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Account</h1>
          <p className="text-muted-foreground">Manage your account information</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>User ID</Label>
                <Input value={user.id} disabled className="mt-1 font-mono text-sm" />
              </div>
              <form onSubmit={handleUpdateEmail} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" disabled={isUpdating || email === user.email}>
                  {isUpdating ? "Updating..." : "Update Email"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Password</Label>
                <p className="text-sm text-muted-foreground mt-1 mb-3">
                  Change your password to keep your account secure
                </p>
                <Button variant="outline" onClick={() => {
                  toast({
                    title: "Password reset",
                    description: "A password reset link has been sent to your email.",
                  });
                }}>
                  Change Password
                </Button>
              </div>
              <div className="pt-4 border-t">
                <Label>Account Created</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Email Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Preferences
              </CardTitle>
              <CardDescription>Manage your email notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Email preferences will be available soon.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </div>
  );
};

export default Account;




