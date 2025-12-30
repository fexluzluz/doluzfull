import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Users, Box, Truck, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { formatNumber, formatDateTime, translateMovementType } from '@/lib/utils';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval, subMonths, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Stats {
  totalProducts: number;
  totalClients: number;
  totalSpaceM3: number;
  pendingShipments: number;
  lowStockCount: number;
}

interface MovementChartData {
  date: string;
  entradas: number;
  saidas: number;
  balancos: number;
}

interface ShipmentChartData {
  date: string;
  pedidos: number;
  entregues: number;
  cancelados: number;
}

interface StatusData {
  name: string;
  value: number;
  color: string;
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
  const [movementChartData, setMovementChartData] = useState<MovementChartData[]>([]);
  const [shipmentChartData, setShipmentChartData] = useState<ShipmentChartData[]>([]);
  const [shipmentStatusData, setShipmentStatusData] = useState<StatusData[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
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
          .select('id, quantity, min_stock_alert');

        // Fetch recent movements
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('*, products(name, sku)')
          .order('created_at', { ascending: false })
          .limit(5);

        let totalSpace = 0;
        let temporarySpace = 0;
        let clientsCount = 0;

        if (isAdmin) {
          // Fetch total space for admin
          const { data: clientsData } = await supabase
            .from('clients')
            .select('total_space_m3');
          
          totalSpace = clientsData?.reduce((sum, c) => sum + Number(c.total_space_m3 || 0), 0) || 0;
          clientsCount = clientsData?.length || 0;

          // Fetch temporary storage space (receiving orders awaiting pickup or completed but not discharged)
          const { data: tempReceiving } = await supabase
            .from('receiving_orders')
            .select('temporary_volume_m3, status, discharged_at')
            .eq('is_temporary', true)
            .in('status', ['inspecting', 'awaiting_pickup', 'completed'])
            .is('discharged_at', null);
          
          temporarySpace = tempReceiving?.reduce((sum, r) => sum + Number(r.temporary_volume_m3 || 0), 0) || 0;
        } else if (clientId) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('total_space_m3')
            .eq('id', clientId)
            .maybeSingle();
          
          totalSpace = Number(clientData?.total_space_m3 || 0);

          // Fetch temporary storage space for this client (awaiting pickup or completed but not discharged)
          const { data: tempReceiving } = await supabase
            .from('receiving_orders')
            .select('temporary_volume_m3, status, discharged_at')
            .eq('client_id', clientId)
            .eq('is_temporary', true)
            .in('status', ['inspecting', 'awaiting_pickup', 'completed'])
            .is('discharged_at', null);
          
          temporarySpace = tempReceiving?.reduce((sum, r) => sum + Number(r.temporary_volume_m3 || 0), 0) || 0;
        }

