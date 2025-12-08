import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import DataStory from "@/components/DataStory";
import FeatureCards from "@/components/FeatureCards";
import ProductTiers from "@/components/ProductTiers";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import TrustStrip from "@/components/TrustStrip";
import CookieConsent from "@/components/CookieConsent";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

  // Render marketing content only - product features moved to app subdomain
  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <TrustStrip />
      <Hero />
      <DataStory />
      <FeatureCards />
      <ProductTiers />
      <ChatBot />
      <Footer />
      <CookieConsent />
    </div>
  );
};

export default Index;
