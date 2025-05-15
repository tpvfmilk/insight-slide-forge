
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { fetchStorageInfo } from "@/services/usageService";
import { formatFileSize } from "@/utils/formatUtils";
import { HardDrive, RefreshCw } from "lucide-react";
import { syncStorageUsage } from "@/services/storageUsageService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CleanupStorageButton } from "./CleanupStorageButton";
import { StorageBreakdownChart } from "./StorageBreakdownChart";

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
  const limitFormatted = formatFileSize(storageInfo.storageLimit);
  const percentage = Math.min(100, storageInfo.percentageUsed);

  // Determine color based on percentage
  let progressColor = "bg-primary";
  if (percentage > 90) {
    progressColor = "bg-destructive";
  } else if (percentage > 75) {
    progressColor = "bg-warning";
  }
  
  return <div className="space-y-4 px-[25px] py-[16px]">
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5" />
          <span className="font-medium">Total Storage</span>
        </div>
        <div className="flex items-center gap-2">
          <span>
            {usedFormatted} / {limitFormatted}
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
      
      <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />
      
      {percentage > 90 && <div className="text-xs text-destructive">Storage almost full</div>}
      
      {/* Storage breakdown chart */}
      <div className="mt-6 pt-4 border-t">
        <StorageBreakdownChart />
      </div>
      
      <div className="flex justify-end">
        <CleanupStorageButton />
      </div>
    </div>;
}
