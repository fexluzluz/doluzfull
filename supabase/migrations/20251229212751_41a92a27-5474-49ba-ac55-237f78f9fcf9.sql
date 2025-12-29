-- Add max_stock_alert column to products table
ALTER TABLE public.products 
ADD COLUMN max_stock_alert integer DEFAULT NULL;

-- Add RLS policy for clients/employees to update their own products
CREATE POLICY "Users can update own client products" 
ON public.products 
FOR UPDATE 
USING (client_id = get_user_client_id(auth.uid()));

-- Add comment for documentation
COMMENT ON COLUMN public.products.max_stock_alert IS 'Maximum stock level alert threshold';