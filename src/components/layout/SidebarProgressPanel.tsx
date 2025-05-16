
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Clock,
  ArrowDown,
  ArrowUp,
  CircleDot
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
      return <Cog className="h-4 w-4 text-gray-500 animate-spin" />;
  }
};

// Format timestamp to human-readable format
const formatTime = (date: Date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Group operations by workflow
const groupOperationsByWorkflow = (operations: ProgressOperation[]) => {
  const workflowMap = new Map<string, ProgressOperation[]>();
  const standalone: ProgressOperation[] = [];
  
  operations.forEach(op => {
    if (op.workflowId) {
      const workflowId = op.workflowId;
      if (!workflowMap.has(workflowId)) {
        workflowMap.set(workflowId, []);
      }
      workflowMap.get(workflowId)?.push(op);
    } else {
      standalone.push(op);
    }
  });
  
  // Sort operations within each workflow by step or timestamp
  workflowMap.forEach((ops, workflowId) => {
    workflowMap.set(workflowId, ops.sort((a, b) => {
      if (a.step !== undefined && b.step !== undefined) {
        return a.step - b.step;
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    }));
  });
  
  return { workflowGroups: workflowMap, standaloneOps: standalone };
};

interface ProgressItemProps {
  operation: ProgressOperation;
  showStep?: boolean;
  isLast?: boolean;
}

const ProgressItem = ({ operation, showStep = false, isLast = false }: ProgressItemProps) => {
  const isActive = operation.status === 'running' || operation.status === 'pending';

  return (
    <div className={cn(
      "py-2 px-1 border-border/40",
      !isLast && "border-b",
      operation.status === 'failed' && "bg-destructive/10"
    )}>
      <div className="flex items-center gap-2 mb-1">
        {showStep && operation.step && (
          <div className="flex items-center justify-center min-w-[20px] h-5 rounded-full bg-muted text-xs font-medium">
            {operation.step}
          </div>
        )}
        {getOperationIcon(operation.type, operation.status)}
        <div className="flex-1 text-sm font-medium truncate">{operation.title}</div>
        <div className="text-xs text-muted-foreground">{formatTime(operation.timestamp)}</div>
      </div>
      <div className="text-xs mb-1 text-muted-foreground truncate pl-6">{operation.message}</div>
      {isActive && (
        <Progress value={operation.progress} className="h-1.5 mt-1" />
      )}
    </div>
  );
};

interface WorkflowGroupProps {
  operations: ProgressOperation[];
  expandedWorkflows: Set<string>;
  toggleWorkflow: (workflowId: string) => void;
}

const WorkflowGroup = ({ operations, expandedWorkflows, toggleWorkflow }: WorkflowGroupProps) => {
  if (operations.length === 0) return null;
  
  const workflowId = operations[0].workflowId!;
  const workflowName = operations[0].workflowName || "Process";
  const isExpanded = expandedWorkflows.has(workflowId);
  
  // Calculate overall progress for the workflow
  const totalSteps = operations.length;
  const completedSteps = operations.filter(op => op.status === 'completed').length;
  const failedSteps = operations.filter(op => op.status === 'failed').length;
  const inProgressSteps = operations.filter(op => op.status === 'running').length;
  
  let overallProgress = 0;
  if (failedSteps > 0) {
    // If any step failed, calculate partial progress
    const completedProgress = (completedSteps / totalSteps) * 100;
    const inProgressOp = operations.find(op => op.status === 'running');
    const inProgressContribution = inProgressOp 
      ? ((inProgressOp.progress / 100) * (1 / totalSteps)) * 100
      : 0;
    
    overallProgress = completedProgress + inProgressContribution;
  } else if (completedSteps === totalSteps) {
    overallProgress = 100;
  } else {
    const completedProgress = (completedSteps / totalSteps) * 100;
    const inProgressOp = operations.find(op => op.status === 'running');
    const inProgressContribution = inProgressOp 
      ? ((inProgressOp.progress / 100) * (1 / totalSteps)) * 100
      : 0;
    
    overallProgress = completedProgress + inProgressContribution;
  }
  
  const workflowStatus = failedSteps > 0 
    ? 'failed' 
    : completedSteps === totalSteps 
      ? 'completed' 
      : inProgressSteps > 0 
        ? 'running' 
        : 'pending';
        
  const latestOp = operations.find(op => op.status === 'running') || 
                  operations.filter(op => op.status === 'completed')
                           .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] ||
                  operations[0];
  
  return (
    <div className="mb-2 border rounded-md overflow-hidden">
      <div 
        className={cn(
          "flex items-center justify-between p-2 cursor-pointer",
          workflowStatus === 'failed' && "bg-destructive/10",
          workflowStatus === 'completed' && "bg-muted/50"
        )}
        onClick={() => toggleWorkflow(workflowId)}
      >
        <div className="flex items-center gap-2">
          {workflowStatus === 'failed' && <AlertCircle className="h-4 w-4 text-destructive" />}
          {workflowStatus === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
          {workflowStatus === 'running' && <Cog className="h-4 w-4 text-primary animate-spin" />}
          {workflowStatus === 'pending' && <Clock className="h-4 w-4 text-muted-foreground" />}
          
          <div className="text-sm font-medium">
            {workflowName}
            <span className="text-xs ml-2 text-muted-foreground">
              ({completedSteps}/{totalSteps})
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {workflowStatus === 'running' && (
            <span className="text-xs text-muted-foreground">{Math.round(overallProgress)}%</span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </div>
      
      {!isExpanded && workflowStatus === 'running' && (
        <div className="px-2 pb-2">
          <div className="text-xs px-2 pt-1 pb-1 text-muted-foreground">
            {latestOp.message || "Processing..."}
          </div>
          <Progress value={overallProgress} className="h-1.5" />
        </div>
      )}
      
      {isExpanded && (
        <div className="border-t">
          <div className="max-h-[30vh] overflow-y-auto">
            {operations.map((op, index) => (
              <ProgressItem 
                key={op.id} 
                operation={op} 
                showStep={true}
                isLast={index === operations.length - 1}
              />
            ))}
          </div>
        </div>
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
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const prevActiveStateRef = useRef(isActive);
  
  // Auto-expand panel when new operations start
  useEffect(() => {
    if (autoExpand && !prevActiveStateRef.current && isActive) {
      setOpen(true);
    }
    prevActiveStateRef.current = isActive;
  }, [isActive, autoExpand]);

  const activeOperations = getActiveOperations();
  const recentOperations = getRecentOperations().slice(0, 15); // Only show latest 15
  
  // Group operations by workflow
  const { workflowGroups, standaloneOps } = useMemo(() => 
    groupOperationsByWorkflow(recentOperations),
    [recentOperations]
  );
  
  // Toggle workflow expansion
  const toggleWorkflow = (workflowId: string) => {
    setExpandedWorkflows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workflowId)) {
        newSet.delete(workflowId);
      } else {
        newSet.add(workflowId);
      }
      return newSet;
    });
  };

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
            className="max-h-[50vh] overflow-y-auto bg-card/50 py-1 px-2 space-y-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* Show workflow groups */}
            {Array.from(workflowGroups.entries()).map(([workflowId, ops]) => (
              <WorkflowGroup 
                key={workflowId} 
                operations={ops}
                expandedWorkflows={expandedWorkflows}
                toggleWorkflow={toggleWorkflow}
              />
            ))}
            
            {/* Show standalone operations */}
            {standaloneOps.length > 0 && (
              <div className="space-y-1 py-1">
                {standaloneOps.map((op) => (
                  <ProgressItem key={op.id} operation={op} />
                ))}
              </div>
            )}
            
            {recentOperations.length === 0 && (
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
