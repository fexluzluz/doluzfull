-- Create table for additional/custom charges per client per month
CREATE TABLE public.additional_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  reference_month DATE NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.additional_charges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all additional charges"
ON public.additional_charges
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users base access"
ON public.additional_charges
FOR SELECT
USING (true);

CREATE POLICY "Users can view own client additional charges"
ON public.additional_charges
FOR SELECT
USING (client_id = get_user_client_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_additional_charges_updated_at
BEFORE UPDATE ON public.additional_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();