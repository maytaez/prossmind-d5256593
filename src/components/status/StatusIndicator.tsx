import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

const StatusIndicator = () => {
  // In a real implementation, this would fetch from an API
  const status = "operational"; // operational | degraded | down

  const statusConfig = {
    operational: {
      label: "All Systems Operational",
      color: "bg-green-500",
      icon: CheckCircle2,
      variant: "default" as const,
    },
    degraded: {
      label: "Degraded Performance",
      color: "bg-yellow-500",
      icon: AlertCircle,
      variant: "secondary" as const,
    },
    down: {
      label: "Service Disruption",
      color: "bg-red-500",
      icon: XCircle,
      variant: "destructive" as const,
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${config.color} animate-pulse`} />
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="font-semibold">{config.label}</span>
      </div>
      <Badge variant={config.variant}>{status}</Badge>
    </div>
  );
};

export default StatusIndicator;




