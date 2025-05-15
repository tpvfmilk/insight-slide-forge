
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Bar, 
  BarChart, 
  Cell,
  Legend,
  ResponsiveContainer, 
  Tooltip, 
  XAxis 
} from "recharts";
import { fetchStorageBreakdown } from "@/services/usageService";
import { Skeleton } from "@/components/ui/skeleton";
import { HardDrive } from "lucide-react";
import { formatFileSize } from "@/utils/formatUtils";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

export function StorageBreakdownChart() {
  const [chartData, setChartData] = useState<any[]>([]);
  
  const {
    data: storageBreakdown,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['storage-breakdown'],
    queryFn: fetchStorageBreakdown,
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000 // 1 minute
  });

  useEffect(() => {
    if (storageBreakdown) {
      // Transform the data for the chart
      const formattedData = [
        {
          name: "Storage Breakdown",
          Videos: storageBreakdown.videos || 0,
          Slides: storageBreakdown.slides || 0,
          Frames: storageBreakdown.frames || 0,
          Other: storageBreakdown.other || 0
        }
      ];
      
      setChartData(formattedData);
    }
  }, [storageBreakdown]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!storageBreakdown) {
    return <div className="text-center text-muted-foreground py-4">
      No storage data available
    </div>;
  }

  // Define color config for the chart
  const chartConfig: ChartConfig = {
    Videos: {
      label: "Videos",
      color: "#3b82f6" // blue
    },
    Slides: {
      label: "Slides",
      color: "#10b981" // green
    },
    Frames: {
      label: "Frames",
      color: "#f59e0b" // amber
    },
    Other: {
      label: "Other",
      color: "#6b7280" // gray
    }
  };
  
  const getTotalSize = () => {
    return storageBreakdown.total || 
      (storageBreakdown.videos || 0) + 
      (storageBreakdown.slides || 0) + 
      (storageBreakdown.frames || 0) + 
      (storageBreakdown.other || 0);
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <HardDrive className="h-3.5 w-3.5" />
        <span>Storage Breakdown</span>
        <span className="ml-auto">{formatFileSize(getTotalSize())}</span>
      </div>
      
      <ChartContainer className="h-48" config={chartConfig}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            stackOffset="expand"
            margin={{
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          >
            <XAxis type="number" hide />
            <Tooltip 
              formatter={(value) => formatFileSize(value as number)}
              labelFormatter={() => 'Storage Usage'} 
            />
            <Legend />
            <Bar 
              dataKey="Videos" 
              stackId="a" 
              fill={chartConfig.Videos.color}
            />
            <Bar 
              dataKey="Slides" 
              stackId="a" 
              fill={chartConfig.Slides.color} 
            />
            <Bar 
              dataKey="Frames" 
              stackId="a" 
              fill={chartConfig.Frames.color}
            />
            <Bar 
              dataKey="Other" 
              stackId="a" 
              fill={chartConfig.Other.color}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span>Videos: {formatFileSize(storageBreakdown.videos || 0)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span>Slides: {formatFileSize(storageBreakdown.slides || 0)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-amber-500"></div>
          <span>Frames: {formatFileSize(storageBreakdown.frames || 0)}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-gray-500"></div>
          <span>Other: {formatFileSize(storageBreakdown.other || 0)}</span>
        </div>
      </div>
    </div>
  );
}
