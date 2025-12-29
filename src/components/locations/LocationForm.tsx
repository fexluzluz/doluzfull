import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WarehouseLocation, WarehouseLocationFormData } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const locationSchema = z.object({
  aisle: z.string().trim().min(1, "Rua é obrigatória").max(20, "Máximo 20 caracteres"),
  shelf: z.string().trim().min(1, "Prateleira é obrigatória").max(20, "Máximo 20 caracteres"),
  bin: z.string().trim().min(1, "Bin é obrigatório").max(20, "Máximo 20 caracteres"),
  description: z.string().max(200, "Máximo 200 caracteres").optional(),
  max_capacity_m3: z.number().min(0, "Capacidade não pode ser negativa").optional(),
});

interface LocationFormProps {
  location?: WarehouseLocation;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LocationForm({ location, onSuccess, onCancel }: LocationFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<WarehouseLocationFormData>({
    aisle: location?.aisle || "",
    shelf: location?.shelf || "",
    bin: location?.bin || "",
    description: location?.description || "",
    max_capacity_m3: location?.max_capacity_m3 || 0,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === "max_capacity_m3" ? parseFloat(value) || 0 : value,
    }));
    setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const validatedData = locationSchema.parse(formData);

      const insertData = {
        aisle: validatedData.aisle,
        shelf: validatedData.shelf,
        bin: validatedData.bin,
        description: validatedData.description || null,
        max_capacity_m3: validatedData.max_capacity_m3 || 0,
      };

      if (location) {
        const { error } = await supabase
          .from("warehouse_locations")
          .update(insertData)
          .eq("id", location.id);

        if (error) throw error;
        toast({ title: "Localização atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from("warehouse_locations")
          .insert([insertData]);

        if (error) {
          if (error.code === "23505") {
            throw new Error("Já existe uma localização com esta combinação de Rua/Prateleira/Bin");
          }
          throw error;
        }
        toast({ title: "Localização criada com sucesso!" });
      }

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
          title: "Erro ao salvar localização",
          description: error instanceof Error ? error.message : "Erro desconhecido",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aisle">Rua *</Label>
          <Input
            id="aisle"
            name="aisle"
            value={formData.aisle}
            onChange={handleChange}
            placeholder="Ex: A, B, 01"
            className={errors.aisle ? "border-destructive" : ""}
          />
          {errors.aisle && <p className="text-xs text-destructive">{errors.aisle}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="shelf">Prateleira *</Label>
          <Input
            id="shelf"
            name="shelf"
            value={formData.shelf}
            onChange={handleChange}
            placeholder="Ex: 1, 2, 3"
            className={errors.shelf ? "border-destructive" : ""}
          />
          {errors.shelf && <p className="text-xs text-destructive">{errors.shelf}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bin">Bin *</Label>
          <Input
            id="bin"
            name="bin"
            value={formData.bin}
            onChange={handleChange}
            placeholder="Ex: 01, 02, A1"
            className={errors.bin ? "border-destructive" : ""}
          />
          {errors.bin && <p className="text-xs text-destructive">{errors.bin}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Descrição opcional da localização"
          rows={2}
          className={errors.description ? "border-destructive" : ""}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_capacity_m3">Capacidade Máxima (m³)</Label>
        <Input
          id="max_capacity_m3"
          name="max_capacity_m3"
          type="number"
          step="0.01"
          min="0"
          value={formData.max_capacity_m3}
          onChange={handleChange}
          placeholder="0.00"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : location ? "Atualizar" : "Criar"}
        </Button>
      </div>
    </form>
  );
}
