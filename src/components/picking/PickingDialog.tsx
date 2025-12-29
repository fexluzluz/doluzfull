import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSystemLog } from "@/hooks/useSystemLog";
import { PickingOrder, PickingItem, Product, WarehouseLocation } from "@/types/database";
import { MapPin, Check, Package, AlertTriangle } from "lucide-react";

interface PickingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PickingOrder;
  onSuccess: () => void;
}

interface PickingItemWithDetails extends PickingItem {
  product?: Product;
  location?: WarehouseLocation;
}

interface LocationGroup {
  location: WarehouseLocation | null;
  items: PickingItemWithDetails[];
}

export function PickingDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: PickingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<PickingItemWithDetails[]>([]);
  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);

  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open, order.id]);

  useEffect(() => {
    // Group items by location for efficient picking route
    const groups: Record<string, LocationGroup> = {};
    
    items.forEach(item => {
      const key = item.location_id || "no-location";
      if (!groups[key]) {
        groups[key] = {
          location: item.location || null,
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    // Sort by location code (aisle, shelf, bin)
    const sortedGroups = Object.values(groups).sort((a, b) => {
      if (!a.location) return 1;
      if (!b.location) return -1;
      const codeA = `${a.location.aisle}-${a.location.shelf}-${a.location.bin}`;
      const codeB = `${b.location.aisle}-${b.location.shelf}-${b.location.bin}`;
      return codeA.localeCompare(codeB);
    });

    setLocationGroups(sortedGroups);
  }, [items]);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("picking_items")
      .select(`
        *,
        products (*),
        warehouse_locations (*)
      `)
      .eq("picking_order_id", order.id);

    if (!error && data) {
      setItems(
        data.map(item => ({
          ...item,
          product: item.products as Product,
          location: item.warehouse_locations as WarehouseLocation,
        }))
      );
    }
  };

  const handlePickItem = async (itemId: string, pickedQty: number) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, picked_quantity: pickedQty }
          : item
      )
    );
  };

  const handleMarkPicked = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("picking_items")
        .update({
          picked_quantity: item.picked_quantity,
          picked_at: new Date().toISOString(),
          picked_by: user?.id,
        })
        .eq("id", itemId);

      if (error) throw error;

      await fetchItems();
      toast({ title: "Item coletado!" });
    } catch (error) {
      toast({
        title: "Erro ao marcar item",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartPicking = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("picking_orders")
        .update({
          status: "picking",
          picker_id: user?.id,
          picking_started_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      toast({ title: "Separação iniciada!" });
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao iniciar separação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompletePicking = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("picking_orders")
        .update({
          status: "picked",
          picking_completed_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;

      await logAction({
        action_type: "picking_completed",
        entity_type: "picking_order",
        entity_id: order.id,
        description: `Separação concluída para pedido ${order.shipment_id.slice(0, 8)}`,
        details: {
          items_count: items.length,
          total_picked: items.reduce((sum, i) => sum + (i.picked_quantity || 0), 0),
        },
      });

      toast({ title: "Separação concluída!" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao concluir separação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getLocationCode = (loc: WarehouseLocation | null) =>
    loc ? `${loc.aisle}-${loc.shelf}-${loc.bin}` : "Sem localização";

  const allItemsPicked = items.every(
    item => item.picked_at !== null
  );

  const hasDiscrepancies = items.some(
    item => item.picked_quantity !== item.quantity
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Lista de Separação
            <Badge variant={order.status === "pending" ? "secondary" : "default"}>
              {order.status === "pending" ? "Pendente" : "Em separação"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {order.status === "pending" ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Clique para iniciar a separação dos itens
            </p>
            <Button onClick={handleStartPicking} disabled={isLoading}>
              {isLoading ? "Iniciando..." : "Iniciar Separação"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Itens organizados por localização para otimizar o percurso
            </p>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-6">
                {locationGroups.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-2">
                    <div className="flex items-center gap-2 sticky top-0 bg-background py-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span className="font-mono font-medium text-primary">
                        {getLocationCode(group.location)}
                      </span>
                      {group.location?.description && (
                        <span className="text-xs text-muted-foreground">
                          - {group.location.description}
                        </span>
                      )}
                    </div>

                    {group.items.map(item => (
                      <div
                        key={item.id}
                        className={`p-3 border rounded-lg ${
                          item.picked_at ? "bg-muted/50 border-muted" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {item.product?.sku}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">Qtd</p>
                              <Badge variant="outline">{item.quantity}</Badge>
                            </div>

                            {!item.picked_at ? (
                              <>
                                <div className="w-20">
                                  <Input
                                    type="number"
                                    min="0"
                                    max={item.quantity}
                                    value={item.picked_quantity || 0}
                                    onChange={e =>
                                      handlePickItem(
                                        item.id,
                                        parseInt(e.target.value) || 0
                                      )
                                    }
                                    className="text-center"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkPicked(item.id)}
                                  disabled={isLoading}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Badge
                                variant={
                                  item.picked_quantity === item.quantity
                                    ? "default"
                                    : "destructive"
                                }
                              >
                                {item.picked_quantity === item.quantity
                                  ? "Coletado"
                                  : `${item.picked_quantity}/${item.quantity}`}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {hasDiscrepancies && allItemsPicked && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <p className="text-sm">
                  Existem divergências entre quantidade solicitada e coletada.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCompletePicking}
                disabled={isLoading || !allItemsPicked}
              >
                <Check className="h-4 w-4 mr-2" />
                {isLoading ? "Concluindo..." : "Concluir Separação"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
