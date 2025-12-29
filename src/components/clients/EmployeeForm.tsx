import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const employeeSchema = z.object({
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

export default function EmployeeForm({ client, onSuccess, onCancel }: EmployeeFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = employeeSchema.safeParse({
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

      // Update profile with phone
      if (formData.phone) {
        await supabase
          .from('profiles')
          .update({ phone: formData.phone })
          .eq('id', profileData.id);
      }

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-3 bg-muted rounded-lg mb-4">
        <p className="text-sm">
          Adicionando funcionário para: <span className="font-semibold">{client.company_name}</span>
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
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="email@empresa.com"
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando...
            </>
          ) : (
            'Adicionar Funcionário'
          )}
        </Button>
      </div>
    </form>
  );
}