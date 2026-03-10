import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSystemLog } from '@/hooks/useSystemLog';
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
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('pending');
  const [trackingCode, setTrackingCode] = useState('');
  const [logisticsCost, setLogisticsCost] = useState<string>('');

  useEffect(() => {
    if (shipment) {
      setStatus(shipment.status || 'pending');
      setTrackingCode(shipment.tracking_code || '');
      setLogisticsCost(shipment.logistics_cost ? shipment.logistics_cost.toString() : '');
    } else {
      setStatus('pending');
      setTrackingCode('');
      setLogisticsCost('');
    }
  }, [shipment?.id]);

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

      // Only admin can update logistics cost
      if (isAdmin) {
        updateData.logistics_cost = parseFloat(logisticsCost) || 0;
      }

      if (trackingCode.trim()) {
        updateData.tracking_code = trackingCode.trim();
      }

      // If cancelling an order, reverse the stock
      if (status === 'cancelled' && shipment.status !== 'cancelled') {
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
              const newQuantity = product.quantity + item.quantity;

              // Update product quantity (return to stock)
              await supabase
                .from('products')
                .update({ quantity: newQuantity })
                .eq('id', item.product_id);

              // Create stock movement (entry - reversal)
              await supabase.from('stock_movements').insert({
                product_id: item.product_id,
                movement_type: 'entry',
                quantity: item.quantity,
                previous_quantity: product.quantity,
                new_quantity: newQuantity,
                notes: `Estorno - Cancelamento do envio #${shipment.id.slice(0, 8)}`,
                created_by: user?.id,
              });
            }
          }
        }

        // Reset handling total and logistics cost (estorno do manuseio)
        updateData.handling_total = 0;
        updateData.logistics_cost = 0;
      }

      const { error } = await supabase
        .from('shipment_requests')
        .update(updateData)
        .eq('id', shipment.id);

      if (error) throw error;

      await logAction({
        action_type: status === 'cancelled' ? 'shipment_cancelled' : 'shipment_status_changed',
        entity_type: 'shipment',
        entity_id: shipment.id,
        description: status === 'cancelled' 
          ? `Pedido de ${shipment.recipient_name} cancelado (estoque estornado)`
          : `Status do pedido de ${shipment.recipient_name} alterado: ${translateShipmentStatus(shipment.status)} → ${translateShipmentStatus(status)}`,
        details: { 
          recipient: shipment.recipient_name,
          old_status: shipment.status,
          new_status: status,
          tracking_code: trackingCode || null,
          logistics_cost: parseFloat(logisticsCost) || 0,
        },
        client_id: shipment.client_id,
      });

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

            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="logistics_cost">Valor da Logística (R$)</Label>
                <Input
                  id="logistics_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={logisticsCost}
                  onChange={(e) => setLogisticsCost(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Valor cobrado do cliente pelo frete/logística
                </p>
              </div>
            )}

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