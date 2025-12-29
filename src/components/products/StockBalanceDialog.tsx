import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { Product } from '@/types/database';

interface StockBalanceDialogProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StockBalanceDialog({ product, onClose, onSuccess }: StockBalanceDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [newQuantity, setNewQuantity] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product || !user) return;

    const qty = parseInt(newQuantity);
    if (isNaN(qty) || qty < 0) {
      toast({
        variant: 'destructive',
        title: 'Quantidade inválida',
        description: 'Informe uma quantidade válida (zero ou maior).',
      });
      return;
    }

    if (qty === product.quantity) {
      toast({
        variant: 'destructive',
        title: 'Sem alteração',
        description: 'A quantidade informada é igual ao estoque atual.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Fetch user profile to get operator name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', user.id)
        .maybeSingle();

      const operatorName = profile?.full_name || profile?.email || user.email || 'Admin';
      const difference = qty - product.quantity;
      const movementType = difference > 0 ? 'entry' : 'exit';

      // Insert balance movement with operator info
      const { error: movementError } = await supabase.from('stock_movements').insert({
        product_id: product.id,
        movement_type: 'balance',
        quantity: Math.abs(difference),
        previous_quantity: product.quantity,
        new_quantity: qty,
        notes: `[BALANÇO] Operador: ${operatorName}. ${notes.trim() || 'Ajuste de inventário'}`,
        created_by: user.id,
      });

      if (movementError) throw movementError;

      // Update product quantity
      const { error: updateError } = await supabase
        .from('products')
        .update({ quantity: qty })
        .eq('id', product.id);

      if (updateError) throw updateError;

      toast({
        title: 'Balanço registrado!',
        description: `Estoque ajustado de ${product.quantity} para ${qty} unidades.`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar balanço',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNewQuantity('');
    setNotes('');
    onClose();
  };

  const difference = newQuantity && !isNaN(parseInt(newQuantity)) && product
    ? parseInt(newQuantity) - product.quantity
    : null;

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Balanço de Estoque
          </DialogTitle>
          <DialogDescription>
            Informe a quantidade real contada no inventário.
          </DialogDescription>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Product Info */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{product.name}</p>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              <p className="text-sm mt-1">
                Estoque sistema: <span className="font-semibold">{product.quantity}</span> unidades
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Quantity */}
              <div className="space-y-2">
                <Label htmlFor="newQuantity">Quantidade Real (Contagem) *</Label>
                <Input
                  id="newQuantity"
                  type="number"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  placeholder="Informe a quantidade contada"
                  autoFocus
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Motivo do ajuste, local da contagem..."
                  rows={2}
                  maxLength={500}
                />
              </div>

              {/* Preview */}
              {difference !== null && difference !== 0 && (
                <div className={`p-3 rounded-lg ${difference > 0 ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                  <p className="text-sm font-medium">
                    {difference > 0 ? (
                      <span className="text-success">+{difference} unidades (sobra)</span>
                    ) : (
                      <span className="text-destructive">{difference} unidades (falta)</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estoque será ajustado para {newQuantity} unidades
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || !newQuantity}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Confirmar Balanço'
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
