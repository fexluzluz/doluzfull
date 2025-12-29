import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useSystemLog } from '@/hooks/useSystemLog';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { z } from 'zod';
import { Product } from '@/types/database';
import { formatNumber, calculateVolumeM3 } from '@/lib/utils';

const productSchema = z.object({
  sku: z.string().min(1, 'SKU é obrigatório').max(50, 'SKU muito longo'),
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  height_cm: z.number().min(0, 'Altura inválida').max(10000, 'Altura muito grande'),
  width_cm: z.number().min(0, 'Largura inválida').max(10000, 'Largura muito grande'),
  depth_cm: z.number().min(0, 'Profundidade inválida').max(10000, 'Profundidade muito grande'),
  weight_kg: z.number().min(0, 'Peso inválido').max(10000, 'Peso muito grande').optional(),
  quantity: z.number().int().min(0, 'Quantidade inválida'),
  min_stock_alert: z.number().int().min(0, 'Alerta inválido').optional().nullable(),
  max_stock_alert: z.number().int().min(0, 'Alerta inválido').optional().nullable(),
  client_id: z.string().uuid('Selecione um cliente'),
}).refine((data) => {
  if (data.min_stock_alert != null && data.max_stock_alert != null) {
    return data.max_stock_alert >= data.min_stock_alert;
  }
  return true;
}, {
  message: 'Estoque máximo deve ser maior ou igual ao estoque mínimo',
  path: ['max_stock_alert'],
});

interface ProductFormProps {
  product?: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
  isAdmin?: boolean;
}

