-- Add shipping_method column to shipment_requests
ALTER TABLE public.shipment_requests
ADD COLUMN shipping_method text DEFAULT 'other';

-- Add comment to describe the field
COMMENT ON COLUMN public.shipment_requests.shipping_method IS 'Shipping method: correios_avulso, flex_avulso, mercadolivre_agencia, mercadolivre_correios, shopee_agencia, shopee_flex, other';