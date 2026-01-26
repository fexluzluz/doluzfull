import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDateTime, translateMovementType } from '@/lib/utils';

interface Movement {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_at: string;
  products: {
    name: string;
    sku: string;
    clients: {
      company_name: string;
    } | null;
  } | null;
}

export default function Movements() {
  const { isAdmin, clientId } = useAuth();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMovements = async () => {
      // Wait for auth to load - if not admin, we need clientId
      if (!isAdmin && !clientId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        let query = supabase
          .from('stock_movements')
          .select('*, products!inner(name, sku, client_id, clients(company_name))')
          .order('created_at', { ascending: false })
          .limit(100);

        // Filter by client_id if not admin
        if (!isAdmin && clientId) {
          query = query.eq('products.client_id', clientId);
        }

        const { data, error } = await query;

        if (error) throw error;
        setMovements(data || []);
      } catch (error) {
        console.error('Error fetching movements:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovements();
  }, [isAdmin, clientId]);

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Movimentações</h1>
        <p className="page-description">Histórico de entradas e saídas de estoque</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Últimas Movimentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando movimentações...
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação registrada.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Qtd</TableHead>
                    <TableHead className="text-center">Anterior</TableHead>
                    <TableHead className="text-center">Novo</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(movement.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}
                          className={`gap-1 ${movement.movement_type === 'entry' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}`}
                        >
                          {movement.movement_type === 'entry' ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {translateMovementType(movement.movement_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{movement.products?.name}</p>
                          <p className="text-xs text-muted-foreground">{movement.products?.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {movement.products?.clients?.company_name || '-'}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {movement.previous_quantity}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {movement.new_quantity}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-48 truncate">
                        {movement.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}