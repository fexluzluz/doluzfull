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
import { Button } from "@/components/ui/button";
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
  DollarSign,
  Package,
  Box,
  Timer,
  Download,
  Building2,
  Truck,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatNumber } from "@/lib/utils";

interface ClientBilling {
  clientId: string;
  clientName: string;
  billingType: string;
  // Handling
  itemsShipped: number;
  handlingFeePerItem: number;
  handlingTotal: number;
  // Logistics
  logisticsTotal: number;
  // Regular storage
  spaceM3: number;
  storageFeePerM3: number;
  fixedStorageFee: number;
  storageTotal: number;
  // Temporary storage
  temporaryDays: number;
  temporaryVolumeM3: number;
  temporaryStorageTotal: number;
  // Total
  grandTotal: number;
}

interface SummaryStats {
  totalHandling: number;
  totalLogistics: number;
  totalStorage: number;
  totalTemporary: number;
  grandTotal: number;
  totalClients: number;
  totalItems: number;
}

export default function FinancialReport() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [clientBillings, setClientBillings] = useState<ClientBilling[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalHandling: 0,
    totalLogistics: 0,
    totalStorage: 0,
    totalTemporary: 0,
    grandTotal: 0,
    totalClients: 0,
    totalItems: 0,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    };
  });

  useEffect(() => {
    fetchBillingData();
  }, [selectedMonth]);

  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthStart = startOfMonth(new Date(year, month - 1));
      const monthEnd = endOfMonth(new Date(year, month - 1));

      // Fetch all clients
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("*, profiles(full_name)")
        .order("company_name");

      if (clientsError) throw clientsError;

      // Fetch shipment items for the month (for handling fees and logistics)
      const { data: shipments, error: shipmentsError } = await supabase
        .from("shipment_requests")
        .select(`
          id,
          client_id,
          created_at,
          logistics_cost,
          shipment_items(quantity)
        `)
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())
        .in("status", ["processing", "shipped", "delivered"]);

      if (shipmentsError) throw shipmentsError;

      // Fetch temporary receiving orders (for temporary storage)
      const { data: tempOrders, error: tempError } = await supabase
        .from("receiving_orders")
        .select("*")
        .eq("is_temporary", true)
        .or(`and(received_date.lte.${monthEnd.toISOString()},or(discharged_at.is.null,discharged_at.gte.${monthStart.toISOString()}))`);

      if (tempError) throw tempError;

      // Calculate billing for each client
      const billings: ClientBilling[] = [];

      for (const client of clients || []) {
        // Calculate items shipped and logistics cost this month
        const clientShipments = shipments?.filter(s => s.client_id === client.id) || [];
        const itemsShipped = clientShipments.reduce((sum, s) => {
          const items = s.shipment_items as any[];
          return sum + (items?.reduce((iSum, item) => iSum + (item.quantity || 0), 0) || 0);
        }, 0);
        
        // Sum logistics costs from all shipments
        const logisticsTotal = clientShipments.reduce((sum, s) => {
          return sum + (Number((s as any).logistics_cost) || 0);
        }, 0);

        const handlingFeePerItem = Number(client.handling_fee_per_item) || 4.5;
        const handlingTotal = itemsShipped * handlingFeePerItem;

        // Calculate storage fees
        const spaceM3 = Number(client.total_space_m3) || 0;
        const storageFeePerM3 = Number(client.storage_fee_per_m3) || 0;
        const fixedStorageFee = Number(client.fixed_storage_fee) || 0;
        
        let storageTotal = 0;
        if (client.billing_type === "fixed") {
          storageTotal = fixedStorageFee;
        } else if (client.billing_type === "per_unit") {
          storageTotal = spaceM3 * storageFeePerM3;
        } else {
          storageTotal = fixedStorageFee + (spaceM3 * storageFeePerM3);
        }

        // Calculate temporary storage
        const clientTempOrders = tempOrders?.filter(o => o.client_id === client.id) || [];
        let temporaryDays = 0;
        let temporaryVolumeM3 = 0;

        for (const order of clientTempOrders) {
          const receivedDate = order.received_date ? new Date(order.received_date) : null;
          const dischargedDate = order.discharged_at ? new Date(order.discharged_at) : null;
          const volume = Number(order.temporary_volume_m3) || 0;

          if (receivedDate) {
            const periodStart = receivedDate < monthStart ? monthStart : receivedDate;
            const periodEnd = dischargedDate && dischargedDate < monthEnd ? dischargedDate : monthEnd;
            
            if (periodStart <= periodEnd) {
              const days = Math.max(1, differenceInDays(periodEnd, periodStart) + 1);
              temporaryDays += days;
              temporaryVolumeM3 += volume;
            }
          }
        }

        // Temporary storage charged at same rate as regular storage per day
        const dailyRate = storageFeePerM3 / 30;
        const temporaryStorageTotal = temporaryVolumeM3 * dailyRate * temporaryDays;

        const grandTotal = handlingTotal + logisticsTotal + storageTotal + temporaryStorageTotal;

        if (grandTotal > 0 || itemsShipped > 0 || spaceM3 > 0) {
          billings.push({
            clientId: client.id,
            clientName: client.company_name,
            billingType: client.billing_type || "per_unit",
            itemsShipped,
            handlingFeePerItem,
            handlingTotal,
            logisticsTotal,
            spaceM3,
            storageFeePerM3,
            fixedStorageFee,
            storageTotal,
            temporaryDays,
            temporaryVolumeM3,
            temporaryStorageTotal,
            grandTotal,
          });
        }
      }

      setClientBillings(billings);

      // Calculate summary
      setSummary({
        totalHandling: billings.reduce((sum, b) => sum + b.handlingTotal, 0),
        totalLogistics: billings.reduce((sum, b) => sum + b.logisticsTotal, 0),
        totalStorage: billings.reduce((sum, b) => sum + b.storageTotal, 0),
        totalTemporary: billings.reduce((sum, b) => sum + b.temporaryStorageTotal, 0),
        grandTotal: billings.reduce((sum, b) => sum + b.grandTotal, 0),
        totalClients: billings.length,
        totalItems: billings.reduce((sum, b) => sum + b.itemsShipped, 0),
      });
    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast({
        title: "Erro ao carregar dados de faturamento",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExport = () => {
    const headers = [
      "Cliente",
      "Tipo Cobrança",
      "Itens Enviados",
      "Taxa/Item",
      "Total Manuseio",
      "Total Logística",
      "Espaço (m³)",
      "Taxa/m³",
      "Taxa Fixa",
      "Total Armazenagem",
      "Dias Temp.",
      "Volume Temp. (m³)",
      "Total Temporário",
      "Total Geral",
    ];

    const rows = clientBillings.map(b => [
      b.clientName,
      b.billingType,
      b.itemsShipped,
      b.handlingFeePerItem.toFixed(2),
      b.handlingTotal.toFixed(2),
      b.logisticsTotal.toFixed(2),
      b.spaceM3.toFixed(2),
      b.storageFeePerM3.toFixed(2),
      b.fixedStorageFee.toFixed(2),
      b.storageTotal.toFixed(2),
      b.temporaryDays,
      b.temporaryVolumeM3.toFixed(2),
      b.temporaryStorageTotal.toFixed(2),
      b.grandTotal.toFixed(2),
    ]);

    const csv = [
      headers.join(";"),
      ...rows.map(r => r.join(";")),
      "",
      `Total Manuseio;${summary.totalHandling.toFixed(2)}`,
      `Total Logística;${summary.totalLogistics.toFixed(2)}`,
      `Total Armazenagem;${summary.totalStorage.toFixed(2)}`,
      `Total Temporário;${summary.totalTemporary.toFixed(2)}`,
      `Total Geral;${summary.grandTotal.toFixed(2)}`,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `faturamento-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatório Financeiro</h1>
            <p className="text-muted-foreground">
              Faturamento mensal por cliente (manuseio + armazenagem)
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Manuseio</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalHandling)}</div>
              <p className="text-xs text-muted-foreground">{summary.totalItems} itens</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Logística</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalLogistics)}</div>
              <p className="text-xs text-muted-foreground">Frete cobrado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Armazenagem</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalStorage)}</div>
              <p className="text-xs text-muted-foreground">Estoque regular</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Temporário</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalTemporary)}</div>
              <p className="text-xs text-muted-foreground">Armazenagem temporária</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatCurrency(summary.grandTotal)}</div>
              <p className="text-xs text-muted-foreground">{summary.totalClients} clientes</p>
            </CardContent>
          </Card>
        </div>

        {/* Billing Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Detalhamento por Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead className="text-right">Manuseio</TableHead>
                    <TableHead className="text-right">Logística</TableHead>
                    <TableHead className="text-right">Espaço (m³)</TableHead>
                    <TableHead className="text-right">Armazenagem</TableHead>
                    <TableHead className="text-right">Temp. (dias)</TableHead>
                    <TableHead className="text-right">Temporário</TableHead>
                    <TableHead className="text-right font-semibold">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : clientBillings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        Nenhum dado de faturamento para o período
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientBillings.map(billing => (
                      <TableRow key={billing.clientId}>
                        <TableCell className="font-medium">{billing.clientName}</TableCell>
                        <TableCell className="text-right">{billing.itemsShipped}</TableCell>
                        <TableCell className="text-right">{formatCurrency(billing.handlingTotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(billing.logisticsTotal)}</TableCell>
                        <TableCell className="text-right">{formatNumber(billing.spaceM3, 2)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(billing.storageTotal)}</TableCell>
                        <TableCell className="text-right">{billing.temporaryDays}</TableCell>
                        <TableCell className="text-right">{formatCurrency(billing.temporaryStorageTotal)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(billing.grandTotal)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
