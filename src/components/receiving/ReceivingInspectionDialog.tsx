import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSystemLog } from "@/hooks/useSystemLog";
import { ReceivingOrder, ReceivingItem, WarehouseLocation, Product } from "@/types/database";
import { AlertTriangle, Check, Upload } from "lucide-react";

interface ReceivingInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ReceivingOrder;
  onSuccess: () => void;
}

interface InspectionItem extends ReceivingItem {
  product?: Product;
}

export function ReceivingInspectionDialog({
  open,
  onOpenChange,
  order,
  onSuccess,
}: ReceivingInspectionDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      fetchItems();
      fetchLocations();
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

  const fetchLocations = async () => {
    const { data } = await supabase
      .from("warehouse_locations")
      .select("*")
      .eq("is_active", true)
      .order("aisle")
      .order("shelf")
      .order("bin");

    if (data) setLocations(data as WarehouseLocation[]);
  };

  const updateItem = (itemId: string, field: string, value: any) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInvoiceFile(file);
    }
  };

  const handleStartInspection = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("receiving_orders")
        .update({ status: "inspecting" })
        .eq("id", order.id);

      if (error) throw error;

      toast({ title: "Conferência iniciada!" });
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao iniciar conferência",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteInspection = async () => {
    setIsLoading(true);
    try {
      // Upload invoice if provided
      let invoiceUrl = order.invoice_url;
      if (invoiceFile) {
        const fileName = `${order.id}/${Date.now()}-${invoiceFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(fileName, invoiceFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("uploads")
            .getPublicUrl(fileName);
          invoiceUrl = urlData.publicUrl;
        }
      }

      // Check if it's a temporary cargo
      const isTemporary = (order as any).is_temporary;

      // Update each item
      for (const item of items) {
        const { error: itemError } = await supabase
          .from("receiving_items")
          .update({
            received_quantity: item.received_quantity,
            has_damage: item.has_damage,
            damage_notes: item.damage_notes,
            location_id: item.location_id,
            is_stored: !isTemporary,
          })
          .eq("id", item.id);

        if (itemError) throw itemError;

        // Only update product stock if NOT temporary cargo
        if (!isTemporary && item.received_quantity && item.received_quantity > 0) {
          const product = item.product;
          if (product) {
            const newQuantity = product.quantity + item.received_quantity;

            // Update product quantity
            const { error: productError } = await supabase
              .from("products")
              .update({ quantity: newQuantity })
              .eq("id", item.product_id);

            if (productError) throw productError;

            // Create stock movement
            const { error: movementError } = await supabase
              .from("stock_movements")
              .insert([{
                product_id: item.product_id,
                movement_type: "entry",
                quantity: item.received_quantity,
                previous_quantity: product.quantity,
                new_quantity: newQuantity,
                notes: `Recebimento #${order.invoice_number || order.id.slice(0, 8)}`,
                created_by: user?.id,
              }]);

            if (movementError) throw movementError;

            // Update product location if specified
            if (item.location_id) {
              const { data: existingLoc } = await supabase
                .from("product_locations")
                .select("*")
                .eq("product_id", item.product_id)
                .eq("location_id", item.location_id)
                .maybeSingle();

              if (existingLoc) {
                await supabase
                  .from("product_locations")
                  .update({ quantity: existingLoc.quantity + item.received_quantity })
                  .eq("id", existingLoc.id);
              } else {
                await supabase
                  .from("product_locations")
                  .insert([{
                    product_id: item.product_id,
                    location_id: item.location_id,
                    quantity: item.received_quantity,
                    is_primary: true,
                  }]);
              }
            }
          }
        }
      }

      // Update order status
      const { error: orderError } = await supabase
        .from("receiving_orders")
        .update({
          status: "completed",
          received_date: new Date().toISOString(),
          completed_by: user?.id,
          invoice_url: invoiceUrl,
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      await logAction({
        action_type: "receiving_completed",
        entity_type: "receiving_order",
        entity_id: order.id,
        description: `Recebimento ${order.invoice_number || order.id.slice(0, 8)} concluído`,
        details: {
          items_count: items.length,
          total_received: items.reduce((sum, i) => sum + (i.received_quantity || 0), 0),
        },
        client_id: order.client_id,
      });

      toast({ title: "Recebimento concluído com sucesso!" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Erro ao concluir recebimento",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getLocationCode = (loc: WarehouseLocation) =>
    `${loc.aisle}-${loc.shelf}-${loc.bin}`;

  const allItemsInspected = items.every(
    item => item.received_quantity !== null && item.received_quantity >= 0
  );

  const hasDiscrepancies = items.some(
    item => item.received_quantity !== item.expected_quantity || item.has_damage
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Conferência de Recebimento
            <Badge variant={order.status === "pending" ? "secondary" : "default"}>
              {order.status === "pending" ? "Pendente" : "Em conferência"}
            </Badge>
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

          {order.status === "pending" ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Clique para iniciar a conferência dos itens
              </p>
              <Button onClick={handleStartInspection} disabled={isLoading}>
                {isLoading ? "Iniciando..." : "Iniciar Conferência"}
              </Button>
            </div>
          ) : (
            <>
              {/* Items inspection */}
              <div className="space-y-3">
                <Label>Itens para Conferência</Label>
                {items.map(item => (
                  <div
                    key={item.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.product?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          SKU: {item.product?.sku}
                        </p>
                      </div>
                      <Badge variant="outline">
                        Esperado: {item.expected_quantity}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade Recebida</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.received_quantity || 0}
                          onChange={e =>
                            updateItem(
                              item.id,
                              "received_quantity",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className={
                            item.received_quantity !== item.expected_quantity
                              ? "border-warning"
                              : ""
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Localização</Label>
                        <Select
                          value={item.location_id || ""}
                          onValueChange={value =>
                            updateItem(item.id, "location_id", value || null)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {locations.map(loc => (
                              <SelectItem key={loc.id} value={loc.id}>
                                {getLocationCode(loc)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={item.has_damage}
                          onCheckedChange={checked =>
                            updateItem(item.id, "has_damage", checked)
                          }
                        />
                        <Label className="text-sm flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          Produto com avaria
                        </Label>
                      </div>
                    </div>

                    {item.has_damage && (
                      <Textarea
                        placeholder="Descreva a avaria..."
                        value={item.damage_notes || ""}
                        onChange={e =>
                          updateItem(item.id, "damage_notes", e.target.value)
                        }
                        rows={2}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Invoice upload */}
              <div className="space-y-2">
                <Label>Anexar Nota Fiscal (PDF)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                  />
                  {invoiceFile && (
                    <Badge variant="secondary">
                      <Upload className="h-3 w-3 mr-1" />
                      {invoiceFile.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Discrepancy warning */}
              {hasDiscrepancies && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <p className="text-sm">
                    Existem divergências entre quantidade esperada e recebida ou
                    produtos com avaria.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCompleteInspection}
                  disabled={isLoading || !allItemsInspected}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isLoading ? "Concluindo..." : "Concluir Recebimento"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
