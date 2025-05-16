
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, RefreshCcw } from "lucide-react";
import { initializeStorage } from "@/services/storageService";
import { verifyStorageStatus, fixCommonStoragePathIssues } from "@/utils/storagePathVerifier";

export function StorageBucketVerifier() {
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [checkResults, setCheckResults] = useState<any>(null);
  const [fixResults, setFixResults] = useState<any>(null);
  const [verifyStage, setVerifyStage] = useState<string>("");
  
  const handleCheckStorage = async () => {
    setIsChecking(true);
    setCheckResults(null);
    setFixResults(null);
    
    try {
      // First initialize storage to ensure buckets exist
      setVerifyStage("Initializing storage buckets...");
      await initializeStorage();
      
      // Then verify everything is working correctly
      setVerifyStage("Verifying bucket access...");
      const results = await verifyStorageStatus();
      setCheckResults(results);
    } catch (error) {
      setCheckResults({
        success: false,
        message: `Error checking storage: ${error.message}`,
        error
      });
    } finally {
      setVerifyStage("");
      setIsChecking(false);
    }
  };
  
  const handleFixIssues = async () => {
    setIsFixing(true);
    setFixResults(null);
    
    try {
      // Apply fixes for common issues
      const results = await fixCommonStoragePathIssues();
      setFixResults(results);
      
      // Re-check status after fixes
      if (results.success) {
        handleCheckStorage();
      }
    } catch (error) {
      setFixResults({
        success: false,
        message: `Error fixing issues: ${error.message}`,
        error
      });
    } finally {
      setIsFixing(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Storage Bucket Status</h2>
        <div className="space-x-2">
          <Button 
            onClick={handleCheckStorage} 
            disabled={isChecking}
            variant="outline"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {verifyStage || "Checking..."}
              </>
            ) : (
              <>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Verify Storage
              </>
            )}
          </Button>
          
          {checkResults && !checkResults.success && (
            <Button 
              onClick={handleFixIssues} 
              disabled={isFixing || isChecking}
              variant="default"
            >
              {isFixing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fixing...
                </>
              ) : (
                <>
                  Fix Issues
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {isChecking && !checkResults && (
        <Alert>
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          <AlertTitle>Verifying Storage</AlertTitle>
          <AlertDescription>
            {verifyStage || "Checking storage bucket status..."}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Check Results */}
      {checkResults && (
        <Alert variant={checkResults.success ? "default" : "destructive"}>
          <div className="flex items-start">
            {checkResults.success ? (
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 mr-2" />
            )}
            <div className="space-y-2 w-full">
              <AlertTitle>
                {checkResults.success ? "Storage is healthy" : "Storage issues detected"}
              </AlertTitle>
              <AlertDescription>
                {checkResults.message}
              </AlertDescription>
              
              {/* Bucket Status */}
              {checkResults.bucketStatus && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Bucket Status</h3>
                  <div className="space-y-2">
                    {checkResults.bucketStatus.map((bucket: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-muted/30 p-2 rounded-md">
                        <div className="font-mono text-sm">{bucket.bucket}</div>
                        <Badge variant={bucket.status === 'available' ? "outline" : "destructive"}>
                          {bucket.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Path Issues */}
              {checkResults.pathIssues && checkResults.pathIssues.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Path Issues ({checkResults.pathIssues.length})</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {checkResults.pathIssues.map((issue: any, index: number) => (
                      <div key={index} className="bg-muted/30 p-2 rounded-md">
                        <div className="font-mono text-xs break-all">
                          {issue.path || issue.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {issue.projectId && <span>Project: {issue.projectId}</span>}
                          {issue.type && <span className="ml-2">Type: {issue.type}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Alert>
      )}
      
      {/* Fix Results */}
      {fixResults && (
        <Alert variant={fixResults.success ? "default" : "destructive"}>
          <div className="flex items-start">
            {fixResults.success ? (
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 mr-2" />
            )}
            <div className="space-y-2 w-full">
              <AlertTitle>
                {fixResults.success ? "Fixes applied successfully" : "Some fixes failed"}
              </AlertTitle>
              
              {/* Fix Details */}
              {fixResults.fixes && fixResults.fixes.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-sm font-medium mb-2">Fix Details ({fixResults.fixes.length})</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {fixResults.fixes.map((fix: any, index: number) => (
                      <div key={index} className="bg-muted/30 p-2 rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{fix.type}</div>
                          <Badge variant={fix.success === false ? "destructive" : "outline"}>
                            {fix.success === false ? "Failed" : "Fixed"}
                          </Badge>
                        </div>
                        {fix.oldPath && fix.newPath && (
                          <div className="mt-1">
                            <div className="font-mono text-xs line-through break-all">{fix.oldPath}</div>
                            <div className="font-mono text-xs break-all">{fix.newPath}</div>
                          </div>
                        )}
                        {fix.message && (
                          <div className="text-xs text-muted-foreground mt-1">{fix.message}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
}
