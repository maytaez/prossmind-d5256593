import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Clock } from "lucide-react";

const Tutorials = () => {
  const tutorials = [
    {
      title: "Creating Your First BPMN Diagram",
      description: "Step-by-step tutorial for creating a simple business process diagram",
      duration: "5 min",
      level: "Beginner",
    },
    {
      title: "Advanced P&ID Design",
      description: "Learn advanced techniques for complex piping and instrumentation diagrams",
      duration: "15 min",
      level: "Advanced",
    },
    {
      title: "Using Vision AI",
      description: "Convert handwritten notes and sketches into professional diagrams",
      duration: "10 min",
      level: "Intermediate",
    },
    {
      title: "Integrating with SAP Signavio",
      description: "Export and import diagrams to SAP Signavio for process management",
      duration: "12 min",
      level: "Intermediate",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Tutorials</h1>
        <p className="text-xl text-muted-foreground">
          Step-by-step tutorials to help you master ProssMind features.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {tutorials.map((tutorial) => (
          <Card key={tutorial.title}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>{tutorial.title}</CardTitle>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {tutorial.level}
                </span>
              </div>
              <CardDescription>{tutorial.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {tutorial.duration}
                </div>
                <Button variant="outline" size="sm">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Watch Tutorial
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Tutorials;




