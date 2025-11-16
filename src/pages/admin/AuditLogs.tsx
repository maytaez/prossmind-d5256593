import { User } from "@supabase/supabase-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";

interface AuditLogsProps {
  user: User;
}

const AuditLogs = ({ user }: AuditLogsProps) => {
  // In a real implementation, this would fetch from an API
  const logs = [
    { id: "1", user: "admin@example.com", action: "User created", timestamp: "2024-01-15T10:30:00Z", ip: "192.168.1.1" },
    { id: "2", user: "admin@example.com", action: "Settings updated", timestamp: "2024-01-15T09:15:00Z", ip: "192.168.1.1" },
    { id: "3", user: "user@example.com", action: "Login", timestamp: "2024-01-15T08:00:00Z", ip: "192.168.1.2" },
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-20">
      <PageContainer>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Audit Logs</h1>
          <p className="text-muted-foreground">View activity and security logs</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <CardDescription>Recent administrative actions and events</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{log.user}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.ip}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  );
};

export default AuditLogs;



