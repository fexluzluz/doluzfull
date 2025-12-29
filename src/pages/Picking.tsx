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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PickingOrder, PickingStatus, ShipmentRequest } from "@/types/database";
import { PickingDialog } from "@/components/picking/PickingDialog";
import { PackingDialog } from "@/components/picking/PackingDialog";
import {
  Search,
  Package,
  Clock,
  CheckCircle2,
  Box,
  ClipboardList,
  Play,
  PackageCheck,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<PickingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  picking: { label: "Separando", variant: "default", icon: ClipboardList },
  picked: { label: "Separado", variant: "outline", icon: CheckCircle2 },
  packing: { label: "Embalando", variant: "default", icon: Box },
  packed: { label: "Embalado", variant: "outline", icon: Package },
  ready: { label: "Pronto", variant: "default", icon: PackageCheck },
};

interface PickingOrderWithShipment extends PickingOrder {
  shipment?: ShipmentRequest & { clients?: { company_name: string } };
}

export default function Picking() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<PickingOrderWithShipment[]>([]);
  const [pendingShipments, setPendingShipments] = useState<ShipmentRequest[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PickingOrderWithShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pickingOrder, setPickingOrder] = useState<PickingOrder | null>(null);
  const [packingOrder, setPackingOrder] = useState<PickingOrder | null>(null);
  const [stats, setStats] = useState({
    pending: 0,
    picking: 0,
    picked: 0,
    packing: 0,
    packed: 0,
  });

  useEffect(() => {
    fetchOrders();
    fetchPendingShipments();
  }, []);

  useEffect(() => {
    let filtered = orders;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        o =>
          o.shipment?.recipient_name?.toLowerCase().includes(search) ||
          (o.shipment as any)?.clients?.company_name?.toLowerCase().includes(search)
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
        .from("picking_orders")
        .select(`
          *,
          shipment_requests (
            *,
            clients (company_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const ordersData = data.map(o => ({
        ...o,
        shipment: o.shipment_requests,
      })) as PickingOrderWithShipment[];

      setOrders(ordersData);

      // Calculate stats
      setStats({
        pending: ordersData.filter(o => o.status === "pending").length,
        picking: ordersData.filter(o => o.status === "picking").length,
        picked: ordersData.filter(o => o.status === "picked").length,
        packing: ordersData.filter(o => o.status === "packing").length,
        packed: ordersData.filter(o => o.status === "packed").length,
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar ordens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPendingShipments = async () => {
    // Get shipments that don't have a picking order yet
    const { data: existingPickingShipments } = await supabase
      .from("picking_orders")
      .select("shipment_id");

    const existingIds = existingPickingShipments?.map(p => p.shipment_id) || [];

    const { data, error } = await supabase
      .from("shipment_requests")
      .select(`
        *,
        clients (company_name)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPendingShipments(
        data.filter(s => !existingIds.includes(s.id)) as ShipmentRequest[]
      );
    }
  };

  const handleCreatePickingOrder = async (shipmentId: string) => {
    try {
      // Get shipment items
      const { data: shipmentItems, error: itemsError } = await supabase
        .from("shipment_items")
        .select("*, products(*)")
        .eq("shipment_id", shipmentId);

      if (itemsError) throw itemsError;

      // Create picking order
      const { data: pickingOrder, error: orderError } = await supabase
        .from("picking_orders")
        .insert([{ shipment_id: shipmentId }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Get product locations for each item
      const pickingItems = [];
      for (const item of shipmentItems || []) {
        // Find primary location for the product
        const { data: locations } = await supabase
          .from("product_locations")
          .select("location_id")
          .eq("product_id", item.product_id)
          .eq("is_primary", true)
          .maybeSingle();

        pickingItems.push({
          picking_order_id: pickingOrder.id,
          shipment_item_id: item.id,
          product_id: item.product_id,
          location_id: locations?.location_id || null,
          quantity: item.quantity,
        });
      }

      // Create picking items
      const { error: pickingItemsError } = await supabase
        .from("picking_items")
        .insert(pickingItems);

      if (pickingItemsError) throw pickingItemsError;

      toast({ title: "Ordem de separação criada!" });
      fetchOrders();
      fetchPendingShipments();
    } catch (error) {
      toast({
        title: "Erro ao criar ordem",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleAction = (order: PickingOrderWithShipment) => {
    if (order.status === "pending" || order.status === "picking") {
      setPickingOrder(order);
    } else if (order.status === "picked" || order.status === "packing") {
      setPackingOrder(order);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM HH:mm", { locale: ptBR });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Picking & Packing</h1>
          <p className="text-muted-foreground">
            Gerencie a separação e embalagem dos pedidos
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
              <CardTitle className="text-sm font-medium">Separando</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.picking}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Separados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.picked}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Embalando</CardTitle>
              <Box className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.packing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prontos</CardTitle>
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.packed}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Ordens de Separação</TabsTrigger>
            <TabsTrigger value="pending">
              Pedidos Aguardando ({pendingShipments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
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
                  <SelectItem value="picking">Separando</SelectItem>
                  <SelectItem value="picked">Separados</SelectItem>
                  <SelectItem value="packing">Embalando</SelectItem>
                  <SelectItem value="packed">Embalados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Orders Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    {isAdmin && <TableHead>Cliente</TableHead>}
                    <TableHead>Criado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Nenhuma ordem encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map(order => {
                      const status = statusConfig[order.status];
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">
                            {order.shipment?.recipient_name}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-muted-foreground">
                              {(order.shipment as any)?.clients?.company_name || "-"}
                            </TableCell>
                          )}
                          <TableCell>{formatDate(order.created_at)}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {order.status !== "packed" && order.status !== "ready" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(order)}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                {order.status === "pending" || order.status === "picking"
                                  ? "Separar"
                                  : "Embalar"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pedidos pendentes que ainda não possuem ordem de separação
            </p>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    {isAdmin && <TableHead>Cliente</TableHead>}
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingShipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        Nenhum pedido aguardando separação
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingShipments.map(shipment => (
                      <TableRow key={shipment.id}>
                        <TableCell className="font-medium">
                          {shipment.recipient_name}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-muted-foreground">
                            {(shipment as any).clients?.company_name || "-"}
                          </TableCell>
                        )}
                        <TableCell>{formatDate(shipment.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleCreatePickingOrder(shipment.id)}
                          >
                            <ClipboardList className="h-4 w-4 mr-1" />
                            Criar Ordem
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Picking Dialog */}
      {pickingOrder && (
        <PickingDialog
          open={!!pickingOrder}
          onOpenChange={() => setPickingOrder(null)}
          order={pickingOrder}
          onSuccess={fetchOrders}
        />
      )}

      {/* Packing Dialog */}
      {packingOrder && (
        <PackingDialog
          open={!!packingOrder}
          onOpenChange={() => setPackingOrder(null)}
          order={packingOrder}
          onSuccess={fetchOrders}
        />
      )}
    </DashboardLayout>
  );
}
