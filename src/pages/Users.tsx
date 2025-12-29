import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Search, Users as UsersIcon, Shield, Building2, UserCog, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import { AppRole } from '@/types/database';

interface UserData {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  role: AppRole | null;
  client_name: string | null;
  is_employee: boolean;
}

export default function Users() {
  const { isAdmin, isLoading: authLoading, user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, created_at')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch all clients with their profile_id
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('profile_id, company_name');

      if (clientsError) throw clientsError;

      // Fetch all client_employees
      const { data: employees, error: employeesError } = await supabase
        .from('client_employees')
        .select('profile_id, client_id, clients(company_name)');

      if (employeesError) throw employeesError;

      // Map roles by user_id
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role as AppRole]));

      // Map clients by profile_id
      const clientsMap = new Map(clients?.map(c => [c.profile_id, c.company_name]));

      // Map employees by profile_id
      const employeesMap = new Map(
        employees?.map(e => [
          e.profile_id, 
          Array.isArray(e.clients) ? e.clients[0]?.company_name : (e.clients as any)?.company_name
        ])
      );

      const usersData: UserData[] = (profiles || []).map(profile => {
        const isEmployee = employeesMap.has(profile.id);
        const clientName = clientsMap.get(profile.id) || employeesMap.get(profile.id) || null;

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          created_at: profile.created_at,
          role: rolesMap.get(profile.user_id) || null,
          client_name: clientName,
          is_employee: isEmployee,
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
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

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingRole(userId);
    try {
      // Check if user already has a role
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, role: newRole } : u
      ));

      toast({ title: 'Role atualizado com sucesso!' });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar role',
        description: error.message,
      });
    } finally {
      setUpdatingRole(null);
    }
  };

  const getRoleBadge = (role: AppRole | null, isEmployee: boolean) => {
    if (role === 'admin') {
      return <Badge variant="default" className="bg-primary"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>;
    }
    if (isEmployee) {
      return <Badge variant="secondary"><UserCog className="h-3 w-3 mr-1" /> Colaborador</Badge>;
    }
    if (role === 'client') {
      return <Badge variant="outline"><Building2 className="h-3 w-3 mr-1" /> Cliente</Badge>;
    }
    return <Badge variant="outline">Sem role</Badge>;
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Usuários</h1>
            <p className="page-description">Visualize todos os usuários do sistema</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Lista de Usuários ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando usuários...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tipo Atual</TableHead>
                    <TableHead>Alterar Role</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Cadastro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                    const isCurrentUser = user.user_id === currentUser?.id;
                    const isUpdating = updatingRole === user.user_id;
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{getRoleBadge(user.role, user.is_employee)}</TableCell>
                        <TableCell>
                          {isCurrentUser ? (
                            <span className="text-xs text-muted-foreground">Você</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Select
                                value={user.role || 'client'}
                                onValueChange={(value) => handleRoleChange(user.user_id, value as AppRole)}
                                disabled={isUpdating}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="client">Cliente</SelectItem>
                                  <SelectItem value="employee">Colaborador</SelectItem>
                                </SelectContent>
                              </Select>
                              {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.client_name || '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
