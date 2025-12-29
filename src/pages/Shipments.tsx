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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Truck, Eye, Edit, Upload, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDateTime, translateShipmentStatus } from '@/lib/utils';
import ShipmentForm from '@/components/shipments/ShipmentForm';
import ShipmentDetailsDialog from '@/components/shipments/ShipmentDetailsDialog';
import ShipmentStatusDialog from '@/components/shipments/ShipmentStatusDialog';
import ShipmentUploadDialog from '@/components/shipments/ShipmentUploadDialog';

interface Shipment {
  id: string;
  client_id: string;
  status: string;
  recipient_name: string;
  recipient_city: string;
  recipient_state: string;
  tracking_code: string | null;
  shipping_label_url: string | null;
  invoice_url: string | null;
  created_at: string;
  clients: {
    company_name: string;
  } | null;
}

interface Client {
  id: string;
  company_name: string;
}

export default function Shipments() {
  const { isAdmin, clientId } = useAuth();
  const { toast } = useToast();
  const { logAction } = useSystemLog();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null);
  const [editingStatus, setEditingStatus] = useState<Shipment | null>(null);
  const [uploadingShipment, setUploadingShipment] = useState<Shipment | null>(null);
  const [cancellingShipment, setCancellingShipment] = useState<Shipment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchShipments = async () => {
    try {
      const { data, error } = await supabase
        .from('shipment_requests')
        .select('*, clients(company_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShipments(data || []);
    } catch (error) {
      console.error('Error fetching shipments:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar envios',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!isAdmin) return;
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  useEffect(() => {
    fetchShipments();
    fetchClients();
  }, [isAdmin]);

  const handleCancelShipment = async () => {
    if (!cancellingShipment) return;
    
    setIsCancelling(true);
    try {
      // Fetch shipment items to revert stock
      const { data: items, error: itemsError } = await supabase
        .from('shipment_items')
        .select('product_id, quantity')
        .eq('shipment_id', cancellingShipment.id);

      if (itemsError) throw itemsError;

      // Revert stock for each item
      for (const item of items || []) {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (productError) throw productError;

        const newQuantity = product.quantity + item.quantity;

        await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', item.product_id);

        // Create stock movement entry
        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          movement_type: 'entry',
          quantity: item.quantity,
          previous_quantity: product.quantity,
          new_quantity: newQuantity,
          notes: `Estorno por cancelamento do envio #${cancellingShipment.id.slice(0, 8)}`,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
      }

      // Update shipment status to cancelled and reset handling_total
      const { error: updateError } = await supabase
        .from('shipment_requests')
        .update({ status: 'cancelled', handling_total: 0 })
        .eq('id', cancellingShipment.id);

      if (updateError) throw updateError;

      await logAction({
        action_type: 'shipment_cancelled',
        entity_type: 'shipment',
        entity_id: cancellingShipment.id,
        description: `Pedido de ${cancellingShipment.recipient_name} cancelado via botão rápido (estoque estornado, manuseio zerado)`,
        details: { 
          recipient: cancellingShipment.recipient_name,
          items_returned: items?.length || 0,
        },
        client_id: cancellingShipment.client_id,
      });

      toast({
        title: 'Pedido cancelado',
        description: 'O estoque foi estornado e o valor de manuseio zerado.',
      });

      fetchShipments();
    } catch (error) {
      console.error('Error cancelling shipment:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar pedido',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsCancelling(false);
      setCancellingShipment(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'processing':
        return 'status-processing';
      case 'shipped':
        return 'status-shipped';
      case 'delivered':
        return 'status-delivered';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  const filteredShipments = shipments.filter((s) => {
    const matchesSearch =
      s.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.tracking_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesClient = clientFilter === 'all' || s.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Envios</h1>
            <p className="page-description">Gerencie requisições de envio</p>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Requisição
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Requisição de Envio</DialogTitle>
              </DialogHeader>
              <ShipmentForm
                onSuccess={() => {
                  setIsFormOpen(false);
                  fetchShipments();
                }}
                onCancel={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por destinatário, rastreio ou cliente..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {isAdmin && clients.length > 0 && (
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filtrar por empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === 'all' ? 'Todos' : translateShipmentStatus(status)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Requisições de Envio ({filteredShipments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando envios...
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || statusFilter !== 'all' 
                ? 'Nenhum envio encontrado com os filtros aplicados.' 
                : 'Nenhuma requisição de envio.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Arquivos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow key={shipment.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(shipment.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {shipment.clients?.company_name || '-'}
                      </TableCell>
                      <TableCell className="font-medium">{shipment.recipient_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {shipment.recipient_city}/{shipment.recipient_state}
                      </TableCell>
                      <TableCell>
                        <Badge className={`status-badge ${getStatusBadgeClass(shipment.status)}`}>
                          {translateShipmentStatus(shipment.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {shipment.tracking_code ? (
                          <span className="font-mono text-sm">{shipment.tracking_code}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {shipment.shipping_label_url && (
                            <a
                              href={shipment.shipping_label_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs"
                            >
                              Etiqueta
                            </a>
                          )}
                          {shipment.invoice_url && (
                            <a
                              href={shipment.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs"
                            >
                              NF
                            </a>
                          )}
                          {!shipment.shipping_label_url && !shipment.invoice_url && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingShipment(shipment)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setUploadingShipment(shipment)}
                            title="Upload de arquivos"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          {isAdmin && shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingStatus(shipment)}
                              title="Alterar status"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setCancellingShipment(shipment)}
                              title="Cancelar pedido"
                              className="text-destructive hover:text-destructive"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <ShipmentDetailsDialog
        shipment={viewingShipment}
        onClose={() => setViewingShipment(null)}
      />

      {/* Status Dialog */}
      <ShipmentStatusDialog
        shipment={editingStatus}
        onClose={() => setEditingStatus(null)}
        onSuccess={() => {
          setEditingStatus(null);
          fetchShipments();
        }}
      />

      {/* Upload Dialog */}
      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancellingShipment} onOpenChange={(open) => !open && setCancellingShipment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá cancelar o pedido de {cancellingShipment?.recipient_name}. 
              O estoque será estornado e o valor de manuseio zerado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelShipment}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShipmentUploadDialog
        shipment={uploadingShipment}
        onClose={() => setUploadingShipment(null)}
        onSuccess={() => {
          setUploadingShipment(null);
          fetchShipments();
        }}
      />
    </DashboardLayout>
  );
}