        setStats({
          totalProducts: productsCount || 0,
          totalClients: clientsCount,
          totalSpaceM3: totalSpace + temporarySpace,
          pendingShipments: pendingCount || 0,
          lowStockCount: lowStockData?.filter(p => p.quantity <= (p.min_stock_alert || 5)).length || 0,
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

  // Fetch chart data based on period
  useEffect(() => {
    const fetchChartData = async () => {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = startOfDay(subDays(new Date(), days));

      try {
        // Fetch movements for chart
        const { data: movementsData } = await supabase
          .from('stock_movements')
          .select('movement_type, created_at, quantity')
          .gte('created_at', startDate.toISOString())
          .order('created_at');

        // Fetch shipments for chart
        const { data: shipmentsData } = await supabase
          .from('shipment_requests')
          .select('status, created_at, updated_at')
          .gte('created_at', startDate.toISOString())
          .order('created_at');

        // Fetch all shipments for status pie chart
        const { data: allShipments } = await supabase
          .from('shipment_requests')
          .select('status');

        // Process movements data
        const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
        const movementsByDate: Record<string, { entradas: number; saidas: number; balancos: number }> = {};
        
        dateRange.forEach(date => {
          const key = format(date, 'yyyy-MM-dd');
          movementsByDate[key] = { entradas: 0, saidas: 0, balancos: 0 };
        });

        movementsData?.forEach(m => {
          const key = format(new Date(m.created_at), 'yyyy-MM-dd');
          if (movementsByDate[key]) {
            if (m.movement_type === 'entry') {
              movementsByDate[key].entradas += m.quantity;
            } else if (m.movement_type === 'exit') {
              movementsByDate[key].saidas += m.quantity;
            } else if (m.movement_type === 'balance') {
              movementsByDate[key].balancos += 1;
            }
          }
        });

        const movementChart = Object.entries(movementsByDate).map(([date, data]) => ({
          date: format(new Date(date), days <= 7 ? 'EEE' : 'dd/MM', { locale: ptBR }),
          ...data,
        }));

        setMovementChartData(movementChart);

        // Process shipments data
        const shipmentsByDate: Record<string, { pedidos: number; entregues: number; cancelados: number }> = {};
        
        dateRange.forEach(date => {
          const key = format(date, 'yyyy-MM-dd');
          shipmentsByDate[key] = { pedidos: 0, entregues: 0, cancelados: 0 };
        });

        shipmentsData?.forEach(s => {
          const key = format(new Date(s.created_at), 'yyyy-MM-dd');
          if (shipmentsByDate[key]) {
            shipmentsByDate[key].pedidos += 1;
            if (s.status === 'delivered') {
              shipmentsByDate[key].entregues += 1;
            } else if (s.status === 'cancelled') {
              shipmentsByDate[key].cancelados += 1;
            }
          }
        });

        const shipmentChart = Object.entries(shipmentsByDate).map(([date, data]) => ({
          date: format(new Date(date), days <= 7 ? 'EEE' : 'dd/MM', { locale: ptBR }),
          ...data,
        }));

        setShipmentChartData(shipmentChart);

        // Process status data for pie chart
        const statusCount: Record<string, number> = {
          pending: 0,
          processing: 0,
          shipped: 0,
          delivered: 0,
          cancelled: 0,
        };

        allShipments?.forEach(s => {
          if (statusCount[s.status] !== undefined) {
            statusCount[s.status]++;
          }
        });

        const statusColors: Record<string, string> = {
          pending: 'hsl(var(--warning))',
          processing: 'hsl(var(--primary))',
          shipped: 'hsl(var(--accent))',
          delivered: 'hsl(var(--success))',
          cancelled: 'hsl(var(--destructive))',
        };

        const statusLabels: Record<string, string> = {
          pending: 'Pendente',
          processing: 'Em Separação',
          shipped: 'Enviado',
          delivered: 'Entregue',
          cancelled: 'Cancelado',
        };

        setShipmentStatusData(
          Object.entries(statusCount)
            .filter(([_, value]) => value > 0)
            .map(([key, value]) => ({
              name: statusLabels[key],
              value,
              color: statusColors[key],
            }))
        );

      } catch (error) {
        console.error('Error fetching chart data:', error);
      }
    };

    fetchChartData();
  }, [period]);

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-description">
              Bem-vindo, {profile?.full_name || 'Usuário'}! Aqui está o resumo do seu estoque.
            </p>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Movements Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Movimentações de Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {movementChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={movementChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="balancos" name="Balanços" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de movimentação no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shipments Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pedidos por Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {shipmentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={shipmentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="pedidos" name="Pedidos" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="entregues" name="Entregues" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cancelados" name="Cancelados" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem dados de pedidos no período
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Status Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status dos Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {shipmentStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={shipmentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {shipmentStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Sem pedidos registrados
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Movements */}
        <Card className="lg:col-span-2">
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
                      <div className={`p-2 rounded-lg ${
                        movement.movement_type === 'entry' ? 'bg-success/10' : 
                        movement.movement_type === 'balance' ? 'bg-primary/10' : 
                        'bg-destructive/10'
                      }`}>
                        {movement.movement_type === 'entry' ? (
                          <TrendingUp className="h-4 w-4 text-success" />
                        ) : movement.movement_type === 'balance' ? (
                          <Package className="h-4 w-4 text-primary" />
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
      </div>
    </DashboardLayout>
  );
}
