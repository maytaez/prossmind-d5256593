import { useEffect, useState } from "react";
import { Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import Dashboard from "./app/Dashboard";
import Projects from "./app/Projects";
import Templates from "./app/Templates";
import Account from "./app/Account";
import Settings from "./app/Settings";
import TryProssMe from "@/components/TryProssMe";
import VisionAI from "./VisionAI";
import Auth from "./Auth";
import { navigateWithSubdomain, getSubdomainQuery } from "@/utils/subdomain";

const AppSubdomain = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
        
        // Redirect to auth if not logged in (except on auth route)
        if (!session?.user && !location.pathname.includes('/auth')) {
          navigateWithSubdomain(navigate, '/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      // Redirect to auth if not logged in (except on auth route)
      if (!session?.user && !location.pathname.includes('/auth')) {
        navigateWithSubdomain(navigate, '/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  // Show loading state while checking auth
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

  const subdomainQuery = getSubdomainQuery();
  const authPath = `/auth${subdomainQuery}`;
  const dashboardPath = `/dashboard${subdomainQuery}`;

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route 
          path="/" 
          element={user ? <Dashboard user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/dashboard" 
          element={user ? <Dashboard user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/projects" 
          element={user ? <Projects user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/bpmn-generator" 
          element={user ? <TryProssMe user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/pid-generator" 
          element={user ? <TryProssMe user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/vision-ai" 
          element={user ? <VisionAI /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/templates" 
          element={user ? <Templates user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/account" 
          element={user ? <Account user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route 
          path="/settings" 
          element={user ? <Settings user={user} /> : <Navigate to={authPath} replace />} 
        />
        <Route path="*" element={<Navigate to={dashboardPath} replace />} />
      </Routes>
    </div>
  );
};

export default AppSubdomain;

