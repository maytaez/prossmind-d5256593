import { Bot, Workflow, Eye, Plug, BarChart3, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Workflow,
    title: "Process Generator",
    description: "Design and build automated business processes with powerful AI capabilities.",
  },
  {
    icon: Eye,
    title: "Vision Automation",
    description: "Automate visual tasks with advanced computer vision and image processing.",
  },
  {
    icon: Download,
    title: "BPMN Integration",
    description: "Download BPMN diagrams and integrate with SAP Signavio, Camunda, Flowable, and more.",
  },
];

const FeatureCards = () => {
  return (
    <section className="py-24 bg-muted/30 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16 slide-up">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to automate and optimize your business processes
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className={`card-hover cursor-pointer border-border/50 hover:border-primary/50 bg-card/50 backdrop-blur-sm slide-up stagger-${(index % 5) + 1} flex flex-col h-full rounded-2xl shadow-md hover:shadow-lg transition-transform p-6`}
              role="article"
              aria-label={`Feature: ${feature.title}`}
            >
              <CardHeader className="flex-shrink-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 tech-glow">
                  <feature.icon className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col">
                <CardDescription className="text-base leading-relaxed break-words overflow-visible min-h-0">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureCards;
