-- Create receiving status enum
CREATE TYPE public.receiving_status AS ENUM ('pending', 'inspecting', 'completed', 'cancelled');

-- Create receiving_orders table
CREATE TABLE public.receiving_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number TEXT,
  invoice_url TEXT,
  supplier_name TEXT,
  expected_date DATE,
  received_date TIMESTAMP WITH TIME ZONE,
  status receiving_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID NOT NULL,
  completed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create receiving_items table
CREATE TABLE public.receiving_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receiving_id UUID NOT NULL REFERENCES public.receiving_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  has_damage BOOLEAN DEFAULT false,
  damage_notes TEXT,
  location_id UUID REFERENCES public.warehouse_locations(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receiving_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receiving_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for receiving_orders
CREATE POLICY "Authenticated users base access"
ON public.receiving_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all receiving orders"
ON public.receiving_orders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client receiving orders"
ON public.receiving_orders
FOR SELECT
USING (client_id = get_user_client_id(auth.uid()));

CREATE POLICY "Users can create receiving orders for own client"
ON public.receiving_orders
FOR INSERT
WITH CHECK (client_id = get_user_client_id(auth.uid()));

CREATE POLICY "Users can update own client receiving orders"
ON public.receiving_orders
FOR UPDATE
USING (client_id = get_user_client_id(auth.uid()));

-- RLS policies for receiving_items
CREATE POLICY "Authenticated users base access"
ON public.receiving_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all receiving items"
ON public.receiving_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client receiving items"
ON public.receiving_items
FOR SELECT
USING (receiving_id IN (
  SELECT id FROM public.receiving_orders WHERE client_id = get_user_client_id(auth.uid())
));

CREATE POLICY "Users can manage own client receiving items"
ON public.receiving_items
FOR INSERT
WITH CHECK (receiving_id IN (
  SELECT id FROM public.receiving_orders WHERE client_id = get_user_client_id(auth.uid())
));

CREATE POLICY "Users can update own client receiving items"
ON public.receiving_items
FOR UPDATE
USING (receiving_id IN (
  SELECT id FROM public.receiving_orders WHERE client_id = get_user_client_id(auth.uid())
));

-- Triggers for updated_at
CREATE TRIGGER update_receiving_orders_updated_at
  BEFORE UPDATE ON public.receiving_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_receiving_items_updated_at
  BEFORE UPDATE ON public.receiving_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();