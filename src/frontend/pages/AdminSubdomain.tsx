import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import AdminDashboard from "./admin/Dashboard";
import Organization from "./admin/Organization";
import Users from "./admin/Users";
import Billing from "./admin/Billing";
import Security from "./admin/Security";
import AuditLogs from "./admin/AuditLogs";
import TemplateManagement from "./admin/TemplateManagement";
import { useAdminStatus } from "@/hooks/useAdminStatus";

const AdminSubdomain = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin } = useAdminStatus(user);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <Routes>
        <Route path="/" element={<AdminDashboard user={user} />} />
        <Route path="/organization" element={<Organization user={user} />} />
        <Route path="/users" element={<Users user={user} />} />
        <Route path="/billing" element={<Billing user={user} />} />
        <Route path="/security" element={<Security user={user} />} />
        <Route path="/audit-logs" element={<AuditLogs user={user} />} />
        <Route path="/templates" element={<TemplateManagement user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export default AdminSubdomain;



