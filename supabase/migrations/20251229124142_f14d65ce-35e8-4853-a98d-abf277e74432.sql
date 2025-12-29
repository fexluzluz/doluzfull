-- Corrigir funções sem search_path definido
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_product_m3(height_cm DECIMAL, width_cm DECIMAL, depth_cm DECIMAL)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (height_cm * width_cm * depth_cm) / 1000000
$$;