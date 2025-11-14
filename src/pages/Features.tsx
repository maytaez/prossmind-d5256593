import Navigation from "@/components/Navigation";
import { Bot, Workflow, Eye, Zap, Shield, Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageContainer from "@/components/layout/PageContainer";

const featuresDetailed = [
  {
    icon: Bot,
    title: "AI Agent Generator",
    description: "Create intelligent agents that can automate complex workflows and tasks with advanced machine learning capabilities.",
    benefits: ["Natural language processing", "Self-learning algorithms", "Multi-task handling"],
  },
  {
    icon: Workflow,
    title: "Process Generator",
    description: "Design and build automated business processes with powerful AI capabilities and intuitive visual tools. Download BPMN diagrams and integrate seamlessly with SAP Signavio, Camunda, Flowable, and more.",
    benefits: ["Visual process builder", "Real-time monitoring", "Automatic optimization", "Export BPMN diagrams", "Integration with SAP Signavio, Camunda, Flowable"],
  },
  {
    icon: Eye,
    title: "Vision Automation",
    description: "Automate visual tasks with advanced computer vision and image processing powered by state-of-the-art AI.",
    benefits: ["Image recognition", "OCR capabilities", "Video analysis"],
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Process automation that runs at incredible speeds with minimal latency and maximum efficiency.",
    benefits: ["Sub-second response", "Real-time processing", "Edge computing"],
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Bank-level security with end-to-end encryption, ensuring your data and processes are always protected.",
    benefits: ["256-bit encryption", "SOC 2 compliant", "GDPR ready"],
  },
  {
    icon: Gauge,
    title: "Performance Analytics",
    description: "Deep insights into your automation performance with comprehensive analytics and reporting tools.",
    benefits: ["Real-time dashboards", "Custom reports", "Predictive insights"],
  },
];

const Features = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="pt-24 pb-20">
        <PageContainer>
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold mb-4">
              Powerful <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Features</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to automate your business processes with cutting-edge AI technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {featuresDetailed.map((feature, index) => (
              <Card key={index} className="card-hover border-border/50 hover:border-primary/50">
                <CardHeader>
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageContainer>
      </main>
    </div>
  );
};

export default Features;
