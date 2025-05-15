
import { supabase } from "@/integrations/supabase/client";

export interface UsageStatistics {
  totalTokens: number;
  apiRequests: number;
  estimatedCost: number;
  lastUsed: string | null;
}

export interface DailyUsage {
  day: string;
  tokens: number;
  cost: number;
}

export interface StorageInfo {
  storageUsed: number;
  storageLimit: number;
  tierName: string;
  percentageUsed: number;
  tierPrice: number;
  storage_breakdown?: any; // Include the storage_breakdown field from the database
  breakdown?: StorageBreakdown; // Processed breakdown for frontend use
}

export interface StorageBreakdown {
  videos: number;
  slides: number;
  frames: number;
  other: number;
  total: number;
}

/**
 * Fetches overall token usage statistics for the current user
 */
export const fetchTotalUsageStats = async (): Promise<UsageStatistics> => {
  const { data, error } = await supabase
    .rpc('get_user_token_stats');

  if (error) {
    console.error('Error fetching usage statistics:', error);
    throw error;
  }

  // If no data is returned (no usage yet), return default values
  if (!data) {
    return {
      totalTokens: 0,
      apiRequests: 0,
      estimatedCost: 0,
      lastUsed: null,
    };
  }

  // The data comes as an array with a single row, so we need to extract the first element
  const statsData = Array.isArray(data) ? data[0] : data;

  // Return the data
  return {
    totalTokens: statsData.total_tokens || 0,
    apiRequests: statsData.api_requests || 0,
    estimatedCost: statsData.estimated_cost || 0,
    lastUsed: statsData.last_used || null,
  };
};

/**
 * Fetches daily token usage for the specified time period
 * @param days Number of days to fetch (default: 7 for one week)
 */
export const fetchDailyUsage = async (days: number = 7): Promise<DailyUsage[]> => {
  const { data, error } = await supabase
    .rpc('get_daily_token_usage', { 
      days_to_fetch: days 
    });

  if (error) {
    console.error('Error fetching daily usage statistics:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    // Generate empty data for the requested number of days
    const emptyData: DailyUsage[] = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      emptyData.push({
        day: dayName,
        tokens: 0,
        cost: 0,
      });
    }
    
    return emptyData;
  }

  // Format the data for the chart
  return data.map((item: any) => ({
    day: new Date(item.usage_date).toLocaleDateString('en-US', { weekday: 'short' }),
    tokens: item.total_tokens || 0,
    cost: item.estimated_cost || 0,
  }));
};

/**
 * Resets the user's token usage statistics
 */
export const resetUsageStats = async (): Promise<void> => {
  const { error } = await supabase
    .rpc('reset_user_token_stats');

  if (error) {
    console.error('Error resetting usage statistics:', error);
    throw error;
  }
};

/**
 * Fetches user's storage information
 */
export const fetchStorageInfo = async (): Promise<StorageInfo | null> => {
  const { data, error } = await supabase
    .rpc('get_user_storage_info');

  if (error) {
    console.error('Error fetching storage information:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  // The data comes as an array with a single row, so we need to extract the first element
  const storageData = Array.isArray(data) ? data[0] : data;

  // Process the storage breakdown data if available
  let breakdown: StorageBreakdown | undefined;
  
  if (storageData.storage_breakdown) {
    breakdown = storageData.storage_breakdown as StorageBreakdown;
  }

  return {
    storageUsed: storageData.storage_used || 0,
    storageLimit: storageData.storage_limit || 0,
    tierName: storageData.tier_name || 'Free',
    percentageUsed: storageData.percentage_used || 0,
    tierPrice: storageData.tier_price || 0,
    breakdown
  };
};

/**
 * Fetches storage breakdown data for the current user
 */
export const fetchStorageBreakdown = async (): Promise<StorageBreakdown | null> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      return null;
    }
    
    // First check if we have the breakdown in user_storage
    const { data: userData } = await supabase
      .from('user_storage')
      .select('storage_breakdown')
      .maybeSingle();
    
    if (userData && userData.storage_breakdown) {
      return userData.storage_breakdown as StorageBreakdown;
    }
    
    // If not available, call the edge function to calculate it
    const response = await supabase.functions.invoke('get-storage-breakdown');
    
    if (response.error) {
      throw new Error(`Failed to get storage breakdown: ${response.error.message || 'Unknown error'}`);
    }
    
    if (response.data && response.data.breakdown) {
      return response.data.breakdown;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching storage breakdown:', error);
    return null;
  }
};
