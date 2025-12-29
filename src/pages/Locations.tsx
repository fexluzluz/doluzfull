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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { WarehouseLocation } from "@/types/database";
import { LocationForm } from "@/components/locations/LocationForm";
import { ProductLocationDialog } from "@/components/locations/ProductLocationDialog";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  MapPin,
  Grid3X3,
  Layers,
} from "lucide-react";

export default function Locations() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<WarehouseLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocation | null>(null);
  const [productLocationOpen, setProductLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocation | null>(null);
  const [stats, setStats] = useState({
    totalLocations: 0,
    totalAisles: 0,
    totalShelves: 0,
    activeLocations: 0,
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  useEffect(() => {
    const filtered = locations.filter(loc => {
      const searchLower = searchTerm.toLowerCase();
      const code = `${loc.aisle}-${loc.shelf}-${loc.bin}`.toLowerCase();
      return (
        code.includes(searchLower) ||
        loc.description?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredLocations(filtered);
  }, [locations, searchTerm]);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("warehouse_locations")
        .select("*")
        .order("aisle")
        .order("shelf")
        .order("bin");

      if (error) throw error;

      const locs = data as WarehouseLocation[];
      setLocations(locs);

      // Calculate stats
      const uniqueAisles = new Set(locs.map(l => l.aisle));
      const uniqueShelves = new Set(locs.map(l => `${l.aisle}-${l.shelf}`));
      setStats({
        totalLocations: locs.length,
        totalAisles: uniqueAisles.size,
        totalShelves: uniqueShelves.size,
        activeLocations: locs.filter(l => l.is_active).length,
      });
    } catch (error) {
      toast({
        title: "Erro ao carregar localizações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (location: WarehouseLocation) => {
    setEditingLocation(location);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingLocation) return;

    try {
      const { error } = await supabase
        .from("warehouse_locations")
        .delete()
        .eq("id", deletingLocation.id);

      if (error) throw error;

      toast({ title: "Localização excluída com sucesso!" });
      fetchLocations();
    } catch (error) {
      toast({
        title: "Erro ao excluir localização",
        description: "Verifique se não há produtos nesta localização",
        variant: "destructive",
      });
    } finally {
      setDeletingLocation(null);
    }
  };

  const handleManageProducts = (location: WarehouseLocation) => {
    setSelectedLocation(location);
    setProductLocationOpen(true);
  };

  const handleFormSuccess = () => {
    setIsFormOpen(false);
    setEditingLocation(null);
    fetchLocations();
  };

  const getLocationCode = (loc: WarehouseLocation) =>
    `${loc.aisle}-${loc.shelf}-${loc.bin}`;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Localizações</h1>
            <p className="text-muted-foreground">
              Gerencie os endereços físicos do armazém
            </p>
          </div>
          {isAdmin && (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Localização
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLocations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ruas</CardTitle>
              <Grid3X3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAisles}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prateleiras</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalShelves}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativas</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeLocations}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou descrição..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Rua</TableHead>
                <TableHead>Prateleira</TableHead>
                <TableHead>Bin</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Capacidade (m³)</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredLocations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Nenhuma localização encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredLocations.map(location => (
                  <TableRow key={location.id}>
                    <TableCell className="font-mono font-medium">
                      {getLocationCode(location)}
                    </TableCell>
                    <TableCell>{location.aisle}</TableCell>
                    <TableCell>{location.shelf}</TableCell>
                    <TableCell>{location.bin}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {location.description || "-"}
                    </TableCell>
                    <TableCell>{location.max_capacity_m3?.toFixed(2) || "0.00"}</TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? "default" : "secondary"}>
                        {location.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleManageProducts(location)}
                            title="Gerenciar produtos"
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(location)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingLocation(location)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? "Editar Localização" : "Nova Localização"}
            </DialogTitle>
          </DialogHeader>
          <LocationForm
            location={editingLocation || undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingLocation(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingLocation}
        onOpenChange={() => setDeletingLocation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a localização{" "}
              <strong>
                {deletingLocation && getLocationCode(deletingLocation)}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Product Location Dialog */}
      {selectedLocation && (
        <ProductLocationDialog
          open={productLocationOpen}
          onOpenChange={setProductLocationOpen}
          location={selectedLocation}
          onSuccess={fetchLocations}
        />
      )}
    </DashboardLayout>
  );
}
