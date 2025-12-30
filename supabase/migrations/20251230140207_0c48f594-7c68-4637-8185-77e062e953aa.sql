-- Create a new function to calculate billable volume considering max stacking of 5 items
CREATE OR REPLACE FUNCTION public.calculate_billable_m3(height_cm numeric, width_cm numeric, depth_cm numeric, quantity integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT (height_cm * width_cm * depth_cm) / 1000000 * CEIL(quantity::numeric / 5) * 5
$function$;

-- Update the trigger function to use the new stacking logic
CREATE OR REPLACE FUNCTION public.update_client_space()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.clients
  SET total_space_m3 = (
    SELECT COALESCE(SUM(
      public.calculate_billable_m3(p.height_cm, p.width_cm, p.depth_cm, p.quantity)
    ), 0)
    FROM public.products p
    WHERE p.client_id = COALESCE(NEW.client_id, OLD.client_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;