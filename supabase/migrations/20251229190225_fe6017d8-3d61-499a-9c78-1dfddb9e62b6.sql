-- Create picking status enum
CREATE TYPE public.picking_status AS ENUM ('pending', 'picking', 'picked', 'packing', 'packed', 'ready');

-- Create picking_orders table
CREATE TABLE public.picking_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipment_requests(id) ON DELETE CASCADE UNIQUE,
  status picking_status NOT NULL DEFAULT 'pending',
  picker_id UUID,
  packer_id UUID,
  picking_started_at TIMESTAMP WITH TIME ZONE,
  picking_completed_at TIMESTAMP WITH TIME ZONE,
  packing_started_at TIMESTAMP WITH TIME ZONE,
  packing_completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create picking_items table
CREATE TABLE public.picking_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  picking_order_id UUID NOT NULL REFERENCES public.picking_orders(id) ON DELETE CASCADE,
  shipment_item_id UUID NOT NULL REFERENCES public.shipment_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.warehouse_locations(id),
  quantity INTEGER NOT NULL,
  picked_quantity INTEGER DEFAULT 0,
  picked_at TIMESTAMP WITH TIME ZONE,
  picked_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.picking_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.picking_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for picking_orders
CREATE POLICY "Authenticated users base access"
ON public.picking_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all picking orders"
ON public.picking_orders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client picking orders"
ON public.picking_orders
FOR SELECT
USING (shipment_id IN (
  SELECT id FROM public.shipment_requests WHERE client_id = get_user_client_id(auth.uid())
));

-- RLS policies for picking_items
CREATE POLICY "Authenticated users base access"
ON public.picking_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all picking items"
ON public.picking_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client picking items"
ON public.picking_items
FOR SELECT
USING (picking_order_id IN (
  SELECT po.id FROM public.picking_orders po
  JOIN public.shipment_requests sr ON sr.id = po.shipment_id
  WHERE sr.client_id = get_user_client_id(auth.uid())
));

-- Triggers for updated_at
CREATE TRIGGER update_picking_orders_updated_at
  BEFORE UPDATE ON public.picking_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_picking_items_updated_at
  BEFORE UPDATE ON public.picking_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();