CREATE OR REPLACE FUNCTION public.can_delete_client_products()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
 SELECT auth.uid() = 'c5191e4b-4f49-477d-b699-2affcbf014bd'::uuid
 AND public.get_user_client_id(auth.uid()) IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.can_delete_client_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_client_products() TO authenticated, service_role;
GRANT DELETE ON public.products TO authenticated;
CREATE POLICY "Authorized Sulvendas account can delete own products"
ON public.products FOR DELETE TO authenticated
USING (public.can_delete_client_products() AND client_id = public.get_user_client_id(auth.uid()));