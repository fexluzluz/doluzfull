
-- Add fields to receiving_orders for temporary cargo handling
ALTER TABLE public.receiving_orders 
ADD COLUMN IF NOT EXISTS is_temporary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS discharged_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS discharged_by uuid;

-- Add flag to receiving_items to track if stored in main inventory
ALTER TABLE public.receiving_items
ADD COLUMN IF NOT EXISTS is_stored boolean DEFAULT false;

-- Create a function to calculate storage days
CREATE OR REPLACE FUNCTION public.calculate_storage_days(received_date timestamp with time zone, discharged_at timestamp with time zone)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN received_date IS NOT NULL AND discharged_at IS NOT NULL 
    THEN GREATEST(1, EXTRACT(DAY FROM (discharged_at - received_date))::integer)
    ELSE NULL
  END
$function$;

COMMENT ON COLUMN public.receiving_orders.is_temporary IS 'Indicates if this is a temporary cargo that will be discharged later';
COMMENT ON COLUMN public.receiving_orders.discharged_at IS 'Date when the temporary cargo was discharged';
COMMENT ON COLUMN public.receiving_orders.discharged_by IS 'User who discharged the temporary cargo';
COMMENT ON COLUMN public.receiving_items.is_stored IS 'Indicates if this item was stored in the main inventory';
