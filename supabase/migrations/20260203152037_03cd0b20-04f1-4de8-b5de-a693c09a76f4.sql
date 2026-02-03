-- Add logistics cost column to shipment_requests
ALTER TABLE public.shipment_requests
ADD COLUMN logistics_cost numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.shipment_requests.logistics_cost IS 'Valor cobrado pela logística/frete definido pelo admin';