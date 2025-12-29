import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Product } from '@/types/database';

interface StockMovementDialogProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockMovementDialog({ product, onClose, onSuccess }: StockMovementDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [movementType, setMovementType] = useState<'entry' | 'exit'>('entry');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !user) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        variant: 'destructive',
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade maior que zero.',
      });
      return;
    }

    if (movementType === 'exit' && qty > product.quantity) {
      toast({
        variant: 'destructive',
        title: 'Estoque insuficiente',
        description: `Quantidade em estoque: ${product.quantity}`,
      });
      return;
    }

    setIsLoading(true);

    try {
      const newQuantity = movementType === 'entry' 
        ? product.quantity + qty 
        : product.quantity - qty;

      // Insert movement
      const { error: movementError } = await supabase.from('stock_movements').insert({
        product_id: product.id,
        movement_type: movementType,
        quantity: qty,
        previous_quantity: product.quantity,
        new_quantity: newQuantity,
        notes: notes.trim() || null,
        created_by: user.id,
      });

      if (movementError) throw movementError;

      // Update product quantity
      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', product.id);

      if (updateError) throw updateError;

      toast({
        title: 'Movimentação registrada!',
        description: `${movementType === 'entry' ? 'Entrada' : 'Saída'} de ${qty} unidades.`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar movimentação',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity('');
    setNotes('');
    setMovementType('entry');
    onClose();
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Movimentar Estoque</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Product Info */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              <p className="text-sm mt-1">
                Estoque atual: <span className="font-semibold">{product.quantity}</span> unidades
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Movement Type */}
              <Tabs value={movementType} onValueChange={(v) => setMovementType(v as 'entry' | 'exit')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="entry" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Entrada
                  </TabsTrigger>
                  <TabsTrigger value="exit" className="gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Saída
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max={movementType === 'exit' ? product.quantity : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Motivo da movimentação..."
                  rows={2}
                  maxLength={500}
                />
              </div>

              {/* Preview */}
              {quantity && parseInt(quantity) > 0 && (
                <div className={`p-3 rounded-lg ${movementType === 'entry' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  <p className="text-sm">
                    Novo estoque:{' '}
                    <span className="font-semibold">
                      {movementType === 'entry'
                        ? product.quantity + parseInt(quantity)
                        : product.quantity - parseInt(quantity)}
                    </span>{' '}
                    unidades
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}