import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useCepLookup } from '@/hooks/useCepLookup';
import { useCnpjLookup } from '@/hooks/useCnpjLookup';
import { Loader2, Search } from 'lucide-react';
import { z } from 'zod';
import { brazilianStates } from '@/lib/utils';

const clientSchema = z.object({
  company_name: z.string().min(2, 'Nome da empresa é obrigatório').max(200),
  cnpj: z.string().max(18).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  postal_code: z.string().max(10).optional(),
});

const userSchema = z.object({
  full_name: z.string().min(2, 'Nome é obrigatório').max(200),
  email: z.string().email('Email inválido'),
  phone: z.string().max(20).optional(),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

interface ClientFormProps {
  client?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { lookupCep, isLoading: isLoadingCep } = useCepLookup();
  const { lookupCnpj, isLoading: isLoadingCnpj } = useCnpjLookup();

  const [formData, setFormData] = useState({
    company_name: client?.company_name || '',
    cnpj: client?.cnpj || '',
    address: client?.address || '',
    city: client?.city || '',
    state: client?.state || '',
    postal_code: client?.postal_code || '',
    // User data (only for new clients)
    full_name: '',
    email: '',
    phone: '',
    password: '',
  });

  useEffect(() => {
    if (client) {
      // Fetch full client data
      const fetchClientDetails = async () => {
        const { data } = await supabase
          .from('clients')
          .select('*, profile:profiles!clients_profile_id_fkey(*)')
          .eq('id', client.id)
          .single();

        if (data) {
          const profile = Array.isArray(data.profile) ? data.profile[0] : data.profile;
          setFormData({
            company_name: data.company_name || '',
            cnpj: data.cnpj || '',
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            postal_code: data.postal_code || '',
            full_name: profile?.full_name || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
            password: '',
          });
        }
      };
      fetchClientDetails();
    }
  }, [client]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleCepChange = async (value: string) => {
    // Format CEP as user types
    const cleanValue = value.replace(/\D/g, '');
    let formattedValue = cleanValue;
    if (cleanValue.length > 5) {
      formattedValue = `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`;
    }
    
    handleChange('postal_code', formattedValue);

    // Auto-lookup when CEP is complete
    if (cleanValue.length === 8) {
      const result = await lookupCep(cleanValue);
      if (result) {
        setFormData((prev) => ({
          ...prev,
          address: result.address || prev.address,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
        toast({
          title: 'Endereço encontrado!',
          description: 'Os dados foram preenchidos automaticamente.',
        });
      }
    }
  };

  const handleCnpjChange = (value: string) => {
    // Format CNPJ as user types
    const cleanValue = value.replace(/\D/g, '');
    let formattedValue = cleanValue;
    
    if (cleanValue.length > 2) {
      formattedValue = `${cleanValue.slice(0, 2)}.${cleanValue.slice(2)}`;
    }
    if (cleanValue.length > 5) {
      formattedValue = `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5)}`;
    }
    if (cleanValue.length > 8) {
      formattedValue = `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5, 8)}/${cleanValue.slice(8)}`;
    }
    if (cleanValue.length > 12) {
      formattedValue = `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5, 8)}/${cleanValue.slice(8, 12)}-${cleanValue.slice(12, 14)}`;
    }
    
    handleChange('cnpj', formattedValue);
  };

  const handleCnpjLookup = async () => {
    const result = await lookupCnpj(formData.cnpj);
    if (result) {
      setFormData((prev) => ({
        ...prev,
        company_name: result.company_name || prev.company_name,
        address: result.address || prev.address,
        city: result.city || prev.city,
        state: result.state || prev.state,
        postal_code: result.postal_code || prev.postal_code,
        phone: result.phone || prev.phone,
      }));
      toast({
        title: 'Dados importados!',
        description: 'Os dados da empresa foram preenchidos automaticamente.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate client data
    const clientResult = clientSchema.safeParse({
      company_name: formData.company_name,
      cnpj: formData.cnpj || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      postal_code: formData.postal_code || undefined,
    });

    if (!clientResult.success) {
      const fieldErrors: Record<string, string> = {};
      clientResult.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // For new clients, validate user data
    if (!client) {
      const userResult = userSchema.safeParse({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || undefined,
        password: formData.password,
      });

      if (!userResult.success) {
        const fieldErrors: Record<string, string> = {};
        userResult.error.errors.forEach((err) => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setIsLoading(true);

    try {
      if (client) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update({
            company_name: formData.company_name,
            cnpj: formData.cnpj || null,
            address: formData.address || null,
            city: formData.city || null,
            state: formData.state || null,
            postal_code: formData.postal_code || null,
          })
          .eq('id', client.id);

        if (error) throw error;

        // Update profile if name or phone changed
        if (client.profile?.id) {
          await supabase
            .from('profiles')
            .update({
              full_name: formData.full_name,
              phone: formData.phone || null,
            })
            .eq('id', client.profile.id);
        }

        toast({ title: 'Cliente atualizado com sucesso!' });
      } else {
        // Create new user via auth
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

        // Create the client
        const { error: clientError } = await supabase.from('clients').insert({
          profile_id: profileData.id,
          company_name: formData.company_name,
          cnpj: formData.cnpj || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          postal_code: formData.postal_code || null,
        });

        if (clientError) throw clientError;

        // Add client role
        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: authData.user.id,
          role: 'client',
        });

        if (roleError) throw roleError;

        toast({ title: 'Cliente criado com sucesso!' });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving client:', error);
      let message = error.message;
      if (message.includes('already registered')) {
        message = 'Este email já está cadastrado.';
      }
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar cliente',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Data */}
      <div>
        <h3 className="text-sm font-medium mb-3">Dados da Empresa</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="cnpj">CNPJ</Label>
            <div className="flex gap-2">
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCnpjLookup}
                disabled={isLoadingCnpj || formData.cnpj.replace(/\D/g, '').length !== 14}
                title="Buscar dados do CNPJ"
              >
                {isLoadingCnpj ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o CNPJ e clique na lupa para importar os dados da empresa
            </p>
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="company_name">Nome da Empresa *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="Nome da empresa"
              maxLength={200}
            />
            {errors.company_name && <p className="text-sm text-destructive">{errors.company_name}</p>}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="postal_code">CEP</Label>
            <div className="flex gap-2">
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
                className="w-40"
              />
              {isLoadingCep && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o CEP para preencher o endereço automaticamente
            </p>
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Rua, número, complemento"
              maxLength={300}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="Cidade"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {brazilianStates.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* User Data */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          {client ? 'Dados do Responsável' : 'Dados do Usuário Responsável'}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Nome do responsável"
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
              disabled={!!client}
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

          {!client && (
            <div className="col-span-2 space-y-2">
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
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : client ? (
            'Atualizar'
          ) : (
            'Criar Cliente'
          )}
        </Button>
      </div>
    </form>
  );
}
