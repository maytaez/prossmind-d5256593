
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type DiagramType = "bpmn" | "pid" | "dmn";

export function DiagramGenerator() {
  const [diagramType, setDiagramType] = useState<DiagramType>("bpmn");
  const [description, setDescription] = useState("");

  const handleGenerate = () => {
    // TODO: Implement diagram generation logic
    console.log(`Generating ${diagramType} diagram with description: ${description}`);
  };

  return (
    <div className="container mx-auto py-12">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Generate a Diagram</CardTitle>
          <CardDescription>Select the diagram type and describe what you want to create.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bpmn" onValueChange={(value) => setDiagramType(value as DiagramType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="bpmn">BPMN Diagram</TabsTrigger>
              <TabsTrigger value="pid">P&ID Diagram</TabsTrigger>
              <TabsTrigger value="dmn">DMN Decision</TabsTrigger>
            </TabsList>
            <TabsContent value="bpmn">
              <div className="space-y-4 py-4">
                <Label htmlFor="bpmn-description">Describe the business process:</Label>
                <Textarea
                  id="bpmn-description"
                  placeholder="e.g., A customer places an order online. The system verifies stock and processes payment. If successful, the order is sent to the warehouse for fulfillment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </TabsContent>
            <TabsContent value="pid">
              <div className="space-y-4 py-4">
                <Label htmlFor="pid-description">Describe the piping and instrumentation process:</Label>
                <Textarea
                  id="pid-description"
                  placeholder="e.g., A centrifugal pump draws water from a storage tank and sends it to a heat exchanger. A control valve regulates the flow..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </TabsContent>
            <TabsContent value="dmn">
              <div className="space-y-4 py-4">
                <Label htmlFor="dmn-description">Describe the decision logic:</Label>
                <Textarea
                  id="dmn-description"
                  placeholder="e.g., Create a loan approval decision table based on credit score and income. If credit score >= 700 and income >= 50000, approve with 3.5% interest rate..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter>
          <Button onClick={handleGenerate} className="w-full">
            Generate Diagram
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
