import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { RequestDetailModal } from "./RequestDetailModal";

interface RequestLog {
  id: string;
  user_email: string;
  original_prompt: string;
  diagram_type: string;
  status: string;
  generation_duration_ms: number | null;
  cache_hit: boolean;
  estimated_cost_usd: number | null;
  request_timestamp: string;
  source_function: string;
  result_xml: string | null;
}

export function RequestsTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [diagramTypeFilter, setDiagramTypeFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-requests", page, search, statusFilter, diagramTypeFilter],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
      });

      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (diagramTypeFilter !== "all") params.append("diagramType", diagramTypeFilter);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api/requests?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    },
  });

  const handleExport = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api/export`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format: "csv",
          filters: {
            status: statusFilter !== "all" ? statusFilter : undefined,
            diagramType: diagramTypeFilter !== "all" ? diagramTypeFilter : undefined,
          },
        }),
      }
    );

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bpmn-dashboard-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      cached: "secondary",
      error: "destructive",
      pending: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Generation Requests</CardTitle>
              <CardDescription>View and filter all BPMN generation requests</CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search prompts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="cached">Cached</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={diagramTypeFilter} onValueChange={setDiagramTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bpmn">BPMN</SelectItem>
                <SelectItem value="pid">PID</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Prompt</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Cache</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Result XML</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : data?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.data?.map((request: RequestLog) => (
                    <TableRow
                      key={request.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRequest(request.id)}
                    >
                      <TableCell className="font-mono text-xs">
                        {new Date(request.request_timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{request.user_email}</TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {request.original_prompt}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{request.diagram_type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {request.generation_duration_ms ? `${request.generation_duration_ms}ms` : "-"}
                      </TableCell>
                      <TableCell>{request.cache_hit ? "✓" : "−"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        ${request.estimated_cost_usd?.toFixed(6) || "0.000000"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {request.source_function}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {request.result_xml ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                            {request.result_xml.substring(0, 50)}...
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">−</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data?.pagination && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total}{" "}
                total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= (data.pagination.totalPages || 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRequest && (
        <RequestDetailModal
          requestId={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </>
  );
}
