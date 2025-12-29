import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Minus, Package, Search, Upload, FileText, Tag } from 'lucide-react';
import { z } from 'zod';
import { brazilianStates } from '@/lib/utils';
import { useCepLookup } from '@/hooks/useCepLookup';

const shipmentSchema = z.object({
  recipient_name: z.string().min(2, 'Nome do destinatário é obrigatório').max(200),
  recipient_phone: z.string().max(20).optional(),
  recipient_email: z.string().email('Email inválido').optional().or(z.literal('')),
  recipient_address: z.string().min(5, 'Endereço é obrigatório').max(300),
  recipient_city: z.string().min(2, 'Cidade é obrigatória').max(100),
  recipient_state: z.string().length(2, 'Selecione o estado'),
  recipient_postal_code: z.string().min(8, 'CEP é obrigatório').max(10),
  notes: z.string().max(500).optional(),
});

interface ShipmentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ProductItem {
  product_id: string;
  quantity: number;
  product?: {
    name: string;
    sku: string;
    quantity: number;
  };
}

export default function ShipmentForm({ onSuccess, onCancel }: ShipmentFormProps) {
  const { user, isAdmin, clientId } = useAuth();
  const { toast } = useToast();
  const { lookupCep, isLoading: isCepLoading } = useCepLookup();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || '');
  const [items, setItems] = useState<ProductItem[]>([{ product_id: '', quantity: 1 }]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    recipient_address: '',
    recipient_city: '',
    recipient_state: '',
    recipient_postal_code: '',
    notes: '',
  });

  useEffect(() => {
    if (isAdmin) {
      // Fetch all clients for admin
      supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name')
        .then(({ data }) => setClients(data || []));
    }
  }, [isAdmin]);

  useEffect(() => {
    // Fetch products based on selected client
    const fetchProducts = async () => {
      const clientToUse = isAdmin ? selectedClientId : clientId;
      if (!clientToUse) {
        setProducts([]);
        return;
      }

      const { data } = await supabase
        .from('products')
        .select('id, name, sku, quantity')
        .eq('client_id', clientToUse)
        .gt('quantity', 0)
        .order('name');

      setProducts(data || []);
    };

    fetchProducts();
  }, [selectedClientId, clientId, isAdmin]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleCepChange = async (cep: string) => {
    handleChange('recipient_postal_code', cep);
    
    // Auto-lookup when CEP has 8 digits
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      const result = await lookupCep(cep);
      if (result) {
        setFormData((prev) => ({
          ...prev,
          recipient_postal_code: cep,
          recipient_address: result.address,
          recipient_city: result.city,
          recipient_state: result.state,
        }));
      }
    }
  };

  const handleFileChange = (type: 'invoice' | 'label', file: File | null) => {
    if (type === 'invoice') {
      setInvoiceFile(file);
    } else {
      setLabelFile(file);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, { product_id: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'product_id') {
          const product = products.find((p) => p.id === value);
          return { ...item, product_id: value as string, product };
        }
        return { ...item, quantity: value as number };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const result = shipmentSchema.safeParse({
      ...formData,
      recipient_email: formData.recipient_email || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Validate items
    const validItems = items.filter((item) => item.product_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Adicione pelo menos um produto ao envio.',
      });
      return;
    }

    // Check stock
    for (const item of validItems) {
      const product = products.find((p) => p.id === item.product_id);
      if (product && item.quantity > product.quantity) {
        toast({
          variant: 'destructive',
          title: 'Estoque insuficiente',
          description: `O produto "${product.name}" tem apenas ${product.quantity} unidades em estoque.`,
        });
        return;
      }
    }

    const clientToUse = isAdmin ? selectedClientId : clientId;
    if (!clientToUse) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione um cliente.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Create shipment request
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipment_requests')
        .insert({
          client_id: clientToUse,
          recipient_name: formData.recipient_name,
          recipient_phone: formData.recipient_phone || null,
          recipient_email: formData.recipient_email || null,
          recipient_address: formData.recipient_address,
          recipient_city: formData.recipient_city,
          recipient_state: formData.recipient_state,
          recipient_postal_code: formData.recipient_postal_code,
          notes: formData.notes || null,
          created_by: user?.id,
          status: 'pending',
        })
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      // Create shipment items
      const itemsToInsert = validItems.map((item) => ({
        shipment_id: shipmentData.id,
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('shipment_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({ title: 'Requisição de envio criada com sucesso!' });
      onSuccess();
    } catch (error: any) {
      console.error('Error creating shipment:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar requisição',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Selection (Admin only) */}
      {isAdmin && (
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Products Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label>Produtos *</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Label className="text-xs">Produto</Label>
                    <Select
                      value={item.product_id}
                      onValueChange={(v) => updateItem(index, 'product_id', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3" />
                              <span>{product.name}</span>
                              <span className="text-muted-foreground text-xs">
                                ({product.quantity} disp.)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min="1"
                      max={item.product?.quantity || 999}
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Recipient Data */}
      <div>
        <h3 className="text-sm font-medium mb-3">Dados do Destinatário</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-2">
            <Label htmlFor="recipient_name">Nome *</Label>
            <Input
              id="recipient_name"
              value={formData.recipient_name}
              onChange={(e) => handleChange('recipient_name', e.target.value)}
              placeholder="Nome do destinatário"
              maxLength={200}
            />
            {errors.recipient_name && (
              <p className="text-sm text-destructive">{errors.recipient_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient_phone">Telefone</Label>
            <Input
              id="recipient_phone"
              value={formData.recipient_phone}
              onChange={(e) => handleChange('recipient_phone', e.target.value)}
              placeholder="(00) 00000-0000"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient_email">Email</Label>
            <Input
              id="recipient_email"
              type="email"
              value={formData.recipient_email}
              onChange={(e) => handleChange('recipient_email', e.target.value)}
              placeholder="email@exemplo.com"
            />
            {errors.recipient_email && (
              <p className="text-sm text-destructive">{errors.recipient_email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient_postal_code">CEP *</Label>
            <div className="relative">
              <Input
                id="recipient_postal_code"
                value={formData.recipient_postal_code}
                onChange={(e) => handleCepChange(e.target.value)}
                placeholder="00000-000"
                maxLength={10}
              />
              {isCepLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {errors.recipient_postal_code && (
              <p className="text-sm text-destructive">{errors.recipient_postal_code}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient_state">Estado *</Label>
            <Select
              value={formData.recipient_state}
              onValueChange={(v) => handleChange('recipient_state', v)}
            >
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
            {errors.recipient_state && (
              <p className="text-sm text-destructive">{errors.recipient_state}</p>
            )}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="recipient_address">Endereço *</Label>
            <Input
              id="recipient_address"
              value={formData.recipient_address}
              onChange={(e) => handleChange('recipient_address', e.target.value)}
              placeholder="Rua, número, complemento"
              maxLength={300}
            />
            {errors.recipient_address && (
              <p className="text-sm text-destructive">{errors.recipient_address}</p>
            )}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="recipient_city">Cidade *</Label>
            <Input
              id="recipient_city"
              value={formData.recipient_city}
              onChange={(e) => handleChange('recipient_city', e.target.value)}
              placeholder="Cidade"
              maxLength={100}
            />
            {errors.recipient_city && (
              <p className="text-sm text-destructive">{errors.recipient_city}</p>
            )}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Instruções especiais para o envio..."
              maxLength={500}
              rows={2}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Attachments */}
      <div>
        <h3 className="text-sm font-medium mb-3">Anexos</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invoice_file" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Declaração de Conteúdo / NF
            </Label>
            <div className="relative">
              <Input
                id="invoice_file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => handleFileChange('invoice', e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
            {invoiceFile && (
              <p className="text-xs text-muted-foreground truncate">
                {invoiceFile.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="label_file" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Etiqueta de Envio
            </Label>
            <div className="relative">
              <Input
                id="label_file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => handleFileChange('label', e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
            {labelFile && (
              <p className="text-xs text-muted-foreground truncate">
                {labelFile.name}
              </p>
            )}
          </div>
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
              Criando...
            </>
          ) : (
            'Criar Requisição'
          )}
        </Button>
      </div>
    </form>
  );
}