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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WarehouseLocation, Product } from "@/types/database";
import { Plus, Trash2 } from "lucide-react";

interface ProductLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: WarehouseLocation;
  onSuccess: () => void;
}

interface ProductLocationItem {
  id?: string;
  product_id: string;
  quantity: number;
  is_primary: boolean;
  product?: Product;
}

export function ProductLocationDialog({
  open,
  onOpenChange,
  location,
  onSuccess,
}: ProductLocationDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productLocations, setProductLocations] = useState<ProductLocationItem[]>([]);

  useEffect(() => {
    if (open) {
      fetchProducts();
      fetchProductLocations();
    }
  }, [open, location.id]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (!error && data) {
      setProducts(data as Product[]);
    }
  };

  const fetchProductLocations = async () => {
    const { data, error } = await supabase
      .from("product_locations")
      .select(`
        *,
        products (*)
      `)
      .eq("location_id", location.id);

    if (!error && data) {
      setProductLocations(
        data.map(pl => ({
          id: pl.id,
          product_id: pl.product_id,
          quantity: pl.quantity,
          is_primary: pl.is_primary,
          product: pl.products as Product,
        }))
      );
    }
  };

  const addProductRow = () => {
    setProductLocations(prev => [
      ...prev,
      { product_id: "", quantity: 0, is_primary: false },
    ]);
  };

  const removeProductRow = async (index: number) => {
    const item = productLocations[index];
    if (item.id) {
      const { error } = await supabase
        .from("product_locations")
        .delete()
        .eq("id", item.id);

      if (error) {
        toast({
          title: "Erro ao remover produto",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
    }
    setProductLocations(prev => prev.filter((_, i) => i !== index));
  };

  const updateProductRow = (index: number, field: string, value: any) => {
    setProductLocations(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      for (const item of productLocations) {
        if (!item.product_id) continue;

        const data = {
          product_id: item.product_id,
          location_id: location.id,
          quantity: item.quantity,
          is_primary: item.is_primary,
        };

        if (item.id) {
          const { error } = await supabase
            .from("product_locations")
            .update(data)
            .eq("id", item.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("product_locations")
            .insert(data);

          if (error) {
            if (error.code === "23505") {
              toast({
                title: "Produto já existe nesta localização",
                variant: "destructive",
              });
              continue;
            }
            throw error;
          }
        }
      }

      toast({ title: "Produtos atualizados com sucesso!" });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getLocationCode = () => `${location.aisle}-${location.shelf}-${location.bin}`;

  const availableProducts = products.filter(
    p => !productLocations.some(pl => pl.product_id === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Produtos na Localização {getLocationCode()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {productLocations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum produto nesta localização
            </p>
          ) : (
            <div className="space-y-2">
              {productLocations.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    {item.product ? (
                      <span className="font-medium">{item.product.name}</span>
                    ) : (
                      <Select
                        value={item.product_id}
                        onValueChange={value =>
                          updateProductRow(index, "product_id", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProducts.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.sku} - {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <div className="w-24">
                    <Label className="text-xs text-muted-foreground">Qtd</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={e =>
                        updateProductRow(
                          index,
                          "quantity",
                          parseInt(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={item.is_primary}
                      onCheckedChange={checked =>
                        updateProductRow(index, "is_primary", checked)
                      }
                    />
                    <Label className="text-xs">Principal</Label>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProductRow(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            onClick={addProductRow}
            disabled={availableProducts.length === 0}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto
          </Button>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
