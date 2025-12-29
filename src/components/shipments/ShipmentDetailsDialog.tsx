import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Package, MapPin, User, FileText, ExternalLink } from 'lucide-react';
import { formatDateTime, translateShipmentStatus } from '@/lib/utils';

interface ShipmentDetailsDialogProps {
  shipment: any;
  onClose: () => void;
}

export default function ShipmentDetailsDialog({ shipment, onClose }: ShipmentDetailsDialogProps) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (shipment) {
      fetchItems();
    }
  }, [shipment]);

  const fetchItems = async () => {
    if (!shipment) return;

    try {
      const { data } = await supabase
        .from('shipment_items')
        .select('*, products(name, sku)')
        .eq('shipment_id', shipment.id);

      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/20 text-warning border-warning/30';
      case 'processing': return 'bg-info/20 text-info border-info/30';
      case 'shipped': return 'bg-primary/20 text-primary border-primary/30';
      case 'delivered': return 'bg-success/20 text-success border-success/30';
      case 'cancelled': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return '';
    }
  };

  return (
    <Dialog open={!!shipment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Detalhes do Envio
          </DialogTitle>
        </DialogHeader>

        {shipment && (
          <div className="space-y-6">
            {/* Status & Date */}
            <div className="flex items-center justify-between">
              <Badge className={getStatusBadgeClass(shipment.status)}>
                {translateShipmentStatus(shipment.status)}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Criado em {formatDateTime(shipment.created_at)}
              </p>
            </div>

            {/* Tracking */}
            {shipment.tracking_code && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Código de Rastreio</p>
                      <p className="font-mono text-lg font-semibold">{shipment.tracking_code}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Recipient Info */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Destinatário
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{shipment.recipient_name}</p>
                </div>
                {shipment.recipient_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{shipment.recipient_phone}</p>
                  </div>
                )}
                {shipment.recipient_email && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{shipment.recipient_email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço de Entrega
              </h3>
              <Card>
                <CardContent className="p-4">
                  <p>{shipment.recipient_address}</p>
                  <p>
                    {shipment.recipient_city}/{shipment.recipient_state} - CEP: {shipment.recipient_postal_code}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Products */}
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produtos ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.products?.name}</p>
                        <p className="text-xs text-muted-foreground">SKU: {item.products?.sku}</p>
                      </div>
                      <Badge variant="secondary">{item.quantity} un.</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Files */}
            {(shipment.shipping_label_url || shipment.invoice_url) && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Arquivos
                  </h3>
                  <div className="flex gap-3">
                    {shipment.shipping_label_url && (
                      <a
                        href={shipment.shipping_label_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Etiqueta</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {shipment.invoice_url && (
                      <a
                        href={shipment.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Nota Fiscal</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {shipment.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-medium mb-2">Observações</h3>
                  <p className="text-muted-foreground">{shipment.notes}</p>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}