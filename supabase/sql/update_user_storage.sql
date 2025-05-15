
-- Add storage breakdown column to user_storage table
ALTER TABLE user_storage 
ADD COLUMN IF NOT EXISTS storage_breakdown JSONB DEFAULT '{"videos": 0, "slides": 0, "frames": 0, "other": 0, "total": 0}'::JSONB;

-- Create a new function to update user storage with breakdown data
CREATE OR REPLACE FUNCTION public.update_user_storage_with_breakdown(
  user_id_param UUID, 
  new_storage_value BIGINT, 
  videos_size BIGINT DEFAULT 0,
  slides_size BIGINT DEFAULT 0,
  frames_size BIGINT DEFAULT 0,
  other_size BIGINT DEFAULT 0
)
RETURNS TABLE(previous_size BIGINT, new_size BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_storage_record public.user_storage;
  user_tier public.storage_tiers;
  previous_storage_size BIGINT;
  breakdown_json JSONB;
BEGIN
  -- Build the breakdown JSON
  breakdown_json := json_build_object(
    'videos', videos_size,
    'slides', slides_size,
    'frames', frames_size,
    'other', other_size,
    'total', new_storage_value
  )::JSONB;

  -- Get the user's storage record
  SELECT * INTO user_storage_record 
  FROM public.user_storage 
  WHERE user_id = user_id_param;
  
  -- If no record exists, create one with default tier
  IF user_storage_record IS NULL THEN
    SELECT * INTO user_tier 
    FROM public.storage_tiers 
    WHERE is_default = true 
    LIMIT 1;
    
    -- Store 0 as previous size
    previous_storage_size := 0;
    
    INSERT INTO public.user_storage (user_id, tier_id, storage_used, storage_breakdown)
    VALUES (user_id_param, user_tier.id, new_storage_value, breakdown_json)
    RETURNING * INTO user_storage_record;
  ELSE
    -- Store the current size before updating
    previous_storage_size := user_storage_record.storage_used;
    
    -- Update the storage used and breakdown
    UPDATE public.user_storage
    SET storage_used = new_storage_value,
        storage_breakdown = breakdown_json,
        updated_at = now()
    WHERE id = user_storage_record.id
    RETURNING * INTO user_storage_record;
  END IF;
  
  -- Return both the previous and new sizes
  RETURN QUERY SELECT 
    previous_storage_size AS previous_size,
    user_storage_record.storage_used AS new_size;
END;
$$;

-- Update the get_user_storage_info function to include the breakdown data
CREATE OR REPLACE FUNCTION public.get_user_storage_info()
RETURNS TABLE(storage_used BIGINT, storage_limit BIGINT, tier_name TEXT, percentage_used NUMERIC, tier_price NUMERIC, storage_breakdown JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_storage_record public.user_storage;
  user_tier public.storage_tiers;
BEGIN
  -- Get the user's storage record
  SELECT * INTO user_storage_record 
  FROM public.user_storage 
  WHERE user_id = auth.uid();
  
  -- If no record exists, create one with default tier
  IF user_storage_record IS NULL THEN
    SELECT * INTO user_tier 
    FROM public.storage_tiers 
    WHERE is_default = true 
    LIMIT 1;
    
    INSERT INTO public.user_storage (
      user_id, 
      tier_id, 
      storage_used, 
      storage_breakdown
    )
    VALUES (
      auth.uid(), 
      user_tier.id, 
      0,
      '{"videos": 0, "slides": 0, "frames": 0, "other": 0, "total": 0}'::JSONB
    )
    RETURNING * INTO user_storage_record;
  ELSE
    SELECT * INTO user_tier 
    FROM public.storage_tiers 
    WHERE id = user_storage_record.tier_id;
  END IF;
  
  -- Return the values
  storage_used := user_storage_record.storage_used;
  storage_limit := user_tier.storage_limit;
  tier_name := user_tier.name;
  percentage_used := CASE 
    WHEN user_tier.storage_limit > 0 THEN 
      (user_storage_record.storage_used * 100.0 / user_tier.storage_limit)
    ELSE 0
  END;
  tier_price := user_tier.price;
  storage_breakdown := user_storage_record.storage_breakdown;
  
  RETURN NEXT;
END;
$$;
