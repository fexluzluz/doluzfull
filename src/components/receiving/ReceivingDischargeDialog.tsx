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
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSystemLog } from "@/hooks/useSystemLog";
import { ReceivingOrder, ReceivingItem, Product } from "@/types/database";
import { LogOut, Calendar, Package, AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
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
      const storageDays = calculateStorageDays();
      
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
        description: `Saída de carga temporária ${order.invoice_number || order.id.slice(0, 8)} - ${storageDays} dias`,
        details: {
          items_count: items.length,
          total_quantity: items.reduce((sum, i) => sum + (i.received_quantity || 0), 0),
          storage_days: storageDays,
          volume_m3: order.temporary_volume_m3,
          billable_m3_days: order.temporary_volume_m3 * storageDays,
        },
        client_id: order.client_id,
      });

      toast({ title: "Saída registrada com sucesso!" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao registrar saída",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const storageDays = calculateStorageDays();
  const totalBillableM3Days = order.temporary_volume_m3 * storageDays;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Registrar Saída de Carga
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
          </div>

          {/* Storage Timeline */}
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Período de Armazenagem
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Entrada</p>
                <Badge variant="outline" className="font-mono">
                  {order.received_date
                    ? format(new Date(order.received_date), "dd/MM/yyyy", { locale: ptBR })
                    : "-"}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                <span className="text-lg font-bold text-foreground">{storageDays}</span>
                <span className="text-xs">{storageDays === 1 ? "dia" : "dias"}</span>
              </div>
              
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Saída</p>
                <Badge variant="default" className="font-mono">
                  {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
                </Badge>
              </div>
            </div>
          </div>

          {/* Billing Summary */}
          {order.temporary_volume_m3 > 0 && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Resumo para Cobrança
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{order.temporary_volume_m3.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">m³</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">×</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{storageDays}</p>
                  <p className="text-xs text-muted-foreground">{storageDays === 1 ? "dia" : "dias"}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{totalBillableM3Days.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">m³/dia (total faturável)</p>
              </div>
            </div>
          )}

          {/* Items summary */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Itens da Carga</p>
              <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                {items.map(item => (
                  <div key={item.id} className="p-2 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span>{item.product?.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {item.received_quantity} un
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Confirmar saída</p>
              <p className="text-muted-foreground">
                Esta ação registra a saída da carga para faturamento. Não pode ser desfeita.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleDischarge} disabled={isLoading}>
            <LogOut className="h-4 w-4 mr-2" />
            {isLoading ? "Processando..." : "Confirmar Saída"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
