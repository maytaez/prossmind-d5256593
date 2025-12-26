import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeDashboardApi } from "@/utils/dashboard-api-client";

interface RequestDetailModalProps {
  requestId: string;
  onClose: () => void;
}

export function RequestDetailModal({ requestId, onClose }: RequestDetailModalProps) {
  const { toast } = useToast();

  const { data: request, isLoading } = useQuery({
    queryKey: ["dashboard-request-detail", requestId],
    queryFn: async () => {
      const result = await invokeDashboardApi(`/requests/${requestId}`);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Content has been copied to your clipboard",
    });
  };

  const downloadXml = () => {
    if (!request?.result_xml) return;
    const blob = new Blob([request.result_xml], { type: "application/xml" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bpmn-${requestId}.xml`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Details</DialogTitle>
          <DialogDescription>
            {request?.request_timestamp && new Date(request.request_timestamp).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : !request ? (
          <div className="text-center py-8">Request not found</div>
        ) : (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">User</div>
                <div className="mt-1">{request.user_email || "Unknown"}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <div className="mt-1">
                  <Badge variant={request.status === "error" ? "destructive" : "default"}>
                    {request.status}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Diagram Type</div>
                <div className="mt-1">
                  <Badge variant="outline">{request.diagram_type.toUpperCase()}</Badge>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Source Function</div>
                <div className="mt-1 font-mono text-sm">{request.source_function}</div>
              </div>
            </div>

            <Separator />

            {/* Prompt */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Original Prompt</div>
              <div className="bg-muted p-4 rounded-md text-sm whitespace-pre-wrap">
                {request.original_prompt}
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-3">
                Performance Metrics
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="text-lg font-semibold">
                    {request.generation_duration_ms ? `${request.generation_duration_ms}ms` : "N/A"}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="text-xs text-muted-foreground">Input Tokens</div>
                  <div className="text-lg font-semibold">{request.input_tokens || "N/A"}</div>
                </div>
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="text-xs text-muted-foreground">Output Tokens</div>
                  <div className="text-lg font-semibold">{request.output_tokens || "N/A"}</div>
                </div>
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="text-xs text-muted-foreground">Estimated Cost</div>
                  <div className="text-lg font-semibold">
                    ${request.estimated_cost_usd?.toFixed(6) || "0.000000"}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-md">
                  <div className="text-xs text-muted-foreground">Cache Hit</div>
                  <div className="text-lg font-semibold">{request.cache_hit ? "Yes" : "No"}</div>
                </div>
                {request.cache_similarity_score && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Similarity</div>
                    <div className="text-lg font-semibold">
                      {(request.cache_similarity_score * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
                {request.detected_language && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Language</div>
                    <div className="text-lg font-semibold">{request.detected_language}</div>
                  </div>
                )}
                {request.complexity_level && (
                  <div className="bg-muted/50 p-3 rounded-md">
                    <div className="text-xs text-muted-foreground">Complexity</div>
                    <div className="text-lg font-semibold capitalize">{request.complexity_level}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-requests for multi-diagram */}
            {request.sub_requests && request.sub_requests.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-3">
                    Sub-diagrams ({request.sub_requests.length})
                  </div>
                  <div className="space-y-2">
                    {request.sub_requests.map((sub: any, index: number) => (
                      <div key={sub.id} className="bg-muted/30 p-3 rounded-md">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-sm">Sub-diagram {index + 1}</div>
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {sub.original_prompt}
                            </div>
                          </div>
                          <Badge variant={sub.status === "error" ? "destructive" : "default"}>
                            {sub.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* XML Output */}
            {request.result_xml && (
              <>
                <Separator />
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm font-medium text-muted-foreground">BPMN XML</div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(request.result_xml)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadXml}>
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-md text-xs font-mono overflow-x-auto max-h-[300px] overflow-y-auto">
                    {request.result_xml}
                  </div>
                </div>
              </>
            )}

            {/* Error Details */}
            {request.error_message && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Error Details</div>
                  <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-md">
                    <div className="font-semibold text-destructive mb-2">
                      {request.error_message}
                    </div>
                    {request.error_stack && (
                      <pre className="text-xs font-mono mt-2 overflow-x-auto">
                        {request.error_stack}
                      </pre>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
