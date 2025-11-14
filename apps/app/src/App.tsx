import { Toaster } from "@prossmind/ui/toaster";
import { Toaster as Sonner } from "@prossmind/ui/sonner";
import { TooltipProvider } from "@prossmind/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@prossmind/shared/config";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BpmnGenerator from "./pages/BpmnGenerator";
import PidGenerator from "./pages/PidGenerator";
import Projects from "./pages/Projects";
import Templates from "./pages/Templates";
import Account from "./pages/Account";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {isLoading ? (
              <Route path="*" element={
                <div className="min-h-screen bg-background flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading...</p>
                  </div>
                </div>
              } />
            ) : (
              <>
                <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" replace />} />
                <Route path="/bpmn-generator" element={user ? <BpmnGenerator /> : <Navigate to="/auth" replace />} />
                <Route path="/pid-generator" element={user ? <PidGenerator /> : <Navigate to="/auth" replace />} />
                <Route path="/projects" element={user ? <Projects /> : <Navigate to="/auth" replace />} />
                <Route path="/templates" element={user ? <Templates /> : <Navigate to="/auth" replace />} />
                <Route path="/account" element={user ? <Account /> : <Navigate to="/auth" replace />} />
                <Route path="/settings" element={user ? <Settings /> : <Navigate to="/auth" replace />} />
                <Route path="/" element={<Navigate to={user ? "/dashboard" : "/auth"} replace />} />
                <Route path="*" element={<NotFound />} />
              </>
            )}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

