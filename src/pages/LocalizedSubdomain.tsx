import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Workflow, Factory, Eye, ArrowRight } from "lucide-react";
import { navigateToApp } from "@/utils/subdomain";
import PageContainer from "@/components/layout/PageContainer";

interface LocalizedSubdomainProps {
  language: 'de' | 'fr';
}

const LocalizedSubdomain = ({ language }: LocalizedSubdomainProps) => {
  const navigate = useNavigate();
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

  // For now, render the same content as main domain
  // In a full implementation, this would use i18n translations
  const translations: Record<string, Record<string, string>> = {
    de: {
      title: "Bereit loszulegen?",
      description: "Erstellen Sie professionelle BPMN- und P&ID-Diagramme mit KI-gestützter Automatisierung",
      tryFree: "Kostenlos testen",
    },
    fr: {
      title: "Prêt à commencer?",
      description: "Créez des diagrammes BPMN et P&ID professionnels avec l'automatisation alimentée par l'IA",
      tryFree: "Essayer gratuitement",
    },
  };

  const t = translations[language] || translations.de;

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <TrustStrip />
      <Hero />
      <DataStory />
      
      <section className="py-20 bg-muted/30">
        <PageContainer>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">{t.title}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t.description}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigateToApp('/bpmn-generator')}>
              <CardHeader>
                <Workflow className="h-10 w-10 text-primary mb-4" />
                <CardTitle>BPMN Diagramme</CardTitle>
                <CardDescription>Erstellen Sie Geschäftsprozessmodelle</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigateToApp('/bpmn-generator'); }}>
                  BPMN-Generator testen
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigateToApp('/pid-generator')}>
              <CardHeader>
                <Factory className="h-10 w-10 text-primary mb-4" />
                <CardTitle>P&ID Diagramme</CardTitle>
                <CardDescription>Entwerfen Sie Rohrleitungs- und Instrumentierungsdiagramme</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigateToApp('/pid-generator'); }}>
                  P&ID-Generator testen
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigateToApp('/vision-ai')}>
              <CardHeader>
                <Eye className="h-10 w-10 text-primary mb-4" />
                <CardTitle>Vision AI</CardTitle>
                <CardDescription>Konvertieren Sie Bilder in Diagramme</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={(e) => { e.stopPropagation(); navigateToApp('/vision-ai'); }}>
                  Vision AI testen
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button 
              size="lg" 
              className="text-lg px-8"
              onClick={() => navigateToApp(user ? '/dashboard' : '/auth')}
            >
              {user ? 'Zum Dashboard' : t.tryFree}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Keine Kreditkarte erforderlich • 5 kostenlose Prompts enthalten
            </p>
          </div>
        </PageContainer>
      </section>

      <FeatureCards />
      <ProductTiers />
      <ChatBot />
      <Footer />
    </div>
  );
};

export default LocalizedSubdomain;





