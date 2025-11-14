import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@prossmind/shared/config";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { Button } from "@prossmind/ui/button";
import { Input } from "@prossmind/ui/input";
import { Label } from "@prossmind/ui/label";

const Account = () => {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setEmail(user?.email || "");
    });
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">Manage your account information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>
            <Button>Update Profile</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Account;




