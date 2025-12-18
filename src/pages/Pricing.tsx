import Navigation from "@/components/Navigation";
import ProductTiers from "@/components/ProductTiers";
import PricingComparisonTable from "@/components/PricingComparisonTable";
import { Check } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import { typography } from "@/utils/typography";

const Pricing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <PageContainer>
          <div className="mb-16">
            <div className="max-w-3xl">
              <h1 className={typography.pageHeading}>
                Simple, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Transparent</span> Pricing
              </h1>
              <p className={`${typography.bodyLarge} text-muted-foreground`}>
                Choose the plan that fits your needs. All plans include our core automation features.
              </p>
            </div>
          </div>

          <ProductTiers />
          
          <PricingComparisonTable />

          <div className="mt-20 bg-muted/30 rounded-2xl p-12">
            <div className="max-w-3xl mb-8">
              <h2 className={typography.sectionHeading}>All Plans Include</h2>
              <p className="text-muted-foreground">Every plan comes with these essential features</p>
            </div>
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
