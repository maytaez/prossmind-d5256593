import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Changelog = () => {
  const versions = [
    {
      version: "1.0.0",
      date: "2024-01-15",
      type: "major",
      changes: [
        "Initial release of ProssMind",
        "BPMN diagram generation",
        "P&ID diagram generation",
        "Vision AI image conversion",
        "Free tier with 5 diagram generations",
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Changelog</h1>
        <p className="text-xl text-muted-foreground">
          Track updates and new features in ProssMind.
        </p>
      </div>

      <div className="space-y-6">
        {versions.map((version) => (
          <Card key={version.version}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  Version {version.version}
                  <Badge variant={version.type === "major" ? "default" : "secondary"}>
                    {version.type}
                  </Badge>
                </CardTitle>
                <CardDescription>{version.date}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {version.changes.map((change, index) => (
                  <li key={index} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Changelog;



