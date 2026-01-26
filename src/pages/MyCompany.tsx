import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2, MapPin, Phone, Mail, User } from 'lucide-react';

interface ClientData {
  id: string;
  company_name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  total_space_m3: number | null;
  profile: {
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

export default function MyCompany() {
  const { clientId } = useAuth();
  const [client, setClient] = useState<ClientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          cnpj,
          address,
          city,
          state,
          postal_code,
          total_space_m3,
          profile:profiles!clients_profile_id_fkey (
            full_name,
            email,
            phone
          )
        `)
        .eq('id', clientId)
        .single();

      if (!error && data) {
        setClient(data as ClientData);
      }
      setIsLoading(false);
    };

    fetchClientData();
  }, [clientId]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Nenhuma empresa vinculada</h2>
          <p className="text-muted-foreground">
            Você não está vinculado a nenhuma empresa no momento.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Minha Empresa</h1>
          <p className="text-muted-foreground">Informações da sua empresa</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados da Empresa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Razão Social</p>
                <p className="font-medium">{client.company_name}</p>
              </div>
              {client.cnpj && (
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ</p>
                  <p className="font-medium">{client.cnpj}</p>
                </div>
              )}
              {client.total_space_m3 !== null && (
                <div>
                  <p className="text-sm text-muted-foreground">Espaço Total Ocupado</p>
                  <p className="font-medium">{client.total_space_m3.toFixed(4)} m³</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.address ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Logradouro</p>
                    <p className="font-medium">{client.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {client.city && (
                      <div>
                        <p className="text-sm text-muted-foreground">Cidade</p>
                        <p className="font-medium">{client.city}</p>
                      </div>
                    )}
                    {client.state && (
                      <div>
                        <p className="text-sm text-muted-foreground">Estado</p>
                        <p className="font-medium">{client.state}</p>
                      </div>
                    )}
                  </div>
                  {client.postal_code && (
                    <div>
                      <p className="text-sm text-muted-foreground">CEP</p>
                      <p className="font-medium">{client.postal_code}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Endereço não cadastrado</p>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{client.profile?.full_name || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">E-mail</p>
                    <p className="font-medium">{client.profile?.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{client.profile?.phone || 'Não informado'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
