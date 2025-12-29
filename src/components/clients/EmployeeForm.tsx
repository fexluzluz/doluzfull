import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCheck, UserPlus } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

const newUserSchema = z.object({
  full_name: z.string().min(2, 'Nome é obrigatório').max(200),
  email: z.string().email('Email inválido'),
  phone: z.string().max(20).optional(),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

interface EmployeeFormProps {
  client: { id: string; company_name: string };
  onSuccess: () => void;
  onCancel: () => void;
}

type FormMode = 'check' | 'new' | 'existing';

interface ExistingUser {
  profile_id: string;
  full_name: string;
  email: string;
}

export default function EmployeeForm({ client, onSuccess, onCancel }: EmployeeFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<FormMode>('check');
  const [existingUser, setExistingUser] = useState<ExistingUser | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const checkEmail = async () => {
    setErrors({});
    const result = emailSchema.safeParse({ email: formData.email });

    if (!result.success) {
      setErrors({ email: result.error.errors[0].message });
      return;
    }

    setIsLoading(true);

    try {
      // Check if user already exists in profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', formData.email.toLowerCase())
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData) {
        // Check if already a collaborator for this client
        const { data: existingEmployee } = await supabase
          .from('client_employees')
          .select('id')
          .eq('client_id', client.id)
          .eq('profile_id', profileData.id)
          .maybeSingle();

        if (existingEmployee) {
          toast({
            variant: 'destructive',
            title: 'Usuário já é colaborador',
            description: 'Este usuário já está vinculado a esta empresa.',
          });
          return;
        }

        setExistingUser({
          profile_id: profileData.id,
          full_name: profileData.full_name,
          email: profileData.email,
        });
        setMode('existing');
      } else {
        setMode('new');
      }
    } catch (error: any) {
      console.error('Error checking email:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao verificar email',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const linkExistingUser = async () => {
    if (!existingUser) return;

    setIsLoading(true);

    try {
      // Create the employee link
      const { error: employeeError } = await supabase.from('client_employees').insert({
        client_id: client.id,
        profile_id: existingUser.profile_id,
        is_active: true,
      });

      if (employeeError) throw employeeError;

      // Send notification email (without password since user already exists)
      try {
        const loginUrl = `${window.location.origin}/auth`;
        await supabase.functions.invoke('send-invite-email', {
          body: {
            email: existingUser.email,
            full_name: existingUser.full_name,
            company_name: client.company_name,
            temp_password: null, // No password for existing users
            login_url: loginUrl,
          },
        });

        toast({
          title: 'Colaborador vinculado',
          description: 'O usuário foi vinculado e notificado por email.',
        });
      } catch (emailErr) {
        console.error('Error sending email:', emailErr);
        toast({
          title: 'Colaborador vinculado',
          description: 'Usuário vinculado, mas houve erro ao enviar email de notificação.',
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error linking user:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao vincular colaborador',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = newUserSchema.safeParse({
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone || undefined,
      password: formData.password,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // Create user via auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Erro ao criar usuário');

      // Wait for profile to be created by trigger
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get the profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authData.user.id)
        .single();

      if (profileError || !profileData) throw new Error('Erro ao obter perfil do usuário');

      // Update profile with phone and set must_change_password flag
      const profileUpdate: Record<string, any> = { must_change_password: true };
      if (formData.phone) {
        profileUpdate.phone = formData.phone;
      }
      
      await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', profileData.id);

      // Create the employee link
      const { error: employeeError } = await supabase.from('client_employees').insert({
        client_id: client.id,
        profile_id: profileData.id,
        is_active: true,
      });

      if (employeeError) throw employeeError;

      // Add employee role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        role: 'employee',
      });

      if (roleError) throw roleError;

      // Send invite email
      try {
        const loginUrl = `${window.location.origin}/auth`;
        const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
          body: {
            email: formData.email,
            full_name: formData.full_name,
            company_name: client.company_name,
            temp_password: formData.password,
            login_url: loginUrl,
          },
        });

        if (emailError) {
          console.error('Error sending invite email:', emailError);
          toast({
            variant: 'default',
            title: 'Funcionário criado',
            description: 'Funcionário criado com sucesso, mas houve um erro ao enviar o email de convite.',
          });
        } else {
          toast({
            title: 'Funcionário criado',
            description: 'Email de convite enviado com sucesso!',
          });
        }
      } catch (emailErr) {
        console.error('Error invoking email function:', emailErr);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      let message = error.message;
      if (message.includes('already registered')) {
        message = 'Este email já está cadastrado.';
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao criar funcionário',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setMode('check');
    setExistingUser(null);
    setFormData({ full_name: '', email: '', phone: '', password: '' });
    setErrors({});
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-muted rounded-lg mb-4">
        <p className="text-sm">
          Adicionando colaborador para: <span className="font-semibold">{client.company_name}</span>
        </p>
      </div>

      {mode === 'check' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do colaborador *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@empresa.com"
              onKeyDown={(e) => e.key === 'Enter' && checkEmail()}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={checkEmail} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar Email'
              )}
            </Button>
          </div>
        </div>
      )}

      {mode === 'existing' && existingUser && (
        <div className="space-y-4">
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <UserCheck className="h-5 w-5 text-primary" />
              <span className="font-medium">Usuário encontrado!</span>
            </div>
            <div className="space-y-1 text-sm">
              <p><strong>Nome:</strong> {existingUser.full_name}</p>
              <p><strong>Email:</strong> {existingUser.email}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Este usuário já possui conta no sistema. Deseja vinculá-lo como colaborador desta empresa?
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
              Voltar
            </Button>
            <Button onClick={linkExistingUser} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Vinculando...
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Vincular Colaborador
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {mode === 'new' && (
        <form onSubmit={createNewUser} className="space-y-4">
          <div className="p-4 bg-muted/50 border rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <UserPlus className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Novo usuário</span>
            </div>
            <p className="text-sm text-muted-foreground">
              O email <strong>{formData.email}</strong> não está cadastrado. Preencha os dados para criar uma nova conta.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Nome do funcionário"
              maxLength={200}
            />
            {errors.full_name && <p className="text-sm text-destructive">{errors.full_name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="(00) 00000-0000"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={resetForm} disabled={isLoading}>
              Voltar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar Colaborador
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
