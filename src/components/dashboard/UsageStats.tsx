
import { Calendar, Clock } from "lucide-react";
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

// Sample data
const usage = {
  tokens: 1342567,
  requests: 42,
  cost: 12.85,
  lastUsed: "2025-05-07T10:30:00Z"
};

const usageByDay = [
  { day: 'Mon', tokens: 125000, cost: 1.25 },
  { day: 'Tue', tokens: 210000, cost: 2.10 },
  { day: 'Wed', tokens: 325000, cost: 3.25 },
  { day: 'Thu', tokens: 240000, cost: 2.40 },
  { day: 'Fri', tokens: 190000, cost: 1.90 },
  { day: 'Sat', tokens: 90000, cost: 0.90 },
  { day: 'Sun', tokens: 162567, cost: 1.05 },
];

export const UsageStats = () => {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Token Usage Statistics</CardTitle>
        <CardDescription>
          Track your OpenAI API consumption and costs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            label="Total Tokens" 
            value={`${(usage.tokens / 1000).toFixed(1)}K`} 
          />
          <StatCard 
            label="API Requests" 
            value={usage.requests.toString()} 
          />
          <StatCard 
            label="Estimated Cost" 
            value={`$${usage.cost.toFixed(2)}`} 
          />
          <StatCard 
            label="Last Used" 
            value={new Date(usage.lastUsed).toLocaleDateString()} 
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
        
        <Tabs defaultValue="week">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 mr-1" />
              <span>May 1 - May 7, 2025</span>
            </div>
          </div>
          
          <TabsContent value="day" className="mt-0">
            <UsageChart data={usageByDay} />
          </TabsContent>
          <TabsContent value="week" className="mt-0">
            <UsageChart data={usageByDay} />
          </TabsContent>
          <TabsContent value="month" className="mt-0">
            <UsageChart data={usageByDay} />
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
  data: { day: string; tokens: number; cost: number }[];
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