export default function ProductForm({ product, onSuccess, onCancel, isAdmin = false }: ProductFormProps) {
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    height_cm: product?.height_cm || 0,
    width_cm: product?.width_cm || 0,
    depth_cm: product?.depth_cm || 0,
    weight_kg: product?.weight_kg || 0,
    quantity: product?.quantity || 0,
    min_stock_alert: product?.min_stock_alert ?? '',
    max_stock_alert: (product as any)?.max_stock_alert ?? '',
    client_id: product?.client_id || '',
  });

  useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name');
      setClients(data || []);
    };
    fetchClients();
  }, []);

  const calculatedVolume = calculateVolumeM3(
    Number(formData.height_cm),
    Number(formData.width_cm),
    Number(formData.depth_cm)
  );

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'A imagem deve ter no máximo 5MB.',
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `products/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

      setImageUrl(publicUrl);
      toast({ title: 'Imagem enviada com sucesso!' });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar imagem',
        description: error.message,
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const dataToValidate = {
      ...formData,
      height_cm: Number(formData.height_cm),
      width_cm: Number(formData.width_cm),
      depth_cm: Number(formData.depth_cm),
      weight_kg: Number(formData.weight_kg) || 0,
      quantity: Number(formData.quantity),
      min_stock_alert: formData.min_stock_alert !== '' ? Number(formData.min_stock_alert) : null,
      max_stock_alert: formData.max_stock_alert !== '' ? Number(formData.max_stock_alert) : null,
    };

    const result = productSchema.safeParse(dataToValidate);
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
      if (product) {
        // Update
        const { error } = await supabase
          .from('products')
          .update({
            sku: dataToValidate.sku,
            name: dataToValidate.name,
            description: dataToValidate.description || null,
            height_cm: dataToValidate.height_cm,
            width_cm: dataToValidate.width_cm,
            depth_cm: dataToValidate.depth_cm,
            weight_kg: dataToValidate.weight_kg,
            quantity: dataToValidate.quantity,
            min_stock_alert: dataToValidate.min_stock_alert,
            max_stock_alert: dataToValidate.max_stock_alert,
            image_url: imageUrl,
          } as any)
          .eq('id', product.id);

        if (error) throw error;
        
        await logAction({
          action_type: 'product_updated',
          entity_type: 'product',
          entity_id: product.id,
          description: `Produto "${dataToValidate.name}" (SKU: ${dataToValidate.sku}) atualizado`,
          details: { sku: dataToValidate.sku, name: dataToValidate.name },
        });
        
        toast({ title: 'Produto atualizado com sucesso!' });
      } else {
        // Create
        const { data: newProduct, error } = await supabase.from('products').insert({
          sku: dataToValidate.sku,
          name: dataToValidate.name,
          description: dataToValidate.description || null,
          height_cm: dataToValidate.height_cm,
          width_cm: dataToValidate.width_cm,
          depth_cm: dataToValidate.depth_cm,
          weight_kg: dataToValidate.weight_kg,
          quantity: dataToValidate.quantity,
          min_stock_alert: dataToValidate.min_stock_alert,
          max_stock_alert: dataToValidate.max_stock_alert,
          client_id: dataToValidate.client_id,
          image_url: imageUrl,
        } as any).select().single();

        if (error) throw error;
        
        await logAction({
          action_type: 'product_created',
          entity_type: 'product',
          entity_id: newProduct?.id,
          description: `Produto "${dataToValidate.name}" (SKU: ${dataToValidate.sku}) criado com ${dataToValidate.quantity} unidades`,
          details: { sku: dataToValidate.sku, name: dataToValidate.name, quantity: dataToValidate.quantity },
          client_id: dataToValidate.client_id,
        });
        
        toast({ title: 'Produto criado com sucesso!' });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar produto',
        description: error.message.includes('duplicate')
          ? 'Já existe um produto com este SKU para este cliente.'
          : error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Image Upload */}
        <div className="col-span-2 space-y-2">
          <Label>Imagem do Produto (opcional)</Label>
          <div className="flex items-start gap-4">
            {imageUrl ? (
              <div className="relative">
                <img 
                  src={imageUrl} 
                  alt="Produto" 
                  className="h-24 w-24 object-cover rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={handleRemoveImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="h-24 w-24 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                className="hidden"
                id="product-image"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {imageUrl ? 'Trocar imagem' : 'Enviar imagem'}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Formatos aceitos: JPG, PNG, WEBP. Máx: 5MB
              </p>
            </div>
          </div>
        </div>

        {/* Cliente */}
        {!product && (
          <div className="col-span-2 space-y-2">
            <Label htmlFor="client_id">Cliente *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => handleChange('client_id', value)}
            >
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
            {errors.client_id && <p className="text-sm text-destructive">{errors.client_id}</p>}
          </div>
        )}

        {/* SKU */}
        <div className="space-y-2">
          <Label htmlFor="sku">SKU *</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => handleChange('sku', e.target.value)}
            placeholder="Ex: PROD-001"
            maxLength={50}
          />
          {errors.sku && <p className="text-sm text-destructive">{errors.sku}</p>}
        </div>

        {/* Nome */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Nome do produto"
            maxLength={200}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        </div>

        {/* Descrição */}
        <div className="col-span-2 space-y-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Descrição do produto"
            maxLength={1000}
            rows={2}
          />
        </div>

        {/* Dimensões */}
        <div className="space-y-2">
          <Label htmlFor="height_cm">Altura (cm) *</Label>
          <Input
            id="height_cm"
            type="number"
            step="0.01"
            min="0"
            value={formData.height_cm}
            onChange={(e) => handleChange('height_cm', e.target.value)}
            disabled={!!product && !isAdmin}
          />
          {errors.height_cm && <p className="text-sm text-destructive">{errors.height_cm}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="width_cm">Largura (cm) *</Label>
          <Input
            id="width_cm"
            type="number"
            step="0.01"
            min="0"
            value={formData.width_cm}
            onChange={(e) => handleChange('width_cm', e.target.value)}
            disabled={!!product && !isAdmin}
          />
          {errors.width_cm && <p className="text-sm text-destructive">{errors.width_cm}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="depth_cm">Profundidade (cm) *</Label>
          <Input
            id="depth_cm"
            type="number"
            step="0.01"
            min="0"
            value={formData.depth_cm}
            onChange={(e) => handleChange('depth_cm', e.target.value)}
            disabled={!!product && !isAdmin}
          />
          {errors.depth_cm && <p className="text-sm text-destructive">{errors.depth_cm}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight_kg">Peso (kg)</Label>
          <Input
            id="weight_kg"
            type="number"
            step="0.001"
            min="0"
            value={formData.weight_kg}
            onChange={(e) => handleChange('weight_kg', e.target.value)}
            disabled={!!product && !isAdmin}
          />
        </div>

        {/* Volume calculado */}
        <div className="col-span-2 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Volume calculado: <span className="font-semibold text-foreground">{formatNumber(calculatedVolume, 6)} m³</span>
          </p>
        </div>

        {/* Quantidade e alerta */}
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantidade inicial *</Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            value={formData.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
            disabled={!!product && !isAdmin}
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="min_stock_alert">Estoque mínimo</Label>
          <Input
            id="min_stock_alert"
            type="number"
            min="0"
            value={formData.min_stock_alert}
            onChange={(e) => handleChange('min_stock_alert', e.target.value)}
            placeholder="Opcional"
          />
          {errors.min_stock_alert && <p className="text-sm text-destructive">{errors.min_stock_alert}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_stock_alert">Estoque máximo</Label>
          <Input
            id="max_stock_alert"
            type="number"
            min="0"
            value={formData.max_stock_alert}
            onChange={(e) => handleChange('max_stock_alert', e.target.value)}
            placeholder="Opcional"
          />
          {errors.max_stock_alert && <p className="text-sm text-destructive">{errors.max_stock_alert}</p>}
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
          ) : product ? (
            'Atualizar'
          ) : (
            'Criar Produto'
          )}
        </Button>
      </div>
    </form>
  );
}