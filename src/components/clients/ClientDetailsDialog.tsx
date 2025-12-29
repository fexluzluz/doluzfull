import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, User, Package, Box, Users, UserPlus, Trash2, ToggleLeft, ToggleRight, Mail, Loader2 } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import EmployeeForm from './EmployeeForm';

interface ClientDetailsDialogProps {
  client: any;
  onClose: () => void;
}

export default function ClientDetailsDialog({ client, onClose }: ClientDetailsDialogProps) {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      fetchDetails();
      setShowEmployeeForm(false);
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

  const toggleEmployeeStatus = async (employee: any) => {
    try {
      const { error } = await supabase
        .from('client_employees')
        .update({ is_active: !employee.is_active })
        .eq('id', employee.id);

      if (error) throw error;

      toast({ 
        title: employee.is_active ? 'Colaborador desativado' : 'Colaborador ativado' 
      });
      fetchDetails();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
    }
  };

  const deleteEmployee = async (employee: any) => {
    if (!confirm(`Tem certeza que deseja remover "${employee.profile?.full_name}" da equipe?`)) return;

    try {
      const { error } = await supabase
        .from('client_employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      toast({ title: 'Colaborador removido com sucesso' });
      fetchDetails();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover colaborador',
        description: error.message,
      });
    }
  };

  const resendInvite = async (employee: any) => {
    if (!employee.profile?.email) return;
    
    setResendingInvite(employee.id);
    try {
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: employee.profile.email,
          full_name: employee.profile.full_name,
          company_name: client.company_name,
        }
      });

      if (error) throw error;

      toast({ 
        title: 'Convite reenviado!',
        description: `Email enviado para ${employee.profile.email}`
      });
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao reenviar convite',
        description: error.message,
      });
    } finally {
      setResendingInvite(null);
    }
  };

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {client?.company_name}
          </DialogTitle>
        </DialogHeader>

        {client && (
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="collaborators" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Colaboradores ({employees.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
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
            </TabsContent>

            <TabsContent value="collaborators" className="space-y-4 mt-4">
              {showEmployeeForm ? (
                <EmployeeForm
                  client={{ id: client.id, company_name: client.company_name }}
                  onSuccess={() => {
                    setShowEmployeeForm(false);
                    fetchDetails();
                    toast({ title: 'Colaborador adicionado com sucesso!' });
                  }}
                  onCancel={() => setShowEmployeeForm(false)}
                />
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      Gerencie os colaboradores com acesso à conta deste cliente
                    </p>
                    <Button onClick={() => setShowEmployeeForm(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Convidar Colaborador
                    </Button>
                  </div>

                  {employees.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="font-medium mb-2">Nenhum colaborador cadastrado</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Convide colaboradores para gerenciar a conta deste cliente
                        </p>
                        <Button onClick={() => setShowEmployeeForm(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Convidar Primeiro Colaborador
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.map((employee) => (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">
                                {employee.profile?.full_name}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {employee.profile?.email}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {employee.profile?.phone || '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                                  {employee.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => resendInvite(employee)}
                                    disabled={resendingInvite === employee.id}
                                    title="Reenviar convite"
                                  >
                                    {resendingInvite === employee.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Mail className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleEmployeeStatus(employee)}
                                    title={employee.is_active ? 'Desativar' : 'Ativar'}
                                  >
                                    {employee.is_active ? (
                                      <ToggleRight className="h-4 w-4 text-primary" />
                                    ) : (
                                      <ToggleLeft className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteEmployee(employee)}
                                    title="Remover"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}