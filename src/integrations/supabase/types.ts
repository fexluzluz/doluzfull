export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_employees: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean | null
          profile_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          profile_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_employees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          billing_type: string | null
          city: string | null
          cnpj: string | null
          company_name: string
          created_at: string
          fixed_storage_fee: number | null
          handling_fee_per_item: number | null
          id: string
          postal_code: string | null
          profile_id: string
          state: string | null
          storage_fee_per_m3: number | null
          total_space_m3: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_type?: string | null
          city?: string | null
          cnpj?: string | null
          company_name: string
          created_at?: string
          fixed_storage_fee?: number | null
          handling_fee_per_item?: number | null
          id?: string
          postal_code?: string | null
          profile_id: string
          state?: string | null
          storage_fee_per_m3?: number | null
          total_space_m3?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_type?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string
          created_at?: string
          fixed_storage_fee?: number | null
          handling_fee_per_item?: number | null
          id?: string
          postal_code?: string | null
          profile_id?: string
          state?: string | null
          storage_fee_per_m3?: number | null
          total_space_m3?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_access_permissions: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      picking_items: {
        Row: {
          created_at: string
          id: string
          location_id: string | null
          picked_at: string | null
          picked_by: string | null
          picked_quantity: number | null
          picking_order_id: string
          product_id: string
          quantity: number
          shipment_item_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picked_quantity?: number | null
          picking_order_id: string
          product_id: string
          quantity: number
          shipment_item_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picked_quantity?: number | null
          picking_order_id?: string
          product_id?: string
          quantity?: number
          shipment_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_picking_order_id_fkey"
            columns: ["picking_order_id"]
            isOneToOne: false
            referencedRelation: "picking_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picking_items_shipment_item_id_fkey"
            columns: ["shipment_item_id"]
            isOneToOne: false
            referencedRelation: "shipment_items"
            referencedColumns: ["id"]
          },
        ]
      }
      picking_orders: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          packer_id: string | null
          packing_completed_at: string | null
          packing_started_at: string | null
          picker_id: string | null
          picking_completed_at: string | null
          picking_started_at: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["picking_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          packer_id?: string | null
          packing_completed_at?: string | null
          packing_started_at?: string | null
          picker_id?: string | null
          picking_completed_at?: string | null
          picking_started_at?: string | null
          shipment_id: string
          status?: Database["public"]["Enums"]["picking_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          packer_id?: string | null
          packing_completed_at?: string | null
          packing_started_at?: string | null
          picker_id?: string | null
          picking_completed_at?: string | null
          picking_started_at?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["picking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "picking_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      product_locations: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          location_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          location_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          location_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_locations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          client_id: string
          created_at: string
          depth_cm: number
          description: string | null
          height_cm: number
          id: string
          image_url: string | null
          min_stock_alert: number | null
          name: string
          quantity: number
          sku: string
          updated_at: string
          weight_kg: number | null
          width_cm: number
        }
        Insert: {
          client_id: string
          created_at?: string
          depth_cm?: number
          description?: string | null
          height_cm?: number
          id?: string
          image_url?: string | null
          min_stock_alert?: number | null
          name: string
          quantity?: number
          sku: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          depth_cm?: number
          description?: string | null
          height_cm?: number
          id?: string
          image_url?: string | null
          min_stock_alert?: number | null
          name?: string
          quantity?: number
          sku?: string
          updated_at?: string
          weight_kg?: number | null
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receiving_items: {
        Row: {
          created_at: string
          damage_notes: string | null
          expected_quantity: number
          has_damage: boolean | null
          id: string
          location_id: string | null
          product_id: string
          received_quantity: number | null
          receiving_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          damage_notes?: string | null
          expected_quantity?: number
          has_damage?: boolean | null
          id?: string
          location_id?: string | null
          product_id: string
          received_quantity?: number | null
          receiving_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          damage_notes?: string | null
          expected_quantity?: number
          has_damage?: boolean | null
          id?: string
          location_id?: string | null
          product_id?: string
          received_quantity?: number | null
          receiving_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receiving_items_receiving_id_fkey"
            columns: ["receiving_id"]
            isOneToOne: false
            referencedRelation: "receiving_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      receiving_orders: {
        Row: {
          client_id: string
          completed_by: string | null
          created_at: string
          created_by: string
          expected_date: string | null
          id: string
          invoice_number: string | null
          invoice_url: string | null
          notes: string | null
          received_date: string | null
          status: Database["public"]["Enums"]["receiving_status"]
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_by?: string | null
          created_at?: string
          created_by: string
          expected_date?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          notes?: string | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["receiving_status"]
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_by?: string | null
          created_at?: string
          created_by?: string
          expected_date?: string | null
          id?: string
          invoice_number?: string | null
          invoice_url?: string | null
          notes?: string | null
          received_date?: string | null
          status?: Database["public"]["Enums"]["receiving_status"]
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receiving_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          id: string
          product_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity: number
          shipment_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_requests: {
        Row: {
          client_id: string
          created_at: string
          created_by: string
          handling_total: number | null
          id: string
          invoice_url: string | null
          notes: string | null
          processed_by: string | null
          recipient_address: string
          recipient_city: string
          recipient_email: string | null
          recipient_name: string
          recipient_phone: string | null
          recipient_postal_code: string
          recipient_state: string
          shipping_label_url: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by: string
          handling_total?: number | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          processed_by?: string | null
          recipient_address: string
          recipient_city: string
          recipient_email?: string | null
          recipient_name: string
          recipient_phone?: string | null
          recipient_postal_code: string
          recipient_state: string
          shipping_label_url?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string
          handling_total?: number | null
          id?: string
          invoice_url?: string | null
          notes?: string | null
          processed_by?: string | null
          recipient_address?: string
          recipient_city?: string
          recipient_email?: string | null
          recipient_name?: string
          recipient_phone?: string | null
          recipient_postal_code?: string
          recipient_state?: string
          shipping_label_url?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          movement_type: string
          new_quantity: number
          notes: string | null
          previous_quantity: number
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          movement_type: string
          new_quantity: number
          notes?: string | null
          previous_quantity: number
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: string
          new_quantity?: number
          notes?: string | null
          previous_quantity?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action_type: string
          client_id: string | null
          created_at: string
          description: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          performed_by: string
          performed_by_name: string | null
        }
        Insert: {
          action_type: string
          client_id?: string | null
          created_at?: string
          description: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          performed_by: string
          performed_by_name?: string | null
        }
        Update: {
          action_type?: string
          client_id?: string | null
          created_at?: string
          description?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          performed_by?: string
          performed_by_name?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouse_locations: {
        Row: {
          aisle: string
          bin: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          max_capacity_m3: number | null
          shelf: string
          updated_at: string
        }
        Insert: {
          aisle: string
          bin: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_capacity_m3?: number | null
          shelf: string
          updated_at?: string
        }
        Update: {
          aisle?: string
          bin?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_capacity_m3?: number | null
          shelf?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_product_m3: {
        Args: { depth_cm: number; height_cm: number; width_cm: number }
        Returns: number
      }
      get_user_client_id: { Args: { _user_id: string }; Returns: string }
      has_log_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_log_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "client" | "employee"
      picking_status:
        | "pending"
        | "picking"
        | "picked"
        | "packing"
        | "packed"
        | "ready"
      receiving_status: "pending" | "inspecting" | "completed" | "cancelled"
      shipment_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client", "employee"],
      picking_status: [
        "pending",
        "picking",
        "picked",
        "packing",
        "packed",
        "ready",
      ],
      receiving_status: ["pending", "inspecting", "completed", "cancelled"],
      shipment_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
