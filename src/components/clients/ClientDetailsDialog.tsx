import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, User, Package, Box, Users } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';

interface ClientDetailsDialogProps {
  client: any;
  onClose: () => void;
}

export default function ClientDetailsDialog({ client, onClose }: ClientDetailsDialogProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (client) {
      fetchDetails();
    }
  }, [client]);

  const fetchDetails = async () => {
    if (!client) return;

    try {
      // Fetch employees
      const { data: employeesData } = await supabase
        .from('client_employees')
        .select('*, profile:profiles!client_employees_profile_id_fkey(full_name, email, phone)')
        .eq('client_id', client.id);

      setEmployees(employeesData?.map(e => ({
        ...e,
        profile: Array.isArray(e.profile) ? e.profile[0] : e.profile
      })) || []);

      // Fetch product count
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', client.id);

      setProductCount(count || 0);
    } catch (error) {
      console.error('Error fetching client details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {client?.company_name}
          </DialogTitle>
        </DialogHeader>

        {client && (
          <div className="space-y-6">
            {/* Company Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">CNPJ</p>
                <p className="font-medium">{client.cnpj || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Localização</p>
                <p className="font-medium">
                  {client.city && client.state ? `${client.city}/${client.state}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cadastrado em</p>
                <p className="font-medium">{formatDate(client.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Espaço Ocupado</p>
                <p className="font-medium">{formatNumber(Number(client.total_space_m3) || 0, 2)} m³</p>
              </div>
            </div>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{productCount}</p>
                    <p className="text-sm text-muted-foreground">Produtos</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="p-3 rounded-lg bg-accent/10">
                    <Box className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{formatNumber(Number(client.total_space_m3) || 0, 2)}</p>
                    <p className="text-sm text-muted-foreground">m³ ocupados</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Responsible */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{client.profile?.full_name}</p>
                      <p className="text-sm text-muted-foreground">{client.profile?.email}</p>
                      {client.profile?.phone && (
                        <p className="text-sm text-muted-foreground">{client.profile.phone}</p>
                      )}
                    </div>
                    <Badge>Proprietário</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Employees */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Funcionários ({employees.length})
              </h3>
              {employees.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum funcionário cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {employees.map((employee) => (
                    <Card key={employee.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{employee.profile?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{employee.profile?.email}</p>
                          </div>
                          <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                            {employee.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}