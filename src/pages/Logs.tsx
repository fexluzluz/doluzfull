import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLogAccess } from "@/hooks/useLogAccess";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, UserPlus, Trash2, ShieldCheck, ScrollText } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Json } from "@/integrations/supabase/types";

interface SystemLog {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  details: Json | null;
  performed_by: string;
  performed_by_name: string | null;
  client_id: string | null;
  created_at: string;
}

interface LogPermission {
  id: string;
  user_id: string;
  granted_by: string;
  created_at: string;
  profile?: {
    full_name: string;
    email: string;
  };
}

const actionTypeLabels: Record<string, string> = {
  product_created: "Produto Criado",
  product_updated: "Produto Atualizado",
  product_deleted: "Produto Excluído",
  stock_entry: "Entrada de Estoque",
  stock_exit: "Saída de Estoque",
  stock_balance: "Balanço de Estoque",
  shipment_created: "Pedido Criado",
  shipment_updated: "Pedido Atualizado",
  shipment_cancelled: "Pedido Cancelado",
  shipment_status_changed: "Status Alterado",
  client_created: "Cliente Criado",
  client_updated: "Cliente Atualizado",
  employee_created: "Funcionário Criado",
  employee_updated: "Funcionário Atualizado",
  login: "Login",
  logout: "Logout",
};

const entityTypeLabels: Record<string, string> = {
  product: "Produto",
  shipment: "Pedido",
  stock_movement: "Movimentação",
  client: "Cliente",
  employee: "Funcionário",
  auth: "Autenticação",
};

const Logs = () => {
  const { isLoading: authLoading } = useAuth();
  const { hasLogAccess, isLogOwner, isLoading: accessLoading } = useLogAccess();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterActionType, setFilterActionType] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [permissionEmail, setPermissionEmail] = useState("");
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);

  // Query logs
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['system-logs', filterActionType, filterEntityType],
    queryFn: async () => {
      let query = supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (filterActionType !== 'all') {
        query = query.eq('action_type', filterActionType);
      }
      if (filterEntityType !== 'all') {
        query = query.eq('entity_type', filterEntityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SystemLog[];
    },
    enabled: hasLogAccess,
  });

  // Query permissions (only for owner)
  const { data: permissions = [] } = useQuery({
    queryKey: ['log-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_access_permissions')
        .select(`
          id,
          user_id,
          granted_by,
          created_at
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch profiles for each permission
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      
      return data.map(p => ({
        ...p,
        profile: profiles?.find(pr => pr.user_id === p.user_id),
      })) as LogPermission[];
    },
    enabled: isLogOwner,
  });

  // Add permission mutation
  const addPermission = useMutation({
    mutationFn: async (email: string) => {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        throw new Error('Usuário não encontrado');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('log_access_permissions')
        .insert({
          user_id: profile.user_id,
          granted_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este usuário já tem permissão');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-permissions'] });
      setPermissionEmail("");
      setPermissionDialogOpen(false);
      toast({ title: "Permissão concedida com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Remove permission mutation
  const removePermission = useMutation({
    mutationFn: async (permissionId: string) => {
      const { error } = await supabase
        .from('log_access_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['log-permissions'] });
      toast({ title: "Permissão removida" });
    },
    onError: () => {
      toast({ title: "Erro ao remover permissão", variant: "destructive" });
    },
  });

  // Filter logs by search term
  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.description.toLowerCase().includes(search) ||
      log.performed_by_name?.toLowerCase().includes(search) ||
      log.action_type.toLowerCase().includes(search)
    );
  });

  if (authLoading || accessLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!hasLogAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScrollText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Logs do Sistema</h1>
              <p className="text-muted-foreground">Histórico de atividades</p>
            </div>
          </div>

          {isLogOwner && (
            <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Gerenciar Permissões
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Permissões de Acesso aos Logs</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Email do usuário"
                      value={permissionEmail}
                      onChange={(e) => setPermissionEmail(e.target.value)}
                    />
                    <Button
                      onClick={() => addPermission.mutate(permissionEmail)}
                      disabled={!permissionEmail || addPermission.isPending}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Desde</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permissions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              Nenhuma permissão concedida
                            </TableCell>
                          </TableRow>
                        ) : (
                          permissions.map((perm) => (
                            <TableRow key={perm.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{perm.profile?.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{perm.profile?.email}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                {format(new Date(perm.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removePermission.mutate(perm.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar nos logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterActionType} onValueChange={setFilterActionType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  {Object.entries(actionTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tipo de entidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as entidades</SelectItem>
                  {Object.entries(entityTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum log encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {actionTypeLabels[log.action_type] || log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entityTypeLabels[log.entity_type] || log.entity_type}
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {log.description}
                      </TableCell>
                      <TableCell>
                        {log.performed_by_name || 'Sistema'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Logs;
