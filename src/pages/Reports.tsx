import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Clock,
  Users,
  Package,
  TrendingUp,
  Timer,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { format, subDays, differenceInMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OperatorStats {
  id: string;
  name: string;
  email: string;
  pickingOrders: number;
  packingOrders: number;
  totalItems: number;
  avgPickingTime: number;
  avgPackingTime: number;
}

interface DailyVolume {
  date: string;
  receiving: number;
  picking: number;
  shipping: number;
}

interface TimeMetrics {
  avgPickingTime: number;
  avgPackingTime: number;
  avgTotalTime: number;
  minPickingTime: number;
  maxPickingTime: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Reports() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("30");
  const [isLoading, setIsLoading] = useState(true);
  const [operatorStats, setOperatorStats] = useState<OperatorStats[]>([]);
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([]);
  const [timeMetrics, setTimeMetrics] = useState<TimeMetrics>({
    avgPickingTime: 0,
    avgPackingTime: 0,
    avgTotalTime: 0,
    minPickingTime: 0,
    maxPickingTime: 0,
  });
  const [summaryStats, setSummaryStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    totalItems: 0,
    avgItemsPerOrder: 0,
    discrepancyRate: 0,
  });

  useEffect(() => {
    fetchReportData();
  }, [period]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const startDate = subDays(new Date(), parseInt(period));

      // Fetch picking orders with details
      const { data: pickingOrders, error: pickingError } = await supabase
        .from("picking_orders")
        .select(`
          *,
          shipment_requests (client_id)
        `)
        .gte("created_at", startDate.toISOString());

      if (pickingError) throw pickingError;

      // Fetch picking items for volume
      const { data: pickingItems } = await supabase
        .from("picking_items")
        .select("*")
        .gte("created_at", startDate.toISOString());

      // Fetch receiving orders
      const { data: receivingOrders } = await supabase
        .from("receiving_orders")
        .select("*")
        .gte("created_at", startDate.toISOString());

      // Fetch shipments
      const { data: shipments } = await supabase
        .from("shipment_requests")
        .select("*")
        .gte("created_at", startDate.toISOString());

      // Fetch profiles for operator names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");

      const profileMap = new Map(
        profiles?.map(p => [p.user_id, { name: p.full_name, email: p.email }]) || []
      );

      // Calculate operator statistics
      const operatorMap = new Map<string, OperatorStats>();

      pickingOrders?.forEach(order => {
        // Picker stats
        if (order.picker_id) {
          if (!operatorMap.has(order.picker_id)) {
            const profile = profileMap.get(order.picker_id);
            operatorMap.set(order.picker_id, {
              id: order.picker_id,
              name: profile?.name || "Desconhecido",
              email: profile?.email || "",
              pickingOrders: 0,
              packingOrders: 0,
              totalItems: 0,
              avgPickingTime: 0,
              avgPackingTime: 0,
            });
          }
          const stats = operatorMap.get(order.picker_id)!;
          stats.pickingOrders++;
          
          if (order.picking_started_at && order.picking_completed_at) {
            const time = differenceInMinutes(
              parseISO(order.picking_completed_at),
              parseISO(order.picking_started_at)
            );
            stats.avgPickingTime = 
              (stats.avgPickingTime * (stats.pickingOrders - 1) + time) / stats.pickingOrders;
          }
        }

        // Packer stats
        if (order.packer_id) {
          if (!operatorMap.has(order.packer_id)) {
            const profile = profileMap.get(order.packer_id);
            operatorMap.set(order.packer_id, {
              id: order.packer_id,
              name: profile?.name || "Desconhecido",
              email: profile?.email || "",
              pickingOrders: 0,
              packingOrders: 0,
              totalItems: 0,
              avgPickingTime: 0,
              avgPackingTime: 0,
            });
          }
          const stats = operatorMap.get(order.packer_id)!;
          stats.packingOrders++;
          
          if (order.packing_started_at && order.packing_completed_at) {
            const time = differenceInMinutes(
              parseISO(order.packing_completed_at),
              parseISO(order.packing_started_at)
            );
            stats.avgPackingTime = 
              (stats.avgPackingTime * (stats.packingOrders - 1) + time) / stats.packingOrders;
          }
        }
      });

      // Add items count per operator
      pickingItems?.forEach(item => {
        const order = pickingOrders?.find(o => o.id === item.picking_order_id);
        if (order?.picker_id && operatorMap.has(order.picker_id)) {
          operatorMap.get(order.picker_id)!.totalItems += item.picked_quantity || 0;
        }
      });

      setOperatorStats(Array.from(operatorMap.values()).sort((a, b) => b.totalItems - a.totalItems));

      // Calculate time metrics
      const completedOrders = pickingOrders?.filter(
        o => o.picking_completed_at && o.packing_completed_at
      ) || [];

      const pickingTimes = completedOrders
        .filter(o => o.picking_started_at && o.picking_completed_at)
        .map(o => 
          differenceInMinutes(
            parseISO(o.picking_completed_at!),
            parseISO(o.picking_started_at!)
          )
        );

      const packingTimes = completedOrders
        .filter(o => o.packing_started_at && o.packing_completed_at)
        .map(o => 
          differenceInMinutes(
            parseISO(o.packing_completed_at!),
            parseISO(o.packing_started_at!)
          )
        );

      setTimeMetrics({
        avgPickingTime: pickingTimes.length > 0 
          ? pickingTimes.reduce((a, b) => a + b, 0) / pickingTimes.length 
          : 0,
        avgPackingTime: packingTimes.length > 0 
          ? packingTimes.reduce((a, b) => a + b, 0) / packingTimes.length 
          : 0,
        avgTotalTime: pickingTimes.length > 0 && packingTimes.length > 0
          ? (pickingTimes.reduce((a, b) => a + b, 0) + packingTimes.reduce((a, b) => a + b, 0)) / completedOrders.length
          : 0,
        minPickingTime: pickingTimes.length > 0 ? Math.min(...pickingTimes) : 0,
        maxPickingTime: pickingTimes.length > 0 ? Math.max(...pickingTimes) : 0,
      });

      // Calculate daily volume
      const dailyMap = new Map<string, DailyVolume>();
      const days = parseInt(period);
      
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), "yyyy-MM-dd");
        dailyMap.set(date, { date, receiving: 0, picking: 0, shipping: 0 });
      }

      receivingOrders?.forEach(order => {
        const date = format(parseISO(order.created_at), "yyyy-MM-dd");
        if (dailyMap.has(date)) {
          dailyMap.get(date)!.receiving++;
        }
      });

      pickingOrders?.forEach(order => {
        if (order.status === "packed" || order.status === "ready") {
          const date = format(parseISO(order.created_at), "yyyy-MM-dd");
          if (dailyMap.has(date)) {
            dailyMap.get(date)!.picking++;
          }
        }
      });

      shipments?.forEach(shipment => {
        if (shipment.status === "shipped" || shipment.status === "delivered") {
          const date = format(parseISO(shipment.created_at), "yyyy-MM-dd");
          if (dailyMap.has(date)) {
            dailyMap.get(date)!.shipping++;
          }
        }
      });

      setDailyVolume(
        Array.from(dailyMap.values()).map(d => ({
          ...d,
          date: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
        }))
      );

      // Calculate summary stats
      const totalItems = pickingItems?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
      const discrepancies = pickingItems?.filter(i => i.picked_quantity !== i.quantity).length || 0;

      setSummaryStats({
        totalOrders: pickingOrders?.length || 0,
        completedOrders: completedOrders.length,
        totalItems,
        avgItemsPerOrder: pickingOrders?.length ? totalItems / pickingOrders.length : 0,
        discrepancyRate: pickingItems?.length 
          ? (discrepancies / pickingItems.length) * 100 
          : 0,
      });

    } catch (error) {
      toast({
        title: "Erro ao carregar relatórios",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}min`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-muted-foreground">
              Métricas de performance operacional
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando relatórios...
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Ordens</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryStats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    {summaryStats.completedOrders} concluídas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Itens Processados</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryStats.totalItems}</div>
                  <p className="text-xs text-muted-foreground">
                    ~{summaryStats.avgItemsPerOrder.toFixed(1)} por ordem
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tempo Médio Picking</CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatTime(timeMetrics.avgPickingTime)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Min: {formatTime(timeMetrics.minPickingTime)} / Max: {formatTime(timeMetrics.maxPickingTime)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tempo Médio Packing</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatTime(timeMetrics.avgPackingTime)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa Divergência</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {summaryStats.discrepancyRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Itens com diferença
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Volume Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Volume Diário
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyVolume}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="receiving" 
                          name="Recebimentos"
                          stroke="hsl(var(--chart-1))" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="picking" 
                          name="Separações"
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="shipping" 
                          name="Envios"
                          stroke="hsl(var(--chart-3))" 
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Operator Performance Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Itens por Operador
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {operatorStats.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={operatorStats.slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fontSize: 12 }}
                            width={100}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))',
                              border: '1px solid hsl(var(--border))'
                            }}
                          />
                          <Bar 
                            dataKey="totalItems" 
                            name="Itens"
                            fill="hsl(var(--primary))" 
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        Sem dados de operadores
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Operator Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Produtividade por Operador
                </CardTitle>
              </CardHeader>
              <CardContent>
                {operatorStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado de operador disponível
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-center">Separações</TableHead>
                        <TableHead className="text-center">Embalagens</TableHead>
                        <TableHead className="text-center">Total Itens</TableHead>
                        <TableHead className="text-center">Tempo Médio Picking</TableHead>
                        <TableHead className="text-center">Tempo Médio Packing</TableHead>
                        <TableHead className="text-center">Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operatorStats.map((operator, index) => {
                        const avgTime = (operator.avgPickingTime + operator.avgPackingTime) / 2;
                        const performance = avgTime > 0 
                          ? operator.totalItems / avgTime 
                          : 0;
                        
                        return (
                          <TableRow key={operator.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{operator.name}</p>
                                <p className="text-xs text-muted-foreground">{operator.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {operator.pickingOrders}
                            </TableCell>
                            <TableCell className="text-center">
                              {operator.packingOrders}
                            </TableCell>
                            <TableCell className="text-center font-medium">
                              {operator.totalItems}
                            </TableCell>
                            <TableCell className="text-center">
                              {formatTime(operator.avgPickingTime)}
                            </TableCell>
                            <TableCell className="text-center">
                              {formatTime(operator.avgPackingTime)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={
                                  index === 0 ? "default" : 
                                  index < 3 ? "secondary" : "outline"
                                }
                              >
                                {performance.toFixed(1)} itens/min
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
