import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSystemLog } from '@/hooks/useSystemLog';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Package, Edit, Trash2, ArrowUpDown, AlertTriangle, ClipboardCheck, MapPin, Download, EyeOff, Eye } from 'lucide-react';
import { formatNumber, calculateVolumeM3 } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product, ProductLocation } from '@/types/database';
import ProductForm from '@/components/products/ProductForm';
import StockMovementDialog from '@/components/products/StockMovementDialog';
import StockBalanceDialog from '@/components/products/StockBalanceDialog';
import ProductDetailsDialog from '@/components/products/ProductDetailsDialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
}

export default function Products() {
  const { isAdmin, clientId } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [products, setProducts] = useState<ProductWithLocations[]>([]);
  const [clients, setClients] = useState<Array<{id: string; company_name: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [balanceProduct, setBalanceProduct] = useState<Product | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<ProductWithLocations | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('products')
        .select('*, clients(company_name)')
        .order('name');

      // Filtrar por cliente para usuários não-admin
      if (!isAdmin && clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch product locations
      const productIds = data?.map(p => p.id) || [];
      let locationsMap: Record<string, ProductWithLocations['locations']> = {};
      
      if (productIds.length > 0) {
        const { data: locationsData } = await supabase
          .from('product_locations')
          .select(`
            id,
            product_id,
            quantity,
            is_primary,
            warehouse_locations (
              aisle,
              shelf,
              bin
            )
          `)
          .in('product_id', productIds);

        if (locationsData) {
          locationsData.forEach((loc: any) => {
            if (!locationsMap[loc.product_id]) {
              locationsMap[loc.product_id] = [];
            }
            locationsMap[loc.product_id]!.push({
              id: loc.id,
              quantity: loc.quantity,
              is_primary: loc.is_primary,
              location: loc.warehouse_locations,
            });
          });
        }
      }

      setProducts(data?.map(p => ({
        ...p,
        volume_m3: calculateVolumeM3(Number(p.height_cm), Number(p.width_cm), Number(p.depth_cm)),
        locations: locationsMap[p.id] || [],
      })) || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar produtos',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!isAdmin) return;
    const { data } = await supabase.from('clients').select('id, company_name').order('company_name');
    setClients(data || []);
  };

  useEffect(() => {
    fetchProducts();
    fetchClients();
  }, [isAdmin, clientId]);

  const handleDelete = async (product: Product) => {
    if (!confirm(`Tem certeza que deseja excluir "${product.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      await logAction({
        action_type: 'product_deleted',
        entity_type: 'product',
        entity_id: product.id,
        description: `Produto "${product.name}" (SKU: ${product.sku}) excluído`,
        details: { sku: product.sku, name: product.name },
        client_id: product.client_id,
      });

      toast({ title: 'Produto excluído com sucesso!' });
      fetchProducts();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir produto',
        description: error.message,
      });
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = selectedClientId === 'all' || p.client_id === selectedClientId;
    const matchesActive = showInactive || (p as any).is_active !== false;
    return matchesSearch && matchesClient && matchesActive;
  });

  const handleToggleActive = async (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = (product as any).is_active === false;
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus } as any)
        .eq('id', product.id);
      if (error) throw error;
      await logAction({
        action_type: newStatus ? 'product_activated' : 'product_deactivated',
        entity_type: 'product',
        entity_id: product.id,
        description: `Produto "${product.name}" ${newStatus ? 'ativado' : 'inativado'}`,
        client_id: product.client_id,
      });
      toast({ title: `Produto ${newStatus ? 'ativado' : 'inativado'} com sucesso!` });
      fetchProducts();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    }
  };

  const exportCSV = () => {
    const headers = ['SKU', 'Nome', 'Cliente', 'Quantidade', 'Volume (m³)', 'Peso (kg)', 'Localização'];
    const rows = filteredProducts.map((p) => {
      const locs = p.locations?.map(l => `${l.location.aisle}-${l.location.shelf}-${l.location.bin}`).join('; ') || '';
      return [
        p.sku,
        p.name,
        (p as any).clients?.company_name || '',
        p.quantity,
        formatNumber(p.volume_m3 || 0, 4),
        formatNumber(Number(p.weight_kg) || 0, 2),
        locs,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estoque_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Produtos</h1>
            <p className="page-description">Gerencie o estoque de produtos</p>
          </div>
          <Button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* Product Form Dialog - Available for all users when editing */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        setIsFormOpen(open);
        if (!open) setEditingProduct(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingProduct(null);
            }}
            isAdmin={isAdmin}
          />
        </DialogContent>
      </Dialog>

      {/* Search & Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou SKU..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => setShowInactive(!showInactive)} className={showInactive ? 'border-primary text-primary' : ''}>
              {showInactive ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {showInactive ? 'Inativos' : 'Inativos'}
            </Button>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lista de Produtos ({filteredProducts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando produtos...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Nome</TableHead>
                    {isAdmin && <TableHead>Cliente</TableHead>}
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-right">Volume (m³)</TableHead>
                    <TableHead className="text-right">Peso (kg)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const isLowStock = product.quantity <= (product.min_stock_alert || 5);
                    const isInactive = (product as any).is_active === false;
                      return (
                        <TableRow 
                          key={product.id} 
                          className={`cursor-pointer hover:bg-muted/50 ${isInactive ? 'opacity-50' : ''}`}
                          onClick={() => setDetailsProduct(product)}
                        >
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-muted-foreground">
                            {(product as any).clients?.company_name || '-'}
                          </TableCell>
                        )}
                        <TableCell>
                          {product.locations && product.locations.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {product.locations.slice(0, 2).map((loc, idx) => (
                                <Tooltip key={idx}>
                                  <TooltipTrigger>
                                    <Badge 
                                      variant={loc.is_primary ? "default" : "outline"} 
                                      className="font-mono text-xs cursor-help"
                                    >
                                      <MapPin className="h-3 w-3 mr-1" />
                                      {loc.location.aisle}-{loc.location.shelf}-{loc.location.bin}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Rua {loc.location.aisle}, Prat. {loc.location.shelf}, Bin {loc.location.bin}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Qtd: {loc.quantity} {loc.is_primary && '(Principal)'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {product.locations.length > 2 && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="secondary" className="text-xs cursor-help">
                                      +{product.locations.length - 2}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {product.locations.slice(2).map((loc, idx) => (
                                      <p key={idx}>
                                        {loc.location.aisle}-{loc.location.shelf}-{loc.location.bin} (Qtd: {loc.quantity})
                                      </p>
                                    ))}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Sem localização</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={isLowStock ? 'text-destructive font-semibold' : ''}>
                            {product.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(product.volume_m3 || 0, 4)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(Number(product.weight_kg) || 0, 2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isLowStock ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Baixo
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setStockProduct(product)}
                              title="Movimentar estoque"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setBalanceProduct(product)}
                                title="Balanço de estoque"
                              >
                                <ClipboardCheck className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(product)}
                              title="Editar produto"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleToggleActive(product, e)}
                                title={(product as any).is_active === false ? 'Ativar produto' : 'Inativar produto'}
                              >
                                {(product as any).is_active === false ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(product)}
                                title="Excluir produto"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Movement Dialog */}
      <StockMovementDialog
        product={stockProduct}
        onClose={() => setStockProduct(null)}
        onSuccess={() => {
          setStockProduct(null);
          fetchProducts();
        }}
      />

      {/* Stock Balance Dialog (Admin only) */}
      <StockBalanceDialog
        product={balanceProduct}
        onClose={() => setBalanceProduct(null)}
        onSuccess={() => {
          setBalanceProduct(null);
          fetchProducts();
        }}
      />

      {/* Product Details Dialog */}
      <ProductDetailsDialog
        product={detailsProduct}
        onClose={() => setDetailsProduct(null)}
        onEdit={handleEdit}
        isAdmin={isAdmin}
      />
    </DashboardLayout>
  );
}