import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const IncidentList = () => {
  // In a real implementation, this would fetch from an API
  const incidents = [
    {
      id: 1,
      date: "2024-01-10",
      title: "Scheduled Maintenance",
      status: "resolved",
      description: "Database optimization and performance improvements",
    },
    {
      id: 2,
      date: "2024-01-05",
      title: "API Rate Limiting Issue",
      status: "resolved",
      description: "Temporary rate limiting issue affecting some API requests",
    },
  ];

  return (
    <div className="space-y-4">
      {incidents.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident) => (
              <TableRow key={incident.id}>
                <TableCell>{new Date(incident.date).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{incident.title}</TableCell>
                <TableCell>
                  <Badge variant={incident.status === "resolved" ? "default" : "secondary"}>
                    {incident.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{incident.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center text-muted-foreground py-8">
          No incidents reported. All systems operational.
        </p>
      )}
    </div>
  );
};

export default IncidentList;





