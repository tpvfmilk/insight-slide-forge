
import React, { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';

// Define types for operations and progress tracking
export type OperationType = 
  | 'upload' 
  | 'transcription' 
  | 'chunking' 
  | 'extraction' 
  | 'generation'
  | 'processing'
  | 'download';

export type OperationStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface ProgressOperation {
  id: string;
  type: OperationType;
  title: string;
  message: string;
  progress: number;
  status: OperationStatus;
  timestamp: Date;
  details?: string;
  // New fields for operation sequencing
  step?: number;
  parentId?: string;
  workflowId?: string;
  workflowName?: string;
}

interface ProgressContextType {
  operations: ProgressOperation[];
  addOperation: (operation: Omit<ProgressOperation, 'id' | 'timestamp'>) => string;
  updateOperation: (id: string, updates: Partial<ProgressOperation>) => void;
  completeOperation: (id: string, success?: boolean) => void;
  removeOperation: (id: string) => void;
  clearCompletedOperations: () => void;
  clearAllOperations: () => void;
  getActiveOperations: () => ProgressOperation[];
  getRecentOperations: () => ProgressOperation[];
  getWorkflowOperations: (workflowId: string) => ProgressOperation[];
  getOperationById: (id: string) => ProgressOperation | undefined;
  createWorkflow: (name: string) => string;
  isActive: boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

// Maximum number of operations to keep in history
const MAX_OPERATIONS_HISTORY = 50;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [operations, setOperations] = useState<ProgressOperation[]>([]);

  // Generate a unique ID for operations
  const generateId = useCallback(() => {
    return `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  // Create a workflow ID that groups related operations
  const createWorkflow = useCallback((name: string) => {
    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    return workflowId;
  }, []);

  // Add a new operation and return its ID
  const addOperation = useCallback((operation: Omit<ProgressOperation, 'id' | 'timestamp'>) => {
    const id = generateId();
    const newOperation: ProgressOperation = {
      ...operation,
      id,
      timestamp: new Date(),
    };

    setOperations(prev => {
      // Keep only the most recent operations up to MAX_OPERATIONS_HISTORY
      const updatedOps = [newOperation, ...prev];
      if (updatedOps.length > MAX_OPERATIONS_HISTORY) {
        return updatedOps.slice(0, MAX_OPERATIONS_HISTORY);
      }
      return updatedOps;
    });

    return id;
  }, [generateId]);

  // Update an existing operation
  const updateOperation = useCallback((id: string, updates: Partial<ProgressOperation>) => {
    setOperations(prev => 
      prev.map(op => 
        op.id === id ? { ...op, ...updates } : op
      )
    );
  }, []);

  // Mark an operation as completed or failed
  const completeOperation = useCallback((id: string, success = true) => {
    setOperations(prev => 
      prev.map(op => 
        op.id === id 
          ? { 
              ...op, 
              status: success ? 'completed' : 'failed',
              progress: success ? 100 : op.progress
            } 
          : op
      )
    );
  }, []);

  // Remove an operation
  const removeOperation = useCallback((id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  // Clear completed operations
  const clearCompletedOperations = useCallback(() => {
    setOperations(prev => 
      prev.filter(op => op.status === 'pending' || op.status === 'running')
    );
  }, []);

  // Clear all operations
  const clearAllOperations = useCallback(() => {
    setOperations([]);
  }, []);

  // Get active (running) operations
  const getActiveOperations = useCallback(() => {
    return operations.filter(op => op.status === 'pending' || op.status === 'running');
  }, [operations]);

  // Get operations that belong to a specific workflow
  const getWorkflowOperations = useCallback((workflowId: string) => {
    return operations
      .filter(op => op.workflowId === workflowId)
      .sort((a, b) => {
        // Sort by step number if available
        if (a.step !== undefined && b.step !== undefined) {
          return a.step - b.step;
        }
        // Otherwise sort by timestamp
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
  }, [operations]);
  
  // Get operation by ID
  const getOperationById = useCallback((id: string) => {
    return operations.find(op => op.id === id);
  }, [operations]);

  // Get recent operations, grouped by workflow when possible
  const getRecentOperations = useCallback(() => {
    // First, group operations by workflow
    const workflowMap = new Map<string | undefined, ProgressOperation[]>();
    
    operations.forEach(op => {
      if (op.workflowId) {
        const existing = workflowMap.get(op.workflowId) || [];
        workflowMap.set(op.workflowId, [...existing, op]);
      } else {
        // For standalone operations, use their ID as the key
        workflowMap.set(op.id, [op]);
      }
    });
    
    // Flatten the map values and sort workflows by most recent op in each
    const result: ProgressOperation[] = [];
    
    // Get all workflow IDs, sorted by the most recent operation in each workflow
    const sortedWorkflowIds = Array.from(workflowMap.keys()).sort((a, b) => {
      const opsA = workflowMap.get(a) || [];
      const opsB = workflowMap.get(b) || [];
      
      const latestA = Math.max(...opsA.map(op => op.timestamp.getTime()));
      const latestB = Math.max(...opsB.map(op => op.timestamp.getTime()));
      
      return latestB - latestA; // Most recent first
    });
    
    // Add operations from each workflow in order
    sortedWorkflowIds.forEach(workflowId => {
      const workflowOps = workflowMap.get(workflowId) || [];
      // Sort operations within a workflow by step or timestamp
      const sortedOps = workflowOps.sort((a, b) => {
        if (a.step !== undefined && b.step !== undefined) {
          return a.step - b.step;
        }
        return a.timestamp.getTime() - b.timestamp.getTime();
      });
      
      result.push(...sortedOps);
    });
    
    return result;
  }, [operations]);

  // Check if there's any active operation
  const isActive = useMemo(() => {
    return operations.some(op => op.status === 'pending' || op.status === 'running');
  }, [operations]);

  const value = {
    operations,
    addOperation,
    updateOperation,
    completeOperation,
    removeOperation,
    clearCompletedOperations,
    clearAllOperations,
    getActiveOperations,
    getRecentOperations,
    getWorkflowOperations,
    getOperationById,
    createWorkflow,
    isActive
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}

// Hook to create and track a progress operation
export function useProgressOperation() {
  const { addOperation, updateOperation, completeOperation, createWorkflow, getOperationById } = useProgress();
  
  const startOperation = useCallback(
    (
      type: OperationType,
      title: string,
      message: string,
      options?: {
        initialProgress?: number;
        parentId?: string;
        workflowId?: string;
        workflowName?: string;
        step?: number;
      }
    ) => {
      // Create a new workflow ID if a workflow name is provided but no ID
      const actualWorkflowId = options?.workflowName && !options?.workflowId 
        ? createWorkflow(options.workflowName)
        : options?.workflowId;
        
      const id = addOperation({
        type,
        title,
        message,
        progress: options?.initialProgress ?? 0,
        status: 'running',
        details: '',
        parentId: options?.parentId,
        workflowId: actualWorkflowId,
        workflowName: options?.workflowName,
        step: options?.step
      });

      const updateProgress = (progress: number, message?: string) => {
        updateOperation(id, { 
          progress: Math.min(Math.max(0, progress), 100),
          ...(message ? { message } : {})
        });
      };

      const finishOperation = (success = true, message?: string) => {
        completeOperation(id, success);
        if (message) {
          updateOperation(id, { message });
        }
      };

      return {
        id,
        workflowId: actualWorkflowId,
        updateProgress,
        finishOperation,
      };
    },
    [addOperation, updateOperation, completeOperation, createWorkflow]
  );
  
  // Create a workflow with multiple sequential steps
  const startWorkflow = useCallback(
    (workflowName: string, operations: {
      type: OperationType;
      title: string;
      message: string;
    }[]) => {
      const workflowId = createWorkflow(workflowName);
      
      const workflowOperations = operations.map((operation, index) => {
        const id = addOperation({
          ...operation,
          progress: index === 0 ? 0 : 0,
          status: index === 0 ? 'running' : 'pending',
          workflowId,
          workflowName,
          step: index + 1
        });
        
        return id;
      });
      
      const updateWorkflowProgress = (step: number, progress: number, message?: string) => {
        if (step > 0 && step <= workflowOperations.length) {
          const operationId = workflowOperations[step - 1];
          updateOperation(operationId, { 
            progress: Math.min(Math.max(0, progress), 100),
            status: 'running',
            ...(message ? { message } : {})
          });
          
          // Make sure previous steps are completed
          for (let i = 0; i < step - 1; i++) {
            updateOperation(workflowOperations[i], { 
              progress: 100,
              status: 'completed'
            });
          }
        }
      };
      
      const completeWorkflowStep = (step: number, success = true, message?: string) => {
        if (step > 0 && step <= workflowOperations.length) {
          const operationId = workflowOperations[step - 1];
          completeOperation(operationId, success);
          
          if (message) {
            updateOperation(operationId, { message });
          }
          
          // Start next step if this one was successful
          if (success && step < workflowOperations.length) {
            updateOperation(workflowOperations[step], { status: 'running' });
          }
        }
      };
      
      const completeWorkflow = (success = true) => {
        workflowOperations.forEach(opId => {
          const op = getOperationById(opId);
          if (op && (op.status === 'pending' || op.status === 'running')) {
            completeOperation(opId, success);
          }
        });
      };
      
      return {
        workflowId,
        operationIds: workflowOperations,
        getOperationById,
        updateWorkflowProgress,
        completeWorkflowStep,
        completeWorkflow
      };
    },
    [addOperation, updateOperation, completeOperation, createWorkflow, getOperationById]
  );

  return { 
    startOperation,
    startWorkflow
  };
}

// Hook for workflow operations
export function useWorkflowProgress() {
  const { startWorkflow } = useProgressOperation();
  const { getWorkflowOperations } = useProgress();
  
  return {
    startWorkflow,
    getWorkflowOperations
  };
}
