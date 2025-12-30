import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ReceivingOrder, ReceivingStatus } from "@/types/database";
import { ReceivingForm } from "@/components/receiving/ReceivingForm";
import { ReceivingInspectionDialog } from "@/components/receiving/ReceivingInspectionDialog";
import { ReceivingDischargeDialog } from "@/components/receiving/ReceivingDischargeDialog";
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  FileText,
  Truck,
  LogOut,
  Timer,
  LogIn,
  PackageCheck,
  ArrowRightLeft,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<ReceivingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  inspecting: { label: "Em Conferência", variant: "default", icon: ClipboardCheck },
  awaiting_pickup: { label: "Aguardando Coleta", variant: "default", icon: PackageCheck },
  completed: { label: "Concluído", variant: "outline", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "destructive", icon: XCircle },
};

export default function Receiving() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ReceivingOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ReceivingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [inspectingOrder, setInspectingOrder] = useState<ReceivingOrder | null>(null);
  const [dischargingOrder, setDischargingOrder] = useState<ReceivingOrder | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inspecting: 0,
    awaiting_pickup: 0,
    completed: 0,
    temporary: 0,
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        o =>
          o.invoice_number?.toLowerCase().includes(search) ||
          o.supplier_name?.toLowerCase().includes(search)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(o => o.status === statusFilter);
    }

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("receiving_orders")
        .select(`
          *,
          clients (company_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const ordersData = data as ReceivingOrder[];
      setOrders(ordersData);

      // Calculate stats
      setStats({
        total: ordersData.length,
        pending: ordersData.filter(o => o.status === "pending").length,
        inspecting: ordersData.filter(o => o.status === "inspecting").length,
        awaiting_pickup: ordersData.filter(o => o.status === "awaiting_pickup").length,
        completed: ordersData.filter(o => o.status === "completed").length,
        temporary: ordersData.filter(o => (o as any).is_temporary && (o.status === "completed" || o.status === "awaiting_pickup") && !(o as any).discharged_at).length,
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar recebimentos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    fetchOrders();
  };

  const handleInspect = (order: ReceivingOrder) => {
    setInspectingOrder(order);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const getStorageDays = (order: any) => {
    if (!order.received_date) return 0;
    return Math.max(1, differenceInDays(new Date(), new Date(order.received_date)));
  };

  const handleToggleStatus = async (order: ReceivingOrder) => {
    const newStatus = order.status === "awaiting_pickup" ? "completed" : "awaiting_pickup";
    try {
      const { error } = await supabase
        .from("receiving_orders")
        .update({ status: newStatus })
        .eq("id", order.id);

      if (error) throw error;

      toast({
        title: newStatus === "awaiting_pickup" ? "Aguardando Coleta" : "Concluído",
        description: "Status atualizado com sucesso",
      });
      fetchOrders();
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Recebimento</h1>
            <p className="text-muted-foreground">
              Gerencie as ordens de recebimento de mercadorias
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Ordem
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em Conferência</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inspecting}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aguard. Coleta</CardTitle>
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.awaiting_pickup}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Temporários</CardTitle>
              <Timer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.temporary}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por NF ou fornecedor..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="inspecting">Em Conferência</SelectItem>
              <SelectItem value="awaiting_pickup">Aguardando Coleta</SelectItem>
              <SelectItem value="completed">Concluídos</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nota Fiscal</TableHead>
                <TableHead>Fornecedor</TableHead>
                {isAdmin && <TableHead>Cliente</TableHead>}
                <TableHead>Tipo</TableHead>
                <TableHead>Data Prevista</TableHead>
                <TableHead>Data Recebimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8">
                    Nenhuma ordem encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map(order => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;
                  const orderData = order as any;
                  const isTemporary = orderData.is_temporary;
                  const isDischarged = orderData.discharged_at;
                  const canDischarge = isTemporary && (order.status === "completed" || order.status === "awaiting_pickup") && !isDischarged;
                  
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">
                        {order.invoice_number || "-"}
                      </TableCell>
                      <TableCell>{order.supplier_name || "-"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-muted-foreground">
                          {orderData.clients?.company_name || "-"}
                        </TableCell>
                      )}
                      <TableCell>
                        {isTemporary ? (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="gap-1 w-fit">
                              <Timer className="h-3 w-3" />
                              Temporário
                            </Badge>
                            {orderData.temporary_volume_m3 > 0 && (
                              <span className="text-xs font-medium">
                                {orderData.temporary_volume_m3.toFixed(2)} m³
                              </span>
                            )}
                            {(order.status === "completed" || order.status === "awaiting_pickup") && !isDischarged && (
                              <Badge variant="default" className="gap-1 w-fit text-xs">
                                <LogIn className="h-3 w-3" />
                                Entrada - {getStorageDays(order)} dias
                              </Badge>
                            )}
                            {isDischarged && (
                              <Badge variant="outline" className="gap-1 w-fit text-xs">
                                <LogOut className="h-3 w-3" />
                                Saída
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            Definitivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(order.expected_date)}</TableCell>
                      <TableCell>{formatDate(order.received_date)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {order.invoice_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Ver Nota Fiscal"
                            >
                              <a
                                href={order.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {(order.status === "pending" || order.status === "inspecting") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleInspect(order)}
                              title="Conferir"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {(order.status === "awaiting_pickup" || order.status === "completed") && !isDischarged && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(order)}
                              title={order.status === "awaiting_pickup" ? "Marcar como Concluído" : "Aguardando Coleta"}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          )}
                          {canDischarge && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDischargingOrder(order)}
                              title="Registrar Saída"
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Recebimento</DialogTitle>
          </DialogHeader>
          <ReceivingForm
            onSuccess={handleFormSuccess}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Inspection Dialog */}
      {inspectingOrder && (
        <ReceivingInspectionDialog
          open={!!inspectingOrder}
          onOpenChange={() => setInspectingOrder(null)}
          order={inspectingOrder}
          onSuccess={fetchOrders}
        />
      )}

      {/* Discharge Dialog */}
      {dischargingOrder && (
        <ReceivingDischargeDialog
          open={!!dischargingOrder}
          onOpenChange={() => setDischargingOrder(null)}
          order={dischargingOrder}
          onSuccess={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
