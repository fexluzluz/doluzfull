import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Users, Box, Truck, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { formatNumber, formatDateTime, translateMovementType } from '@/lib/utils';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Stats {
  totalProducts: number;
  totalClients: number;
  totalSpaceM3: number;
  pendingShipments: number;
  lowStockCount: number;
}

export default function Dashboard() {
  const { isAdmin, clientId, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    totalClients: 0,
    totalSpaceM3: 0,
    pendingShipments: 0,
    lowStockCount: 0,
  });
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products count
        const { count: productsCount } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true });

        // Fetch pending shipments
        const { count: pendingCount } = await supabase
          .from('shipment_requests')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']);

        // Fetch low stock products
        const { data: lowStockData } = await supabase
          .from('products')
          .select('id, quantity, min_stock_alert')
          .filter('quantity', 'lte', 'min_stock_alert');

        // Fetch recent movements
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('*, products(name, sku)')
          .order('created_at', { ascending: false })
          .limit(5);

        let totalSpace = 0;
        let clientsCount = 0;

        if (isAdmin) {
          // Fetch total space for admin
          const { data: clientsData } = await supabase
            .from('clients')
            .select('total_space_m3');
          
          totalSpace = clientsData?.reduce((sum, c) => sum + Number(c.total_space_m3 || 0), 0) || 0;
          clientsCount = clientsData?.length || 0;
        } else if (clientId) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('total_space_m3')
            .eq('id', clientId)
            .single();
          
          totalSpace = Number(clientData?.total_space_m3 || 0);
        }

        setStats({
          totalProducts: productsCount || 0,
          totalClients: clientsCount,
          totalSpaceM3: totalSpace,
          pendingShipments: pendingCount || 0,
          lowStockCount: lowStockData?.filter(p => p.quantity <= p.min_stock_alert).length || 0,
        });

        setRecentMovements(movements || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [isAdmin, clientId]);

  const statCards = [
    {
      title: 'Produtos em Estoque',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Espaço Ocupado',
      value: `${formatNumber(stats.totalSpaceM3, 2)} m³`,
      icon: Box,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Envios Pendentes',
      value: stats.pendingShipments,
      icon: Truck,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Estoque Baixo',
      value: stats.lowStockCount,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  if (isAdmin) {
    statCards.splice(1, 0, {
      title: 'Total de Clientes',
      value: stats.totalClients,
      icon: Users,
      color: 'text-success',
      bgColor: 'bg-success/10',
    });
  }

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Bem-vindo, {profile?.full_name || 'Usuário'}! Aqui está o resumo do seu estoque.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, index) => (
          <Card key={index} className="stat-card animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Movimentações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentMovements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma movimentação registrada ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {recentMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${movement.movement_type === 'entry' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      {movement.movement_type === 'entry' ? (
                        <TrendingUp className="h-4 w-4 text-success" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{movement.products?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {translateMovementType(movement.movement_type)} de {movement.quantity} unidades
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(movement.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}