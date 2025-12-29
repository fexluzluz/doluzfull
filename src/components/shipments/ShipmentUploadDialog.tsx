import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, Check, X } from 'lucide-react';

interface ShipmentUploadDialogProps {
  shipment: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShipmentUploadDialog({ shipment, onClose, onSuccess }: ShipmentUploadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const invoiceInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (type: 'label' | 'invoice', file: File | null) => {
    if (type === 'label') {
      setLabelFile(file);
    } else {
      setInvoiceFile(file);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${shipment.id}/${path}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shipment || (!labelFile && !invoiceFile)) {
      toast({
        variant: 'destructive',
        title: 'Nenhum arquivo selecionado',
        description: 'Selecione pelo menos um arquivo para upload.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const updateData: any = {};

      if (labelFile) {
        const labelUrl = await uploadFile(labelFile, 'etiqueta');
        updateData.shipping_label_url = labelUrl;
      }

      if (invoiceFile) {
        const invoiceUrl = await uploadFile(invoiceFile, 'nota_fiscal');
        updateData.invoice_url = invoiceUrl;
      }

      const { error } = await supabase
        .from('shipment_requests')
        .update(updateData)
        .eq('id', shipment.id);

      if (error) throw error;

      toast({ title: 'Arquivos enviados com sucesso!' });
      onSuccess();
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar arquivos',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={!!shipment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload de Arquivos</DialogTitle>
        </DialogHeader>

        {shipment && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                Envio para: <span className="font-semibold">{shipment.recipient_name}</span>
              </p>
            </div>

            {/* Shipping Label */}
            <div className="space-y-2">
              <Label>Etiqueta de Envio</Label>
              <input
                type="file"
                ref={labelInputRef}
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileChange('label', e.target.files?.[0] || null)}
              />
              <div
                onClick={() => labelInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  ${labelFile ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'}
                `}
              >
                {labelFile ? (
                  <div className="flex items-center justify-center gap-2 text-success">
                    <Check className="h-5 w-5" />
                    <span className="text-sm font-medium">{labelFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLabelFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : shipment.shipping_label_url ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm">Já possui etiqueta - Clique para substituir</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">Clique para selecionar (PDF, PNG, JPG)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice */}
            <div className="space-y-2">
              <Label>Nota Fiscal</Label>
              <input
                type="file"
                ref={invoiceInputRef}
                accept=".pdf,.xml,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFileChange('invoice', e.target.files?.[0] || null)}
              />
              <div
                onClick={() => invoiceInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                  ${invoiceFile ? 'border-success bg-success/5' : 'border-border hover:border-primary/50'}
                `}
              >
                {invoiceFile ? (
                  <div className="flex items-center justify-center gap-2 text-success">
                    <Check className="h-5 w-5" />
                    <span className="text-sm font-medium">{invoiceFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInvoiceFile(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : shipment.invoice_url ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm">Já possui NF - Clique para substituir</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span className="text-sm">Clique para selecionar (PDF, XML, PNG, JPG)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || (!labelFile && !invoiceFile)}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Arquivos'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}