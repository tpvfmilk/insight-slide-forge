
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { formatFileSize } from "@/utils/formatUtils";
import { HardDrive, RefreshCw } from "lucide-react";
import { syncStorageUsage } from "@/services/storageUsageService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CleanupStorageButton } from "./CleanupStorageButton";
import { StorageBreakdownChart } from "./StorageBreakdownChart";
import { fetchStorageInfo, fetchStorageBreakdown } from "@/services/usageService";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function StorageUsageBar({ hidden = true }: { hidden?: boolean }) {
  const queryClient = useQueryClient();
  
  const {
    data: storageInfo,
    isLoading,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['storage-info'],
    queryFn: fetchStorageInfo,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000 // 1 minute
  });

  // Get storage breakdown data
  const { data: breakdownData } = useQuery({
    queryKey: ['storage-breakdown'],
    queryFn: fetchStorageBreakdown,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000 // 1 minute
  });

  // Refetch storage info when component mounts
  useEffect(() => {
    refetch();
  }, [refetch]);
  
  const handleSyncStorage = async () => {
    try {
      toast.loading("Syncing storage usage...");
      const result = await syncStorageUsage();
      
      if (result.success) {
        toast.success(result.message);
        // Refetch storage info to update the UI
        await queryClient.invalidateQueries({
          queryKey: ['storage-info']
        });
        await queryClient.invalidateQueries({
          queryKey: ['storage-breakdown']
        });
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to sync storage usage");
      console.error("Error syncing storage:", error);
    }
  };
  
  if (hidden) {
    return null;
  }
  
  if (isLoading) {
    return <div className="px-4 py-2 text-sm text-muted-foreground">
        Loading storage info...
      </div>;
  }
  
  if (!storageInfo) {
    return null;
  }
  
  const usedFormatted = formatFileSize(storageInfo.storageUsed);
  
  // Calculate segment percentages for the progress bar
  let segments = [];
  
  if (breakdownData) {
    const total = breakdownData.total > 0 ? breakdownData.total : 1; // Avoid division by zero
    segments = [
      {
        type: 'videos',
        percentage: (breakdownData.videos / total) * 100,
        color: 'bg-blue-500'
      },
      {
        type: 'slides',
        percentage: (breakdownData.slides / total) * 100,
        color: 'bg-green-500'
      },
      {
        type: 'frames', 
        percentage: (breakdownData.frames / total) * 100,
        color: 'bg-amber-500'
      },
      {
        type: 'other',
        percentage: (breakdownData.other / total) * 100,
        color: 'bg-gray-500'
      }
    ];
  }
  
  return <div className="space-y-4 px-[25px] py-[16px]">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5" />
          <span className="font-medium">Total Storage</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            {usedFormatted}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full" 
            onClick={handleSyncStorage} 
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="sr-only">Sync storage usage</span>
          </Button>
        </div>
      </div>
      
      {/* Segmented Progress Bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        {segments.map((segment, index) => (
          segment.percentage > 0 && (
            <div 
              key={segment.type}
              className={`absolute top-0 h-full ${segment.color}`}
              style={{
                left: `${segments.slice(0, index).reduce((sum, s) => sum + s.percentage, 0)}%`,
                width: `${segment.percentage}%`
              }}
              title={`${segment.type}: ${formatFileSize(breakdownData?.[segment.type] || 0)}`}
            />
          )
        ))}
      </div>
      
      {/* Storage breakdown chart */}
      <div className="mt-6 pt-4 border-t">
        <StorageBreakdownChart />
      </div>
      
      <div className="flex justify-end">
        <CleanupStorageButton />
      </div>
    </div>;
}
