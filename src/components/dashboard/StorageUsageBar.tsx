import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { fetchStorageInfo } from "@/services/usageService";
import { formatFileSize } from "@/utils/formatUtils";
export function StorageUsageBar() {
  const [percentage, setPercentage] = useState(0);
  const {
    data: storageInfo,
    isLoading
  } = useQuery({
    queryKey: ['storage-info'],
    queryFn: fetchStorageInfo,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  useEffect(() => {
    if (storageInfo) {
      setPercentage(Math.min(100, storageInfo.percentageUsed));
    }
  }, [storageInfo]);
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
  return <div className="space-y-1 px-[25px] py-[10px]">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Storage</span>
        <span>
          {usedFormatted} / {limitFormatted}
        </span>
      </div>
      <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />
      {percentage > 90 && <div className="text-xs text-destructive">Storage almost full</div>}
    </div>;
}