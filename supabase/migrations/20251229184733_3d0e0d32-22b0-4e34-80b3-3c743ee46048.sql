-- Create warehouse_locations table for physical locations
CREATE TABLE public.warehouse_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aisle TEXT NOT NULL, -- Rua
  shelf TEXT NOT NULL, -- Prateleira
  bin TEXT NOT NULL, -- Bin/Posição
  description TEXT,
  max_capacity_m3 NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aisle, shelf, bin)
);

-- Create product_locations table for many-to-many relationship
CREATE TABLE public.product_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, location_id)
);

-- Enable RLS
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for warehouse_locations
CREATE POLICY "Authenticated users base access"
ON public.warehouse_locations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all locations"
ON public.warehouse_locations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for product_locations
CREATE POLICY "Authenticated users base access"
ON public.product_locations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage all product locations"
ON public.product_locations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own client product locations"
ON public.product_locations
FOR SELECT
USING (product_id IN (
  SELECT id FROM public.products WHERE client_id = get_user_client_id(auth.uid())
));

-- Triggers for updated_at
CREATE TRIGGER update_warehouse_locations_updated_at
  BEFORE UPDATE ON public.warehouse_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_locations_updated_at
  BEFORE UPDATE ON public.product_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();