import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, MapPin, AlertTriangle, Ruler, Scale, Box, Edit } from 'lucide-react';
import { formatNumber, calculateVolumeM3 } from '@/lib/utils';
import { Product } from '@/types/database';

interface ProductWithLocations extends Product {
  locations?: Array<{
    id: string;
    quantity: number;
    is_primary: boolean;
    location: {
      aisle: string;
      shelf: string;
      bin: string;
    };
  }>;
  clients?: {
    company_name: string;
  };
}

interface ProductDetailsDialogProps {
  product: ProductWithLocations | null;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  isAdmin?: boolean;
}

export default function ProductDetailsDialog({ product, onClose, onEdit, isAdmin }: ProductDetailsDialogProps) {
  if (!product) return null;

  const handleEdit = () => {
    onEdit?.(product);
    onClose();
  };

  const volume = calculateVolumeM3(
    Number(product.height_cm),
    Number(product.width_cm),
    Number(product.depth_cm)
  );

  const isLowStock = product.quantity <= (product.min_stock_alert || 0);
  const isHighStock = (product as any).max_stock_alert && product.quantity >= (product as any).max_stock_alert;

  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Produto
          </DialogTitle>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{product.name}</h3>
              <p className="font-mono text-sm text-muted-foreground">SKU: {product.sku}</p>
            </div>
            <div className="flex gap-2">
              {isLowStock && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Estoque Baixo
                </Badge>
              )}
              {isHighStock && (
                <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
                  <AlertTriangle className="h-3 w-3" />
                  Estoque Alto
                </Badge>
              )}
              {!isLowStock && !isHighStock && (
                <Badge variant="secondary">Normal</Badge>
              )}
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}

          {isAdmin && product.clients && (
            <div className="text-sm">
              <span className="text-muted-foreground">Cliente: </span>
              <span className="font-medium">{product.clients.company_name}</span>
            </div>
          )}

          <Separator />

          {/* Stock Info */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{product.quantity}</p>
              <p className="text-xs text-muted-foreground">Quantidade em Estoque</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{product.min_stock_alert ?? '-'}</p>
              <p className="text-xs text-muted-foreground">Estoque Mínimo</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{(product as any).max_stock_alert ?? '-'}</p>
              <p className="text-xs text-muted-foreground">Estoque Máximo</p>
            </div>
          </div>

          <Separator />

          {/* Dimensions */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Dimensões
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Box className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Altura: </span>
                  <span className="font-medium">{formatNumber(Number(product.height_cm), 2)} cm</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Box className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Largura: </span>
                  <span className="font-medium">{formatNumber(Number(product.width_cm), 2)} cm</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Box className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Profundidade: </span>
                  <span className="font-medium">{formatNumber(Number(product.depth_cm), 2)} cm</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Peso: </span>
                  <span className="font-medium">{formatNumber(Number(product.weight_kg) || 0, 3)} kg</span>
                </div>
              </div>
            </div>
            <div className="mt-3 p-2 bg-primary/10 rounded text-center">
              <span className="text-sm text-muted-foreground">Volume: </span>
              <span className="font-semibold">{formatNumber(volume, 6)} m³</span>
            </div>
          </div>

          {/* Locations */}
          {product.locations && product.locations.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Localizações ({product.locations.length})
                </h4>
                <div className="space-y-2">
                  {product.locations.map((loc, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center justify-between p-2 rounded ${
                        loc.is_primary ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={loc.is_primary ? "default" : "outline"} className="font-mono">
                          {loc.location.aisle}-{loc.location.shelf}-{loc.location.bin}
                        </Badge>
                        {loc.is_primary && (
                          <span className="text-xs text-primary font-medium">Principal</span>
                        )}
                      </div>
                      <span className="text-sm font-medium">{loc.quantity} un</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
