-- Adicionar valor de manuseio por item para cada cliente
ALTER TABLE public.clients 
ADD COLUMN handling_fee_per_item NUMERIC(10,2) DEFAULT 4.50;

-- Adicionar valor total de manuseio ao pedido
ALTER TABLE public.shipment_requests 
ADD COLUMN handling_total NUMERIC(10,2) DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN public.clients.handling_fee_per_item IS 'Valor cobrado por item no manuseio';
COMMENT ON COLUMN public.shipment_requests.handling_total IS 'Total cobrado de manuseio neste envio';