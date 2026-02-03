import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSystemLog } from '@/hooks/useSystemLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Minus, Package, Search, Upload, FileText, Tag, ChevronsUpDown, Check, Truck } from 'lucide-react';
import { z } from 'zod';
import { brazilianStates, cn } from '@/lib/utils';
import { useCepLookup } from '@/hooks/useCepLookup';

// Shipping methods configuration
const SHIPPING_METHODS = [
  { value: 'correios_avulso', label: 'Correios Avulso', requiresAddress: true },
  { value: 'flex_avulso', label: 'Flex Avulso', requiresAddress: true },
  { value: 'mercadolivre_agencia', label: 'Mercado Livre Agência', requiresAddress: false },
  { value: 'mercadolivre_correios', label: 'Mercado Livre Correios', requiresAddress: false },
  { value: 'shopee_agencia', label: 'Shopee Agência', requiresAddress: false },
  { value: 'shopee_flex', label: 'Shopee Flex', requiresAddress: false },
  { value: 'other', label: 'Outras', requiresAddress: true },
] as const;

type ShippingMethod = typeof SHIPPING_METHODS[number]['value'];

// Dynamic schema based on shipping method
const createShipmentSchema = (requiresAddress: boolean) => {
  if (requiresAddress) {
    return z.object({
      recipient_name: z.string().min(2, 'Nome do destinatário é obrigatório').max(200),
      recipient_phone: z.string().max(20).optional(),
      recipient_email: z.string().email('Email inválido').optional().or(z.literal('')),
      recipient_address: z.string().min(5, 'Endereço é obrigatório').max(300),
      recipient_city: z.string().min(2, 'Cidade é obrigatória').max(100),
      recipient_state: z.string().length(2, 'Selecione o estado'),
      recipient_postal_code: z.string().min(8, 'CEP é obrigatório').max(10),
      notes: z.string().max(500).optional(),
    });
  }
  return z.object({
    recipient_name: z.string().max(200).optional(),
    recipient_phone: z.string().max(20).optional(),
    recipient_email: z.string().email('Email inválido').optional().or(z.literal('')),
    recipient_address: z.string().max(300).optional(),
    recipient_city: z.string().max(100).optional(),
    recipient_state: z.string().max(2).optional(),
    recipient_postal_code: z.string().max(10).optional(),
    notes: z.string().max(500).optional(),
  });
};

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

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
}

