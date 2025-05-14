
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { fetchStorageInfo } from "@/services/usageService";
import { formatFileSize } from "@/utils/formatUtils";
import { Database, HardDrive, RefreshCw } from "lucide-react";
import { syncStorageUsage } from "@/services/storageUsageService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CleanupStorageButton } from "./CleanupStorageButton";

export function StorageUsageBar({ hidden = true }: { hidden?: boolean }) {
  const [percentage, setPercentage] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  
  const {
    data: storageInfo,
    isLoading,
    refetch
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
  
  useEffect(() => {
    if (storageInfo) {
      setPercentage(Math.min(100, storageInfo.percentageUsed));
    }
  }, [storageInfo]);
  
  const handleSyncStorage = async () => {
    setIsSyncing(true);
    try {
      const result = await syncStorageUsage();
      if (result.success) {
        toast.success(result.message);
        // Refetch storage info to update the UI
        await queryClient.invalidateQueries({
          queryKey: ['storage-info']
        });
        refetch();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to sync storage usage");
    } finally {
      setIsSyncing(false);
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

  // Determine color based on percentage
  let progressColor = "bg-primary";
  if (percentage > 90) {
    progressColor = "bg-destructive";
  } else if (percentage > 75) {
    progressColor = "bg-warning";
  }
  
  return <div className="space-y-3 px-[25px] py-[16px]">
      <div className="flex justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <HardDrive className="h-3.5 w-3.5" />
          <span>Total Storage</span>
        </div>
        <div className="flex items-center gap-2 px-[11px]">
          <span className="px-0 mx-0">
            {usedFormatted} / {limitFormatted}
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full" onClick={handleSyncStorage} disabled={isSyncing}>
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="sr-only">Sync storage usage</span>
          </Button>
        </div>
      </div>
      <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />
      {percentage > 90 && <div className="text-xs text-destructive">Storage almost full</div>}
      <div className="flex justify-end">
        <CleanupStorageButton />
      </div>
    </div>;
}
