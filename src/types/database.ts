// Tipos customizados para o sistema de fulfillment

export type AppRole = 'admin' | 'client' | 'employee';

export type ShipmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type ReceivingStatus = 'pending' | 'inspecting' | 'completed' | 'cancelled';

export type PickingStatus = 'pending' | 'picking' | 'picked' | 'packing' | 'packed' | 'ready';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export type BillingType = 'fixed' | 'per_unit' | 'combined';

export interface Client {
  id: string;
  profile_id: string;
  company_name: string;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  total_space_m3: number;
  handling_fee_per_item: number;
  billing_type: BillingType;
  fixed_storage_fee: number;
  storage_fee_per_m3: number;
  created_at: string;
  updated_at: string;
  // Joined data
  profile?: Profile;
}

export interface ClientEmployee {
  id: string;
  client_id: string;
  profile_id: string;
  is_active: boolean;
  created_at: string;
  // Joined data
  profile?: Profile;
  client?: Client;
}

export interface Product {
  id: string;
  client_id: string;
  sku: string;
  name: string;
  description: string | null;
  height_cm: number;
  width_cm: number;
  depth_cm: number;
  weight_kg: number;
  quantity: number;
  min_stock_alert: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  volume_m3?: number;
  // Joined data
  client?: Client;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'entry' | 'exit';
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined data
  product?: Product;
}

export interface ShipmentRequest {
  id: string;
  client_id: string;
  status: ShipmentStatus;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_address: string;
  recipient_city: string;
  recipient_state: string;
  recipient_postal_code: string;
  shipping_label_url: string | null;
  invoice_url: string | null;
  tracking_code: string | null;
  notes: string | null;
  handling_total: number;
  created_by: string;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client;
  items?: ShipmentItem[];
}

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  product_id: string;
  quantity: number;
  // Joined data
  product?: Product;
}

// Dashboard stats
export interface DashboardStats {
  totalProducts: number;
  totalClients: number;
  totalSpaceM3: number;
  pendingShipments: number;
  processedShipments: number;
  lowStockProducts: number;
  recentMovements: StockMovement[];
  monthlyEntries: number;
  monthlyExits: number;
}

// Form types
export interface ProductFormData {
  sku: string;
  name: string;
  description?: string;
  height_cm: number;
  width_cm: number;
  depth_cm: number;
  weight_kg?: number;
  quantity: number;
  min_stock_alert?: number;
}

export interface ClientFormData {
  company_name: string;
  cnpj?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  user_email: string;
  user_full_name: string;
  user_phone?: string;
}

export interface ShipmentFormData {
  recipient_name: string;
  recipient_phone?: string;
  recipient_email?: string;
  recipient_address: string;
  recipient_city: string;
  recipient_state: string;
  recipient_postal_code: string;
  notes?: string;
  items: { product_id: string; quantity: number }[];
}

export interface StockEntryFormData {
  product_id: string;
  quantity: number;
  notes?: string;
}

// Warehouse locations
export interface WarehouseLocation {
  id: string;
  aisle: string;
  shelf: string;
  bin: string;
  description: string | null;
  max_capacity_m3: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductLocation {
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: Product;
  location?: WarehouseLocation;
}

export interface WarehouseLocationFormData {
  aisle: string;
  shelf: string;
  bin: string;
  description?: string;
  max_capacity_m3?: number;
}

// Receiving orders
export interface ReceivingOrder {
  id: string;
  client_id: string;
  invoice_number: string | null;
  invoice_url: string | null;
  supplier_name: string | null;
  expected_date: string | null;
  received_date: string | null;
  status: ReceivingStatus;
  notes: string | null;
  created_by: string;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  client?: Client;
  items?: ReceivingItem[];
}

export interface ReceivingItem {
  id: string;
  receiving_id: string;
  product_id: string;
  expected_quantity: number;
  received_quantity: number | null;
  has_damage: boolean;
  damage_notes: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: Product;
  location?: WarehouseLocation;
}

export interface ReceivingOrderFormData {
  invoice_number?: string;
  supplier_name?: string;
  expected_date?: string;
  notes?: string;
  items: { product_id: string; expected_quantity: number }[];
}

// Picking orders
export interface PickingOrder {
  id: string;
  shipment_id: string;
  status: PickingStatus;
  picker_id: string | null;
  packer_id: string | null;
  picking_started_at: string | null;
  picking_completed_at: string | null;
  packing_started_at: string | null;
  packing_completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  shipment?: ShipmentRequest;
  items?: PickingItem[];
}

export interface PickingItem {
  id: string;
  picking_order_id: string;
  shipment_item_id: string;
  product_id: string;
  location_id: string | null;
  quantity: number;
  picked_quantity: number;
  picked_at: string | null;
  picked_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  product?: Product;
  location?: WarehouseLocation;
}