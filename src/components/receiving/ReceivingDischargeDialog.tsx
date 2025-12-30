import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSystemLog } from "@/hooks/useSystemLog";
import { ReceivingOrder, ReceivingItem, Product } from "@/types/database";
import { PackageX, Calendar, Package, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReceivingDischargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ReceivingOrder;
  onSuccess: () => void;
}

interface DischargeItem extends ReceivingItem {
  product?: Product;
}

export function ReceivingDischargeDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: ReceivingDischargeDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<DischargeItem[]>([]);

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, order.id]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("receiving_items")
      .select(`
        *,
        products (*)
      `)
      .eq("receiving_id", order.id);

    if (!error && data) {
      setItems(
        data.map(item => ({
          ...item,
          product: item.products as Product,
        }))
      );
    }
  };

  const calculateStorageDays = () => {
    if (!order.received_date) return 0;
    return Math.max(1, differenceInDays(new Date(), new Date(order.received_date)));
  };

  const handleDischarge = async () => {
    setIsLoading(true);
    try {
      // Update order as discharged
      const { error: orderError } = await supabase
        .from("receiving_orders")
        .update({
          discharged_at: new Date().toISOString(),
          discharged_by: user?.id,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      await logAction({
        action_type: "receiving_discharged",
        entity_type: "receiving_order",
        entity_id: order.id,
        description: `Carga temporária ${order.invoice_number || order.id.slice(0, 8)} dada baixa`,
        details: {
          items_count: items.length,
          total_quantity: items.reduce((sum, i) => sum + (i.received_quantity || 0), 0),
          storage_days: calculateStorageDays(),
        },
        client_id: order.client_id,
      });

      toast({ title: "Baixa registrada com sucesso!" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao dar baixa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const storageDays = calculateStorageDays();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5" />
            Dar Baixa em Carga Temporária
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Nota Fiscal</p>
              <p className="font-medium">{order.invoice_number || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fornecedor</p>
              <p className="font-medium">{order.supplier_name || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data Recebimento</p>
              <p className="font-medium">
                {order.received_date
                  ? format(new Date(order.received_date), "dd/MM/yyyy", { locale: ptBR })
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dias Armazenados</p>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {storageDays} {storageDays === 1 ? "dia" : "dias"}
              </p>
            </div>
          </div>

          {/* Items summary */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Itens da Carga</p>
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {items.map(item => (
                <div key={item.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.product?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        SKU: {item.product?.sku}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {item.received_quantity} un
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Atenção</p>
              <p className="text-muted-foreground">
                Ao confirmar, a carga será marcada como liberada. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDischarge} disabled={isLoading} variant="destructive">
            <PackageX className="h-4 w-4 mr-2" />
            {isLoading ? "Processando..." : "Confirmar Baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
