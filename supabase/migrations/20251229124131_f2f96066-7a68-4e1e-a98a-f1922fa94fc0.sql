-- Criar enum para roles do sistema
CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'employee');

-- Criar enum para status de envio
CREATE TYPE public.shipment_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de roles de usuários (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Tabela de clientes (empresas)
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  cnpj TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  total_space_m3 DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de funcionários (vinculados a clientes)
CREATE TABLE public.client_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  height_cm DECIMAL(10,2) NOT NULL DEFAULT 0,
  width_cm DECIMAL(10,2) NOT NULL DEFAULT 0,
  depth_cm DECIMAL(10,2) NOT NULL DEFAULT 0,
  weight_kg DECIMAL(10,3) DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_alert INTEGER DEFAULT 5,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(client_id, sku)
);

-- Tabela de movimentações de estoque (entrada/saída)
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entry', 'exit')),
  quantity INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de requisições de envio
CREATE TABLE public.shipment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  status shipment_status DEFAULT 'pending' NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_address TEXT NOT NULL,
  recipient_city TEXT NOT NULL,
  recipient_state TEXT NOT NULL,
  recipient_postal_code TEXT NOT NULL,
  shipping_label_url TEXT,
  invoice_url TEXT,
  tracking_code TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  processed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Tabela de itens do envio
CREATE TABLE public.shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES public.shipment_requests(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- Função para verificar role do usuário (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para obter o client_id do usuário (cliente ou funcionário)
CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- Se é um cliente, retorna o client_id diretamente
    (SELECT c.id FROM public.clients c 
     JOIN public.profiles p ON p.id = c.profile_id 
     WHERE p.user_id = _user_id),
    -- Se é um funcionário, retorna o client_id do empregador
    (SELECT ce.client_id FROM public.client_employees ce 
     JOIN public.profiles p ON p.id = ce.profile_id 
     WHERE p.user_id = _user_id AND ce.is_active = true)
  )
$$;

-- Função para calcular M³ de um produto
CREATE OR REPLACE FUNCTION public.calculate_product_m3(height_cm DECIMAL, width_cm DECIMAL, depth_cm DECIMAL)
RETURNS DECIMAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (height_cm * width_cm * depth_cm) / 1000000
$$;

-- Função para atualizar o espaço total do cliente
CREATE OR REPLACE FUNCTION public.update_client_space()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
  SET total_space_m3 = (
    SELECT COALESCE(SUM(
      public.calculate_product_m3(p.height_cm, p.width_cm, p.depth_cm) * p.quantity
    ), 0)
    FROM public.products p
    WHERE p.client_id = COALESCE(NEW.client_id, OLD.client_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger para atualizar espaço quando produto é modificado
CREATE TRIGGER update_client_space_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_client_space();

-- Função para criar perfil automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil quando usuário é criado
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipment_requests_updated_at
BEFORE UPDATE ON public.shipment_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================== RLS POLICIES ====================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

-- PROFILES: Usuários veem seu próprio perfil, admins veem todos
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- USER_ROLES: Apenas admins podem gerenciar roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

-- CLIENTS: Admins veem todos, clientes veem próprio, funcionários veem seu empregador
CREATE POLICY "Admins can manage all clients" ON public.clients
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view own data" ON public.clients
FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  OR id = public.get_user_client_id(auth.uid())
);

CREATE POLICY "Clients can update own data" ON public.clients
FOR UPDATE USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- CLIENT_EMPLOYEES: Admins gerenciam todos, clientes gerenciam seus funcionários
CREATE POLICY "Admins can manage all employees" ON public.client_employees
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can manage own employees" ON public.client_employees
FOR ALL USING (
  client_id IN (
    SELECT c.id FROM public.clients c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Employees can view own record" ON public.client_employees
FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- PRODUCTS: Admins veem todos, clientes/funcionários veem do seu cliente
CREATE POLICY "Admins can manage all products" ON public.products
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own client products" ON public.products
FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

-- STOCK_MOVEMENTS: Admins gerenciam todos, clientes/funcionários veem do seu cliente
CREATE POLICY "Admins can manage all movements" ON public.stock_movements
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own client movements" ON public.stock_movements
FOR SELECT USING (
  product_id IN (
    SELECT id FROM public.products WHERE client_id = public.get_user_client_id(auth.uid())
  )
);

CREATE POLICY "Users can insert movements for own client" ON public.stock_movements
FOR INSERT WITH CHECK (
  product_id IN (
    SELECT id FROM public.products WHERE client_id = public.get_user_client_id(auth.uid())
  ) OR public.has_role(auth.uid(), 'admin')
);

-- SHIPMENT_REQUESTS: Admins gerenciam todos, clientes/funcionários gerenciam do seu cliente
CREATE POLICY "Admins can manage all shipments" ON public.shipment_requests
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own client shipments" ON public.shipment_requests
FOR SELECT USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Users can create shipments for own client" ON public.shipment_requests
FOR INSERT WITH CHECK (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Users can update own client shipments" ON public.shipment_requests
FOR UPDATE USING (client_id = public.get_user_client_id(auth.uid()));

-- SHIPMENT_ITEMS: Seguem as permissões do shipment
CREATE POLICY "Admins can manage all shipment items" ON public.shipment_items
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own client shipment items" ON public.shipment_items
FOR SELECT USING (
  shipment_id IN (
    SELECT id FROM public.shipment_requests WHERE client_id = public.get_user_client_id(auth.uid())
  )
);

CREATE POLICY "Users can manage own client shipment items" ON public.shipment_items
FOR INSERT WITH CHECK (
  shipment_id IN (
    SELECT id FROM public.shipment_requests WHERE client_id = public.get_user_client_id(auth.uid())
  )
);

-- Storage bucket para uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

-- Políticas de storage
CREATE POLICY "Users can upload files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view uploads" ON storage.objects
FOR SELECT USING (bucket_id = 'uploads');

CREATE POLICY "Users can update own uploads" ON storage.objects
FOR UPDATE USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own uploads" ON storage.objects
FOR DELETE USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);