interface ProductItemRowProps {
  item: ProductItem;
  index: number;
  products: Product[];
  onUpdate: (index: number, field: 'product_id' | 'quantity', value: string | number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function ProductItemRow({ item, index, products, onUpdate, onRemove, canRemove }: ProductItemRowProps) {
  const [open, setOpen] = useState(false);
  const selectedProduct = products.find((p) => p.id === item.product_id);
  
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs">Produto</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between font-normal"
                >
                  {selectedProduct ? (
                    <div className="flex items-center gap-2 truncate">
                      <Package className="h-3 w-3 shrink-0" />
                      <span className="truncate">{selectedProduct.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        ({selectedProduct.quantity} disp.)
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Buscar produto...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome ou SKU..." />
                  <CommandList>
                    <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.name} ${product.sku}`}
                          onSelect={() => {
                            onUpdate(index, 'product_id', product.id);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              item.product_id === product.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <Package className="h-3 w-3" />
                              <span className="font-medium">{product.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Tag className="h-3 w-3" />
                              <span>SKU: {product.sku}</span>
                              <span>•</span>
                              <span>{product.quantity} disponíveis</span>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="w-24">
            <Label className="text-xs">Qtd</Label>
            <Input
              type="number"
              min="1"
              max={selectedProduct?.quantity || 999}
              value={item.quantity}
              onChange={(e) => onUpdate(index, 'quantity', parseInt(e.target.value) || 1)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            disabled={!canRemove}
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShipmentForm({ onSuccess, onCancel }: ShipmentFormProps) {
  const { user, isAdmin, clientId } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const { lookupCep, isLoading: isCepLoading } = useCepLookup();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(clientId || '');
  const [items, setItems] = useState<ProductItem[]>([{ product_id: '', quantity: 1 }]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [handlingFee, setHandlingFee] = useState<number>(4.50);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('other');

  // Check if current shipping method requires address
  const currentMethodConfig = SHIPPING_METHODS.find(m => m.value === shippingMethod);
  const requiresAddress = currentMethodConfig?.requiresAddress ?? true;

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
        .select('id, company_name, handling_fee_per_item')
        .order('company_name')
        .then(({ data }) => setClients(data || []));
    } else if (clientId) {
      // Fetch handling fee for current client
      supabase
        .from('clients')
        .select('handling_fee_per_item')
        .eq('id', clientId)
        .single()
        .then(({ data }) => {
          if (data?.handling_fee_per_item) {
            setHandlingFee(Number(data.handling_fee_per_item));
          }
        });
    }
  }, [isAdmin, clientId]);

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

  // Update handling fee when admin selects a client
  useEffect(() => {
    if (isAdmin && selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      if (client?.handling_fee_per_item) {
        setHandlingFee(Number(client.handling_fee_per_item));
      }
    }
  }, [isAdmin, selectedClientId, clients]);

  // Calculate total items and handling
  const totalItems = items.reduce((sum, item) => sum + (item.product_id ? item.quantity : 0), 0);
  const totalHandling = totalItems * handlingFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form based on shipping method
    const shipmentSchema = createShipmentSchema(requiresAddress);
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
      // Upload files if provided
      let invoiceUrl: string | null = null;
      let labelUrl: string | null = null;

      if (invoiceFile) {
        const fileExt = invoiceFile.name.split('.').pop();
        const filePath = `${clientToUse}/${Date.now()}-invoice.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('shipment-attachments')
          .upload(filePath, invoiceFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('shipment-attachments')
          .getPublicUrl(filePath);
        invoiceUrl = urlData.publicUrl;
      }

      if (labelFile) {
        const fileExt = labelFile.name.split('.').pop();
        const filePath = `${clientToUse}/${Date.now()}-label.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('shipment-attachments')
          .upload(filePath, labelFile);
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage
          .from('shipment-attachments')
          .getPublicUrl(filePath);
        labelUrl = urlData.publicUrl;
      }

      // Create shipment request with handling total and shipping method
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipment_requests')
        .insert({
          client_id: clientToUse,
          recipient_name: formData.recipient_name || '',
          recipient_phone: formData.recipient_phone || null,
          recipient_email: formData.recipient_email || null,
          recipient_address: formData.recipient_address || '-',
          recipient_city: formData.recipient_city || '-',
          recipient_state: formData.recipient_state || 'SP',
          recipient_postal_code: formData.recipient_postal_code || '00000-000',
          notes: formData.notes || null,
          created_by: user?.id,
          status: 'pending',
          invoice_url: invoiceUrl,
          shipping_label_url: labelUrl,
          handling_total: totalHandling,
          shipping_method: shippingMethod,
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

      // Deduct from stock and create stock movements
      for (const item of validItems) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const newQuantity = product.quantity - item.quantity;

          // Update product quantity
          await supabase
            .from('products')
            .update({ quantity: Math.max(0, newQuantity) })
            .eq('id', item.product_id);

          // Create stock movement (exit)
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            movement_type: 'exit',
            quantity: item.quantity,
            previous_quantity: product.quantity,
            new_quantity: Math.max(0, newQuantity),
            notes: `Saída para envio #${shipmentData.id.slice(0, 8)}`,
            created_by: user?.id,
          });
        }
      }

      await logAction({
        action_type: 'shipment_created',
        entity_type: 'shipment',
        entity_id: shipmentData.id,
        description: `Pedido criado via ${currentMethodConfig?.label} para ${formData.recipient_name || 'marketplace'} com ${totalItems} itens`,
        details: { 
          recipient: formData.recipient_name || currentMethodConfig?.label,
          city: formData.recipient_city || '-',
          state: formData.recipient_state || '-',
          items_count: totalItems,
          handling_total: totalHandling,
          shipping_method: shippingMethod,
        },
        client_id: clientToUse,
      });

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

      {/* Shipping Method Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Truck className="h-4 w-4" />
          Modelo de Envio *
        </Label>
        <Select value={shippingMethod} onValueChange={(v) => setShippingMethod(v as ShippingMethod)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o modelo de envio" />
          </SelectTrigger>
          <SelectContent>
            {SHIPPING_METHODS.map((method) => (
              <SelectItem key={method.value} value={method.value}>
                {method.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!requiresAddress && (
          <p className="text-xs text-muted-foreground">
            Para envios via marketplace, apenas a NF e Etiqueta são necessários.
          </p>
        )}
      </div>

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
            <ProductItemRow
              key={index}
              item={item}
              index={index}
              products={products}
              onUpdate={updateItem}
              onRemove={removeItem}
              canRemove={items.length > 1}
            />
          ))}
        </div>

        {/* Handling fee summary */}
        {totalItems > 0 && (
          <Card className="mt-4 bg-muted/50">
            <CardContent className="p-3">
              <div className="flex justify-between items-center text-sm">
                <span>Total de itens: <strong>{totalItems}</strong></span>
                <span>Manuseio: <strong>R$ {totalHandling.toFixed(2)}</strong> ({totalItems} x R$ {handlingFee.toFixed(2)})</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* Recipient Data - Only show if shipping method requires address */}
      {requiresAddress && (
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
      )}

      {/* Notes for marketplace shipments */}
      {!requiresAddress && (
        <div className="space-y-2">
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
      )}

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