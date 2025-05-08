
import { useState, useEffect } from "react";
import { Calendar, Clock, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { fetchTotalUsageStats, fetchDailyUsage, resetUsageStats, UsageStatistics, DailyUsage } from "@/services/usageService";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const UsageStats = () => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Query for fetching total usage statistics
  const { data: totalStats, isLoading: isLoadingTotal, error: totalError } = useQuery({
    queryKey: ['totalUsageStats'],
    queryFn: fetchTotalUsageStats,
  });

  // Query for fetching daily usage data
  const { data: usageByDay, isLoading: isLoadingDaily, error: dailyError } = useQuery({
    queryKey: ['dailyUsage', timeRange],
    queryFn: () => fetchDailyUsage(timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : 30),
  });

  // Mutation for resetting usage statistics
  const resetMutation = useMutation({
    mutationFn: resetUsageStats,
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['totalUsageStats'] });
      queryClient.invalidateQueries({ queryKey: ['dailyUsage'] });
      toast.success("Usage statistics have been reset");
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to reset statistics: " + error.message);
    }
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // Show error if there's any
  if (totalError || dailyError) {
    const errorMessage = (totalError || dailyError)?.toString() || "Error fetching usage data";
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Token Usage Statistics</CardTitle>
          <CardDescription>Error loading data</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Token Usage Statistics</CardTitle>
          <CardDescription>
            Track your OpenAI API consumption and costs
          </CardDescription>
        </div>
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              title="Reset Statistics"
              className="h-8 w-8 p-0"
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="sr-only">Reset Statistics</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Usage Statistics</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all your token usage history. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleReset}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? "Resetting..." : "Reset"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            label="Total Tokens" 
            value={isLoadingTotal ? "Loading..." : `${((totalStats?.totalTokens || 0) / 1000).toFixed(1)}K`} 
          />
          <StatCard 
            label="API Requests" 
            value={isLoadingTotal ? "Loading..." : String(totalStats?.apiRequests || 0)} 
          />
          <StatCard 
            label="Estimated Cost" 
            value={isLoadingTotal ? "Loading..." : `$${(totalStats?.estimatedCost || 0).toFixed(2)}`} 
          />
          <StatCard 
            label="Last Used" 
            value={isLoadingTotal ? "Loading..." : formatDate(totalStats?.lastUsed || null)} 
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        
        <Tabs defaultValue="week" value={timeRange} onValueChange={(value) => setTimeRange(value as 'day' | 'week' | 'month')}>
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              <span>
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          
          <TabsContent value="day" className="mt-0">
            {isLoadingDaily ? (
              <div className="h-72 w-full flex items-center justify-center">Loading...</div>
            ) : (
              <UsageChart data={usageByDay || []} />
            )}
          </TabsContent>
          <TabsContent value="week" className="mt-0">
            {isLoadingDaily ? (
              <div className="h-72 w-full flex items-center justify-center">Loading...</div>
            ) : (
              <UsageChart data={usageByDay || []} />
            )}
          </TabsContent>
          <TabsContent value="month" className="mt-0">
            {isLoadingDaily ? (
              <div className="h-72 w-full flex items-center justify-center">Loading...</div>
            ) : (
              <UsageChart data={usageByDay || []} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const StatCard = ({ label, value, icon }: StatCardProps) => {
  return (
    <div className="insight-stats-card">
      <div className="insight-stats-value">{value}</div>
      <div className="insight-stats-label flex items-center gap-1">
        {icon && icon}
        {label}
      </div>
    </div>
  );
};

interface UsageChartProps {
  data: DailyUsage[];
}

const UsageChart = ({ data }: UsageChartProps) => {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 20,
            left: 0,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.1} />
          <XAxis dataKey="day" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip contentStyle={{ backgroundColor: 'rgba(17, 17, 17, 0.8)', border: 'none', borderRadius: '4px' }} />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="tokens" 
            stroke="#8B5CF6" 
            activeDot={{ r: 8 }} 
            name="Tokens"
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="cost" 
            stroke="#10B981" 
            name="Cost ($)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
