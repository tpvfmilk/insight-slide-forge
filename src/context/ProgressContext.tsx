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
  isActive: boolean;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

// Maximum number of operations to keep in history
const MAX_OPERATIONS_HISTORY = 30;

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [operations, setOperations] = useState<ProgressOperation[]>([]);

  // Generate a unique ID for operations
  const generateId = useCallback(() => {
    return `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

  // Get recent operations, sorted by timestamp (newest first)
  const getRecentOperations = useCallback(() => {
    return [...operations].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
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
  const { addOperation, updateOperation, completeOperation } = useProgress();
  
  const startOperation = useCallback(
    (
      type: OperationType,
      title: string,
      message: string,
      initialProgress = 0
    ) => {
      const id = addOperation({
        type,
        title,
        message,
        progress: initialProgress,
        status: 'running',
        details: '',
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
        updateProgress,
        finishOperation,
      };
    },
    [addOperation, updateOperation, completeOperation]
  );

  return { startOperation };
}
