import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";

const comparisonFeatures = [
  {
    category: "Core Features",
    features: [
      { name: "Basic automation", light: true, vision: true, custom: true },
      { name: "Process limit", light: "5", vision: "Unlimited", custom: "Unlimited" },
      { name: "Vision automation", light: false, vision: true, custom: true },
      { name: "Custom AI models", light: false, vision: false, custom: true },
    ],
  },
  {
    category: "Support & Services",
    features: [
      { name: "Community support", light: true, vision: true, custom: true },
      { name: "Priority support", light: false, vision: true, custom: true },
      { name: "Dedicated support", light: false, vision: false, custom: true },
      { name: "Training & consulting", light: false, vision: false, custom: true },
    ],
  },
  {
    category: "Analytics & Integrations",
    features: [
      { name: "Basic analytics", light: true, vision: true, custom: true },
      { name: "Advanced analytics", light: false, vision: true, custom: true },
      { name: "Custom integrations", light: false, vision: true, custom: true },
    ],
  },
  {
    category: "Deployment & Security",
    features: [
      { name: "Cloud deployment", light: true, vision: true, custom: true },
      { name: "On-premise deployment", light: false, vision: false, custom: true },
      { name: "SLA guarantee", light: false, vision: false, custom: true },
    ],
  },
];

const PricingComparisonTable = () => {
  const renderCell = (value: boolean | string) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="h-5 w-5 text-primary mx-auto" />
      ) : (
        <X className="h-5 w-5 text-muted-foreground mx-auto" />
      );
    }
    return <span className="text-sm font-medium">{value}</span>;
  };

  return (
    <div className="mt-20">
      <div className="mb-12">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold mb-4">Compare Plans</h2>
          <p className="text-lg text-muted-foreground">
            Detailed feature comparison across all pricing tiers
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="text-left p-4 font-semibold">Features</th>
                <th className="text-center p-4 font-semibold">Light</th>
                <th className="text-center p-4 font-semibold bg-primary/10">
                  Vision
                  <div className="text-xs font-normal text-muted-foreground mt-1">
                    Most Popular
                  </div>
                </th>
                <th className="text-center p-4 font-semibold">Custom</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFeatures.map((category, catIdx) => (
                <>
                  <tr key={`cat-${catIdx}`} className="border-t border-border">
                    <td
                      colSpan={4}
                      className="p-4 font-semibold text-sm bg-muted/30"
                    >
                      {category.category}
                    </td>
                  </tr>
                  {category.features.map((feature, featIdx) => (
                    <tr
                      key={`feat-${catIdx}-${featIdx}`}
                      className="border-t border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-4 text-sm">{feature.name}</td>
                      <td className="p-4 text-center">
                        {renderCell(feature.light)}
                      </td>
                      <td className="p-4 text-center bg-primary/5">
                        {renderCell(feature.vision)}
                      </td>
                      <td className="p-4 text-center">
                        {renderCell(feature.custom)}
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default PricingComparisonTable;
