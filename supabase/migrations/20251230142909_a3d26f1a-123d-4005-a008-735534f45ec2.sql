
-- Add volume field to receiving_orders for temporary cargo m³ calculation
ALTER TABLE public.receiving_orders 
ADD COLUMN IF NOT EXISTS temporary_volume_m3 numeric DEFAULT 0;

COMMENT ON COLUMN public.receiving_orders.temporary_volume_m3 IS 'Volume in cubic meters for temporary cargo billing';
