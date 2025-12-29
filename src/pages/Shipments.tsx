import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Truck, Eye, Edit, FileText, Upload } from 'lucide-react';
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

export default function Shipments() {
  const { isAdmin, clientId } = useAuth();
  const { toast } = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null);
  const [editingStatus, setEditingStatus] = useState<Shipment | null>(null);
  const [uploadingShipment, setUploadingShipment] = useState<Shipment | null>(null);

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

  useEffect(() => {
    fetchShipments();
  }, []);

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
    return matchesSearch && matchesStatus;
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
                    {isAdmin && <TableHead>Cliente</TableHead>}
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
                      {isAdmin && (
                        <TableCell className="font-medium">
                          {shipment.clients?.company_name || '-'}
                        </TableCell>
                      )}
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