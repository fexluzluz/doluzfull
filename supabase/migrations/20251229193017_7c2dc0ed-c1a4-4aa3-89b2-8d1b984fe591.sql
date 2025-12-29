-- Add billing configuration columns to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'per_unit' CHECK (billing_type IN ('fixed', 'per_unit', 'combined')),
ADD COLUMN IF NOT EXISTS fixed_storage_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS storage_fee_per_m3 numeric DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.clients.billing_type IS 'Tipo de cobrança: fixed (taxa fixa), per_unit (por m³ unitário), combined (ambos)';
COMMENT ON COLUMN public.clients.fixed_storage_fee IS 'Taxa fixa mensal de armazenagem';
COMMENT ON COLUMN public.clients.storage_fee_per_m3 IS 'Taxa por metro cúbico de armazenagem';