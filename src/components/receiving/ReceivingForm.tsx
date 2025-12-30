import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Product, Client } from "@/types/database";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Clock } from "lucide-react";
import { z } from "zod";

const receivingSchema = z.object({
  invoice_number: z.string().max(50, "Máximo 50 caracteres").optional(),
  supplier_name: z.string().max(100, "Máximo 100 caracteres").optional(),
  expected_date: z.string().optional(),
  notes: z.string().max(500, "Máximo 500 caracteres").optional(),
});

interface ReceivingFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface ItemRow {
  product_id: string;
  expected_quantity: number;
}

export function ReceivingForm({ onSuccess, onCancel }: ReceivingFormProps) {
  const { isAdmin, clientId, user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([{ product_id: "", expected_quantity: 1 }]);
  const [isTemporary, setIsTemporary] = useState(false);
  const [temporaryVolumeM3, setTemporaryVolumeM3] = useState("");
  const [formData, setFormData] = useState({
    invoice_number: "",
    supplier_name: "",
    expected_date: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isAdmin) {
      fetchClients();
    } else if (clientId) {
      setSelectedClientId(clientId);
      fetchProducts(clientId);
    }
  }, [isAdmin, clientId]);

  useEffect(() => {
    if (selectedClientId) {
      fetchProducts(selectedClientId);
    }
  }, [selectedClientId]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .order("company_name");
    if (data) setClients(data as Client[]);
  };

  const fetchProducts = async (cId: string) => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("client_id", cId)
      .order("name");
    if (data) setProducts(data as Product[]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { product_id: "", expected_quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ItemRow, value: any) => {
    setItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      receivingSchema.parse(formData);

      const validItems = items.filter(item => item.product_id && item.expected_quantity > 0);
      if (validItems.length === 0) {
        throw new Error("Adicione pelo menos um produto");
      }

      const targetClientId = isAdmin ? selectedClientId : clientId;
      if (!targetClientId) {
        throw new Error("Cliente não selecionado");
      }

      // Create receiving order
      const { data: order, error: orderError } = await supabase
        .from("receiving_orders")
        .insert([{
          client_id: targetClientId,
          invoice_number: formData.invoice_number || null,
          supplier_name: formData.supplier_name || null,
          expected_date: formData.expected_date || null,
          notes: formData.notes || null,
          created_by: user?.id,
          status: 'pending',
          is_temporary: isTemporary,
          temporary_volume_m3: isTemporary ? (parseFloat(temporaryVolumeM3) || 0) : 0,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create receiving items
      const itemsToInsert = validItems.map(item => ({
        receiving_id: order.id,
        product_id: item.product_id,
        expected_quantity: item.expected_quantity,
        received_quantity: 0,
        is_stored: !isTemporary, // Temporary cargo won't be stored in main inventory
      }));

      const { error: itemsError } = await supabase
        .from("receiving_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({ title: "Ordem de recebimento criada com sucesso!" });
      onSuccess();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: "Erro ao criar ordem",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const availableProducts = products.filter(
    p => !items.some(item => item.product_id === p.id)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isAdmin && (
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice_number">Nº Nota Fiscal</Label>
          <Input
            id="invoice_number"
            name="invoice_number"
            value={formData.invoice_number}
            onChange={handleChange}
            placeholder="Ex: 123456"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier_name">Fornecedor</Label>
          <Input
            id="supplier_name"
            name="supplier_name"
            value={formData.supplier_name}
            onChange={handleChange}
            placeholder="Nome do fornecedor"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expected_date">Data Prevista</Label>
        <Input
          id="expected_date"
          name="expected_date"
          type="date"
          value={formData.expected_date}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Observações sobre o recebimento"
          rows={2}
        />
      </div>

      {/* Temporary cargo toggle */}
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Carga Temporária</p>
              <p className="text-xs text-muted-foreground">
                Itens que serão armazenados por um período e depois retirados
              </p>
            </div>
          </div>
          <Switch
            checked={isTemporary}
            onCheckedChange={setIsTemporary}
          />
        </div>
        
        {isTemporary && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="temporary_volume_m3">Volume da Carga (m³)</Label>
            <Input
              id="temporary_volume_m3"
              type="number"
              step="0.01"
              min="0"
              value={temporaryVolumeM3}
              onChange={e => setTemporaryVolumeM3(e.target.value)}
              placeholder="Ex: 2.5"
            />
            <p className="text-xs text-muted-foreground">
              Informe o volume total em metros cúbicos para cálculo de armazenamento
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Produtos *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            disabled={availableProducts.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
            <div className="flex-1">
              <Select
                value={item.product_id}
                onValueChange={value => updateItem(index, "product_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products
                    .filter(p => p.id === item.product_id || !items.some(i => i.product_id === p.id))
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-24">
              <Input
                type="number"
                min="1"
                value={item.expected_quantity}
                onChange={e =>
                  updateItem(index, "expected_quantity", parseInt(e.target.value) || 1)
                }
                placeholder="Qtd"
              />
            </div>
            {items.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || (!isAdmin && !clientId) || (isAdmin && !selectedClientId)}>
          {isLoading ? "Criando..." : "Criar Ordem"}
        </Button>
      </div>
    </form>
  );
}
