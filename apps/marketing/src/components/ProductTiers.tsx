import { Button } from "@prossmind/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prossmind/ui/card";
import { Check } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import ContactSalesModal from "@/components/ContactSalesModal";

const products = [
  {
    name: "ProssMind Light",
    description: "Perfect for individuals and small teams",
    features: [
      "Basic automation features",
      "Up to 5 processes",
      "Community support",
      "Basic analytics",
    ],
    cta: "Start Sandbox",
    ctaAction: "sandbox",
  },
  {
    name: "ProssMind Vision",
    description: "Advanced features for growing businesses",
    features: [
      "All Light features",
      "Unlimited processes",
      "Vision automation",
      "Priority support",
      "Advanced analytics",
      "Custom integrations",
    ],
    popular: true,
    cta: "Request Trial",
    ctaAction: "trial",
  },
  {
    name: "Custom Models",
    description: "Enterprise-grade solution",
    features: [
      "All Vision features",
      "Custom AI models",
      "Dedicated support",
      "On-premise deployment",
      "SLA guarantee",
      "Training & consulting",
    ],
    cta: "Contact Sales",
    ctaAction: "sales",
  },
];

const ProductTiers = () => {
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  const handleCtaClick = (action: string) => {
    if (action === "sales") {
      setIsSalesModalOpen(true);
    } else if (action === "trial") {
      // Navigate to auth or show trial signup
      window.location.href = "/auth";
    } else {
      // Sandbox - navigate to main app
      window.location.href = "/";
    }
  };

  return (
    <section className="py-24 bg-background relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 slide-up">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your business needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {products.map((product, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: index * 0.15, ease: [0.4, 0, 0.2, 1] }}
              whileHover={{ y: -10, transition: { duration: 0.3, ease: "easeOut" } }}
            >
              <Card 
                className={`relative flex flex-col h-full transition-all duration-300 group pricing-card-hover ${
                  product.popular 
                    ? "border-primary shadow-2xl scale-105 bg-gradient-to-b from-card to-primary/5 hover:border-primary/80" 
                    : "border-border bg-card/50 backdrop-blur-sm hover:border-primary/50"
                }`}
                role="article"
                aria-label={`Pricing tier: ${product.name}${product.popular ? ' - Most Popular' : ''}`}
              >
              {product.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="badge-pulse bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold px-6 py-2 rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pb-8 pt-8 flex-shrink-0">
                <CardTitle className="text-3xl mb-3 font-bold">{product.name}</CardTitle>
                <CardDescription className="text-base">{product.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex flex-col flex-grow space-y-8">
                <ul className="space-y-4 flex-grow">
                  {product.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-1 flex-shrink-0">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full text-base py-6 mt-auto hover:scale-[1.03] active:scale-[0.98] transition-all ${
                    product.popular 
                      ? "shadow-lg hover:shadow-xl" 
                      : ""
                  }`}
                  variant={product.popular ? "default" : "outline"}
                  size="lg"
                  onClick={() => handleCtaClick(product.ctaAction)}
                  aria-label={`${product.cta} for ${product.name}`}
                >
                  {product.cta}
                </Button>
              </CardContent>
            </Card>
            </motion.div>
          ))}
        </div>
      </div>
      <ContactSalesModal open={isSalesModalOpen} onOpenChange={setIsSalesModalOpen} />
    </section>
  );
};

export default ProductTiers;
