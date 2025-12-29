// Tipos customizados para o sistema de fulfillment

export type AppRole = 'admin' | 'client' | 'employee';

export type ShipmentStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

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