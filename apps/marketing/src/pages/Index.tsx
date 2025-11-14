import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import FeatureCards from "@/components/FeatureCards";
import ProductTiers from "@/components/ProductTiers";
import ChatBot from "@/components/ChatBot";
import Footer from "@/components/Footer";
import TrustStrip from "@/components/TrustStrip";
import AnimatedSection from "@/components/AnimatedSection";

const Index = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <TrustStrip />
      <main id="main-content" tabIndex={-1}>
        <AnimatedSection variant="fade-in">
          <Hero />
        </AnimatedSection>
        <AnimatedSection variant="fade-up" delay={0.1}>
          <FeatureCards />
        </AnimatedSection>
        <AnimatedSection variant="fade-up" delay={0.2}>
          <ProductTiers />
        </AnimatedSection>
        <AnimatedSection variant="fade-up" delay={0.3}>
          <ChatBot />
        </AnimatedSection>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
