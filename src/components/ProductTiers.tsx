import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

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
  },
];

const ProductTiers = () => {
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
            <Card 
              key={index}
              className={`relative card-hover slide-up stagger-${index + 1} flex flex-col h-full transition-all ${
                product.popular 
                  ? "border-primary shadow-2xl scale-105 bg-gradient-to-b from-card to-primary/5 hover:border-primary/80" 
                  : "border-border bg-card/50 backdrop-blur-sm hover:border-primary/50"
              }`}
              role="article"
              aria-label={`Pricing tier: ${product.name}${product.popular ? ' - Most Popular' : ''}`}
            >
              {product.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-semibold px-6 py-2 rounded-full shadow-lg">
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
                  className={`w-full text-base py-6 mt-auto hover:scale-[1.03] transition-all ${
                    product.popular 
                      ? "shadow-lg hover:shadow-xl" 
                      : ""
                  }`}
                  variant={product.popular ? "default" : "outline"}
                  size="lg"
                  aria-label={`Get started with ${product.name}`}
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductTiers;
