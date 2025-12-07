import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PageContainer from "@/components/layout/PageContainer";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Eye, Globe, Monitor, TrendingUp } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

interface VisitorData {
  id: string;
  page_path: string;
  created_at: string;
  country: string | null;
  device_type: string | null;
  browser: string | null;
  referrer: string | null;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [visitorData, setVisitorData] = useState<VisitorData[]>([]);
  const [stats, setStats] = useState({
    totalVisits: 0,
    uniquePages: 0,
    topCountry: '',
    topDevice: ''
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('visitor_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      if (data) {
        setVisitorData(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: VisitorData[]) => {
    const uniquePages = new Set(data.map(v => v.page_path)).size;
    const countryCount: { [key: string]: number } = {};
    const deviceCount: { [key: string]: number } = {};

    data.forEach(visit => {
      if (visit.country) countryCount[visit.country] = (countryCount[visit.country] || 0) + 1;
      if (visit.device_type) deviceCount[visit.device_type] = (deviceCount[visit.device_type] || 0) + 1;
    });

    const topCountry = Object.keys(countryCount).sort((a, b) => countryCount[b] - countryCount[a])[0] || 'N/A';
    const topDevice = Object.keys(deviceCount).sort((a, b) => deviceCount[b] - deviceCount[a])[0] || 'N/A';

    setStats({
      totalVisits: data.length,
      uniquePages,
      topCountry,
      topDevice
    });
  };

  const getVisitsOverTime = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i));
      return {
        date: format(date, 'MMM dd'),
        visits: 0
      };
    });

    visitorData.forEach(visit => {
      const visitDate = format(startOfDay(new Date(visit.created_at)), 'MMM dd');
      const dayData = last7Days.find(d => d.date === visitDate);
      if (dayData) dayData.visits++;
    });

    return last7Days;
  };

  const getTopPages = () => {
    const pageCount: { [key: string]: number } = {};
    visitorData.forEach(visit => {
      pageCount[visit.page_path] = (pageCount[visit.page_path] || 0) + 1;
    });

    return Object.entries(pageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([page, count]) => ({ page, count }));
  };

  const getDeviceDistribution = () => {
    const deviceCount: { [key: string]: number } = {};
    visitorData.forEach(visit => {
      const device = visit.device_type || 'Unknown';
      deviceCount[device] = (deviceCount[device] || 0) + 1;
    });

    return Object.entries(deviceCount).map(([name, value]) => ({ name, value }));
  };

  const getBrowserDistribution = () => {
    const browserCount: { [key: string]: number } = {};
    visitorData.forEach(visit => {
      const browser = visit.browser || 'Unknown';
      browserCount[browser] = (browserCount[browser] || 0) + 1;
    });

    return Object.entries(browserCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <PageContainer className="flex-1">
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <PageContainer className="flex-1 py-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Visitor tracking and website statistics</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalVisits}</div>
                <p className="text-xs text-muted-foreground mt-1">All time visits</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Unique Pages</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.uniquePages}</div>
                <p className="text-xs text-muted-foreground mt-1">Pages visited</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Top Country</CardTitle>
                <Globe className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.topCountry}</div>
                <p className="text-xs text-muted-foreground mt-1">Most visitors</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Top Device</CardTitle>
                <Monitor className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.topDevice}</div>
                <p className="text-xs text-muted-foreground mt-1">Most used</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Visits Over Time</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getVisitsOverTime()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Pages</CardTitle>
                <CardDescription>Most visited pages</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getTopPages()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="page" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Distribution</CardTitle>
                <CardDescription>Visitors by device type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getDeviceDistribution()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {getDeviceDistribution().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Browser Distribution</CardTitle>
                <CardDescription>Top 5 browsers</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getBrowserDistribution()} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--secondary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </PageContainer>
      <Footer />
    </div>
  );
};

export default Analytics;
