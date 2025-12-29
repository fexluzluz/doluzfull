import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { translateShipmentStatus } from '@/lib/utils';

interface ShipmentStatusDialogProps {
  shipment: any;
  onClose: () => void;
  onSuccess: () => void;
}

const statusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'processing', label: 'Em Separação' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelado' },
];

export default function ShipmentStatusDialog({ shipment, onClose, onSuccess }: ShipmentStatusDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(shipment?.status || 'pending');
  const [trackingCode, setTrackingCode] = useState(shipment?.tracking_code || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shipment) return;

    // Validate tracking code for shipped status
    if (status === 'shipped' && !trackingCode.trim()) {
      toast({
        variant: 'destructive',
        title: 'Código de rastreio obrigatório',
        description: 'Informe o código de rastreio para marcar como enviado.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updateData: any = {
        status,
        processed_by: user?.id,
      };

      if (trackingCode.trim()) {
        updateData.tracking_code = trackingCode.trim();
      }

      // If status is shipped or delivered and has items, update product quantities
      if ((status === 'shipped' || status === 'processing') && shipment.status === 'pending') {
        // Fetch items
        const { data: items } = await supabase
          .from('shipment_items')
          .select('product_id, quantity')
          .eq('shipment_id', shipment.id);

        if (items && items.length > 0) {
          for (const item of items) {
            // Get current quantity
            const { data: product } = await supabase
              .from('products')
              .select('quantity')
              .eq('id', item.product_id)
              .single();

            if (product) {
              const newQuantity = product.quantity - item.quantity;

              // Update product quantity
              await supabase
                .from('products')
                .update({ quantity: Math.max(0, newQuantity) })
                .eq('id', item.product_id);

              // Create stock movement
              await supabase.from('stock_movements').insert({
                product_id: item.product_id,
                movement_type: 'exit',
                quantity: item.quantity,
                previous_quantity: product.quantity,
                new_quantity: Math.max(0, newQuantity),
                notes: `Saída para envio #${shipment.id.slice(0, 8)}`,
                created_by: user?.id,
              });
            }
          }
        }
      }

      const { error } = await supabase
        .from('shipment_requests')
        .update(updateData)
        .eq('id', shipment.id);

      if (error) throw error;

      toast({ title: 'Status atualizado com sucesso!' });
      onSuccess();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={!!shipment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Status do Envio</DialogTitle>
        </DialogHeader>

        {shipment && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Destinatário: <span className="font-semibold">{shipment.recipient_name}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Status atual: {translateShipmentStatus(shipment.status)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Novo Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(status === 'shipped' || status === 'delivered') && (
              <div className="space-y-2">
                <Label htmlFor="tracking_code">
                  Código de Rastreio {status === 'shipped' && '*'}
                </Label>
                <Input
                  id="tracking_code"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="Ex: BR123456789BR"
                  maxLength={50}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Atualizar Status'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}