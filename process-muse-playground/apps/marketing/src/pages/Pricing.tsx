import Navigation from "@/components/Navigation";
import ProductTiers from "@/components/ProductTiers";
import { Check } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <PageContainer>
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">
              Simple, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Transparent</span> Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Choose the plan that fits your needs. All plans include our core automation features.
            </p>
          </div>

          <ProductTiers />

          <div className="mt-20 bg-muted/30 rounded-2xl p-12">
            <h2 className="text-3xl font-bold text-center mb-12">All Plans Include</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">99.9% Uptime SLA</h3>
                  <p className="text-sm text-muted-foreground">Reliable service you can count on</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">24/7 Support</h3>
                  <p className="text-sm text-muted-foreground">Help whenever you need it</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Free Updates</h3>
                  <p className="text-sm text-muted-foreground">Always get the latest features</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">Data Encryption</h3>
                  <p className="text-sm text-muted-foreground">Bank-level security for your data</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">API Access</h3>
                  <p className="text-sm text-muted-foreground">Integrate with your tools</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold mb-2">No Hidden Fees</h3>
                  <p className="text-sm text-muted-foreground">What you see is what you pay</p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </main>
    </div>
  );
};

export default Pricing;
