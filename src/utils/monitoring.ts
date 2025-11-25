import { toast } from "sonner";

export const notifyMonitoringWarnings = (
  warnings?: string[] | null,
  context?: string
) => {
  if (!warnings || warnings.length === 0) {
    return;
  }

  warnings.forEach((warning) => {
    toast.warning("Monitoring instrumentation", {
      description: context ? `${context}: ${warning}` : warning,
      duration: 7000,
    });
  });
};

