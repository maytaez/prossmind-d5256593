import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function AnalyticsCharts() {
  const { data: dailyStats } = useQuery({
    queryKey: ["dashboard-daily-stats"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api/analytics/daily`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch daily stats");
      return response.json();
    },
  });

  const { data: cachePerformance } = useQuery({
    queryKey: ["dashboard-cache-performance"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api/analytics/cache`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch cache performance");
      return response.json();
    },
  });

  const { data: errorSummary } = useQuery({
    queryKey: ["dashboard-error-summary"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bpmn-dashboard-api/analytics/errors`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch error summary");
      return response.json();
    },
  });

  // Prepare data for charts
  const dailyData = dailyStats ? [...dailyStats].reverse() : [];
  const cacheData = cachePerformance ? [...cachePerformance].reverse() : [];
  const errorData = errorSummary ? errorSummary.slice(0, 10) : [];

  return (
    <div className="space-y-6">
      {/* Daily Request Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Request Volume</CardTitle>
          <CardDescription>Total requests and success rate over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: any, name: string) => {
                  if (name === "Success Rate") return [`${value}%`, name];
                  return [value, name];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total_requests"
                stroke="#8884d8"
                name="Total Requests"
                strokeWidth={2}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="successful_requests"
                stroke="#82ca9d"
                name="Successful"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cache_hit_rate_percent"
                stroke="#ffc658"
                name="Cache Hit Rate (%)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Average Response Time</CardTitle>
            <CardDescription>Generation duration trends</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  formatter={(value: any) => [`${value}ms`, "Avg Duration"]}
                />
                <Bar dataKey="avg_duration_ms" fill="#8884d8" name="Avg Duration (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache Performance</CardTitle>
            <CardDescription>Cache hit vs miss rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cacheData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip labelFormatter={(value) => new Date(value).toLocaleDateString()} />
                <Legend />
                <Bar dataKey="cache_hits" fill="#82ca9d" name="Cache Hits" />
                <Bar dataKey="cache_misses" fill="#ff7c7c" name="Cache Misses" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Top Errors</CardTitle>
          <CardDescription>Most frequent error messages (last 30 days)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {errorData && errorData.length > 0 ? (
              errorData.map((error: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-destructive/5 border border-destructive/20 rounded-md"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm line-clamp-2">{error.error_message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Last occurred: {new Date(error.last_occurred).toLocaleString()}
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1">
                    <span className="text-lg font-bold text-destructive">{error.error_count}</span>
                    <span className="text-xs text-muted-foreground">occurrences</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">No errors in the last 30 days</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Cost Trend</CardTitle>
          <CardDescription>Estimated costs over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={80}
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: any) => [`$${value?.toFixed(6)}`, "Daily Cost"]}
              />
              <Line
                type="monotone"
                dataKey="total_cost_usd"
                stroke="#82ca9d"
                name="Daily Cost (USD)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
