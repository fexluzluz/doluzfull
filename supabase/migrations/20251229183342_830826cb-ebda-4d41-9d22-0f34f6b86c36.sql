-- Criar tabela de logs do sistema
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL, -- 'product_created', 'stock_entry', 'stock_exit', 'stock_balance', 'shipment_created', 'shipment_cancelled', etc.
  entity_type text NOT NULL, -- 'product', 'shipment', 'stock_movement', 'client', etc.
  entity_id uuid,
  description text NOT NULL,
  details jsonb,
  performed_by uuid NOT NULL,
  performed_by_name text,
  client_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Criar tabela de permissões de acesso aos logs
CREATE TABLE public.log_access_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_access_permissions ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário tem acesso aos logs
CREATE OR REPLACE FUNCTION public.has_log_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- É o Felipe (dono do sistema de logs)
    SELECT 1 FROM profiles WHERE user_id = _user_id AND LOWER(email) = 'felipe.luz@doluz.com.br'
    UNION
    -- Ou tem permissão concedida
    SELECT 1 FROM log_access_permissions WHERE user_id = _user_id
  )
$$;

-- Função para verificar se é o Felipe (owner dos logs)
CREATE OR REPLACE FUNCTION public.is_log_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = _user_id AND LOWER(email) = 'felipe.luz@doluz.com.br'
  )
$$;

-- Políticas para system_logs
CREATE POLICY "Users with log access can view logs"
ON public.system_logs
FOR SELECT
USING (has_log_access(auth.uid()));

CREATE POLICY "System can insert logs"
ON public.system_logs
FOR INSERT
WITH CHECK (true);

-- Políticas para log_access_permissions
CREATE POLICY "Log owner can manage permissions"
ON public.log_access_permissions
FOR ALL
USING (is_log_owner(auth.uid()));

CREATE POLICY "Users can view own permission"
ON public.log_access_permissions
FOR SELECT
USING (user_id = auth.uid());

-- Criar índices para performance
CREATE INDEX idx_system_logs_created_at ON public.system_logs(created_at DESC);
CREATE INDEX idx_system_logs_action_type ON public.system_logs(action_type);
CREATE INDEX idx_system_logs_entity_type ON public.system_logs(entity_type);
CREATE INDEX idx_system_logs_performed_by ON public.system_logs(performed_by);