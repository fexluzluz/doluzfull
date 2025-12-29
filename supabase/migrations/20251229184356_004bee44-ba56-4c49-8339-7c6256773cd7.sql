-- Fix RLS policies for all tables to require authentication
-- The issue is that all policies are RESTRICTIVE but need at least one PERMISSIVE base policy

-- PROFILES TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- SHIPMENT_REQUESTS TABLE  
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.shipment_requests
FOR SELECT
TO authenticated
USING (true);

-- CLIENTS TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.clients
FOR SELECT
TO authenticated
USING (true);

-- PRODUCTS TABLE
-- Add base permissive policy for authenticated users  
CREATE POLICY "Authenticated users base access"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- CLIENT_EMPLOYEES TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.client_employees
FOR SELECT
TO authenticated
USING (true);

-- STOCK_MOVEMENTS TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (true);

-- SHIPMENT_ITEMS TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.shipment_items
FOR SELECT
TO authenticated
USING (true);

-- USER_ROLES TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- SYSTEM_LOGS TABLE
-- Add base permissive policy for authenticated users (still protected by has_log_access)
CREATE POLICY "Authenticated users base access"
ON public.system_logs
FOR SELECT
TO authenticated
USING (true);

-- LOG_ACCESS_PERMISSIONS TABLE
-- Add base permissive policy for authenticated users
CREATE POLICY "Authenticated users base access"
ON public.log_access_permissions
FOR SELECT
TO authenticated
USING (true);