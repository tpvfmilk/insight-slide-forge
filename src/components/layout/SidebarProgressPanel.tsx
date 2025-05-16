
import React, { useState, useEffect, useRef } from 'react';
import { useProgress, ProgressOperation, OperationType } from '@/context/ProgressContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ChevronDown, 
  ChevronUp, 
  X, 
  UploadCloud, 
  FileText, 
  Layers, 
  Image, 
  Scan,
  Download,
  Cog,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Get icon based on operation type
const getOperationIcon = (type: OperationType, status: 'pending' | 'running' | 'completed' | 'failed') => {
  if (status === 'failed') {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }

  if (status === 'completed') {
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  }

  if (status === 'pending') {
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  }

  switch (type) {
    case 'upload':
      return <UploadCloud className="h-4 w-4 text-blue-500" />;
    case 'transcription':
      return <FileText className="h-4 w-4 text-amber-500" />;
    case 'chunking':
      return <Layers className="h-4 w-4 text-purple-500" />;
    case 'extraction':
      return <Image className="h-4 w-4 text-green-500" />;
    case 'generation':
      return <Scan className="h-4 w-4 text-indigo-500" />;
    case 'download':
      return <Download className="h-4 w-4 text-teal-500" />;
    case 'processing':
    default:
      return <Cog className="h-4 w-4 text-gray-500" />;
  }
};

// Format timestamp to human-readable format
const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const ProgressItem = ({ operation }: { operation: ProgressOperation }) => {
  const isActive = operation.status === 'running' || operation.status === 'pending';

  return (
    <div className={cn(
      "py-2 px-1 border-b border-border/40 last:border-b-0",
      operation.status === 'failed' && "bg-destructive/10"
    )}>
      <div className="flex items-center gap-2 mb-1">
        {getOperationIcon(operation.type, operation.status)}
        <div className="flex-1 text-sm font-medium truncate">{operation.title}</div>
        <div className="text-xs text-muted-foreground">{formatTime(operation.timestamp)}</div>
      </div>
      <div className="text-xs mb-1 text-muted-foreground truncate">{operation.message}</div>
      {isActive && (
        <Progress value={operation.progress} className="h-1.5 mt-1" />
      )}
    </div>
  );
};

export function SidebarProgressPanel() {
  const { 
    operations, 
    getActiveOperations,
    getRecentOperations,
    clearCompletedOperations,
    isActive 
  } = useProgress();
  const [open, setOpen] = useState(false);
  const [autoExpand, setAutoExpand] = useState(true);
  const prevActiveStateRef = useRef(isActive);
  
  // Auto-expand panel when new operations start
  useEffect(() => {
    if (autoExpand && !prevActiveStateRef.current && isActive) {
      setOpen(true);
    }
    prevActiveStateRef.current = isActive;
  }, [isActive, autoExpand]);

  const activeOperations = getActiveOperations();
  const recentOperations = getRecentOperations().slice(0, 10); // Only show latest 10

  if (operations.length === 0) {
    return null; // Don't render anything if there are no operations
  }

  return (
    <div className="px-2 py-2">
      <Collapsible 
        open={open} 
        onOpenChange={setOpen} 
        className="border rounded-md bg-background/70"
      >
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2">
            <div className={cn(
              "h-2 w-2 rounded-full",
              isActive ? "bg-green-500 animate-pulse" : "bg-muted"
            )} />
            <h4 className="text-sm font-medium">
              {isActive ? 'Operations in progress' : 'Recent operations'}
            </h4>
          </div>
          <div className="flex items-center gap-1">
            {operations.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2" 
                onClick={(e) => {
                  e.stopPropagation();
                  clearCompletedOperations();
                }}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Clear</span>
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                {open ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span className="sr-only">
                  {open ? 'Collapse' : 'Expand'}
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Preview of latest active operation when collapsed */}
        {!open && activeOperations.length > 0 && (
          <div className="px-2 pb-2">
            <ProgressItem operation={activeOperations[0]} />
          </div>
        )}

        <CollapsibleContent>
          <Separator />
          <div 
            className="max-h-[40vh] overflow-y-auto bg-card/50 py-1 px-2 space-y-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {recentOperations.length > 0 ? (
              recentOperations.map(op => (
                <ProgressItem key={op.id} operation={op} />
              ))
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No recent operations
              </div>
            )}
          </div>
          
          <div className="p-2 flex justify-between items-center bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {activeOperations.length > 0 
                ? `${activeOperations.length} active operations` 
                : 'No active operations'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs py-0 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setAutoExpand(!autoExpand);
                }}
              >
                {autoExpand ? 'Auto-expand on' : 'Auto-expand off'}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
