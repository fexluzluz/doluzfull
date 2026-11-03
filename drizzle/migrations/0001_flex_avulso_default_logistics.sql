CREATE OR REPLACE FUNCTION public.apply_flex_avulso_logistics()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.shipping_method = 'flex_avulso'
     AND NEW.status <> 'cancelled'
     AND COALESCE(NEW.logistics_cost, 0) = 0
     AND (TG_OP = 'INSERT' OR OLD.shipping_method IS DISTINCT FROM NEW.shipping_method) THEN
    NEW.logistics_cost := 15.90;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_flex_avulso_logistics_trigger
BEFORE INSERT OR UPDATE OF shipping_method ON public.shipment_requests
FOR EACH ROW EXECUTE FUNCTION public.apply_flex_avulso_logistics();