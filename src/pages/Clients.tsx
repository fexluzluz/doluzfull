import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Users, Building2, Edit, Trash2, UserPlus, Eye } from 'lucide-react';
import { formatNumber, formatDate } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import ClientForm from '@/components/clients/ClientForm';
import ClientDetailsDialog from '@/components/clients/ClientDetailsDialog';
import EmployeeForm from '@/components/clients/EmployeeForm';

interface ClientData {
  id: string;
  company_name: string;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  total_space_m3: number;
  created_at: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  } | null;
}

export default function Clients() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [viewingClient, setViewingClient] = useState<ClientData | null>(null);
  const [addEmployeeClient, setAddEmployeeClient] = useState<ClientData | null>(null);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          id,
          company_name,
          cnpj,
          city,
          state,
          total_space_m3,
          created_at,
          profile:profiles!clients_profile_id_fkey(id, full_name, email, phone)
        `)
        .order('company_name');

      if (error) throw error;

      setClients(data?.map(c => ({
        ...c,
        profile: Array.isArray(c.profile) ? c.profile[0] : c.profile
      })) || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar clientes',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchClients();
    }
  }, [isAdmin]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleDelete = async (client: ClientData) => {
    if (!confirm(`Tem certeza que deseja excluir "${client.company_name}"? Isso também excluirá todos os produtos e envios relacionados.`)) return;

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      toast({ title: 'Cliente excluído com sucesso!' });
      fetchClients();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir cliente',
        description: error.message,
      });
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingClient(null);
    fetchClients();
  };

  const handleEdit = (client: ClientData) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const filteredClients = clients.filter(
    (c) =>
      c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj?.includes(searchTerm)
  );

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Clientes</h1>
            <p className="page-description">Gerencie as empresas e seus usuários</p>
          </div>
          <Dialog open={isFormOpen} onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingClient(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                </DialogTitle>
              </DialogHeader>
              <ClientForm
                client={editingClient}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setIsFormOpen(false);
                  setEditingClient(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou CNPJ..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Lista de Clientes ({filteredClients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando clientes...
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Espaço (m³)</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.company_name}</p>
                          {client.cnpj && (
                            <p className="text-xs text-muted-foreground">{client.cnpj}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{client.profile?.full_name || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.profile?.email || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.city && client.state ? `${client.city}/${client.state}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(Number(client.total_space_m3) || 0, 2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(client.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingClient(client)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setAddEmployeeClient(client)}
                            title="Adicionar funcionário"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(client)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(client)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Details Dialog */}
      <ClientDetailsDialog
        client={viewingClient}
        onClose={() => setViewingClient(null)}
      />

      {/* Add Employee Dialog */}
      <Dialog open={!!addEmployeeClient} onOpenChange={(open) => !open && setAddEmployeeClient(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Funcionário</DialogTitle>
          </DialogHeader>
          {addEmployeeClient && (
            <EmployeeForm
              client={addEmployeeClient}
              onSuccess={() => {
                setAddEmployeeClient(null);
                toast({ title: 'Funcionário adicionado com sucesso!' });
              }}
              onCancel={() => setAddEmployeeClient(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}