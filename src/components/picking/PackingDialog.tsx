import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSystemLog } from "@/hooks/useSystemLog";
import { PickingOrder, PickingItem, Product } from "@/types/database";
import { Package, Check, Box } from "lucide-react";

interface PackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PickingOrder;
  onSuccess: () => void;
}

interface PackingItemWithDetails extends PickingItem {
  product?: Product;
  isPacked: boolean;
}

export function PackingDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: PackingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<PackingItemWithDetails[]>([]);
  const [packingNotes, setPackingNotes] = useState("");

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, order.id]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("picking_items")
      .select(`
        *,
        products (*)
      `)
      .eq("picking_order_id", order.id);

    if (!error && data) {
      setItems(
        data.map(item => ({
          ...item,
          product: item.products as Product,
          isPacked: false,
        }))
      );
    }
  };

  const toggleItemPacked = (itemId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, isPacked: !item.isPacked } : item
      )
    );
  };

  const handleStartPacking = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("picking_orders")
        .update({
          status: "packing",
          packer_id: user?.id,
          packing_started_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({ title: "Embalagem iniciada!" });
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao iniciar embalagem",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompletePacking = async () => {
    setIsLoading(true);
    try {
      // Update picking order
      const { error: pickingError } = await supabase
        .from("picking_orders")
        .update({
          status: "packed",
          packing_completed_at: new Date().toISOString(),
          notes: packingNotes || null,
        })
        .eq("id", order.id);

      if (pickingError) throw pickingError;

      // Update shipment status to processing
      const { error: shipmentError } = await supabase
        .from("shipment_requests")
        .update({ status: "processing" })
        .eq("id", order.shipment_id);

      if (shipmentError) throw shipmentError;

      await logAction({
        action_type: "packing_completed",
        entity_type: "picking_order",
        entity_id: order.id,
        description: `Embalagem concluída para pedido ${order.shipment_id.slice(0, 8)}`,
        details: {
          items_count: items.length,
          total_items: items.reduce((sum, i) => sum + (i.picked_quantity || 0), 0),
        },
      });

      toast({ title: "Embalagem concluída! Pedido pronto para envio." });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao concluir embalagem",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const allItemsPacked = items.every(item => item.isPacked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            Embalagem
            <Badge variant={order.status === "picked" ? "secondary" : "default"}>
              {order.status === "picked" ? "Aguardando" : "Em embalagem"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {order.status === "picked" ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Produtos separados. Inicie a embalagem.
            </p>
            <Button onClick={handleStartPacking} disabled={isLoading}>
              {isLoading ? "Iniciando..." : "Iniciar Embalagem"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Marque os itens conforme for embalando
            </p>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 border rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${
                      item.isPacked ? "bg-primary/5 border-primary/30" : ""
                    }`}
                    onClick={() => toggleItemPacked(item.id)}
                  >
                    <Checkbox
                      checked={item.isPacked}
                      onCheckedChange={() => toggleItemPacked(item.id)}
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${item.isPacked ? "line-through text-muted-foreground" : ""}`}>
                        {item.product?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.product?.sku}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {item.picked_quantity} un
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-2">
              <Label>Observações da embalagem</Label>
              <Textarea
                placeholder="Ex: Embalado em 2 caixas, produto frágil com proteção extra..."
                value={packingNotes}
                onChange={e => setPackingNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCompletePacking}
                disabled={isLoading || !allItemsPacked}
              >
                <Check className="h-4 w-4 mr-2" />
                {isLoading ? "Concluindo..." : "Concluir Embalagem"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
