export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CAJERO'

export interface Profile {
  id: string
  full_name: string
  phone?: string
  role: UserRole
  is_active: boolean
  avatar_url?: string
  permissions: Record<string, boolean>
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  name: string
  code: string
  address?: string
  phone?: string
  city?: string
  department?: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
  icon?: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  category_id: string
  name: string
  description?: string
  price: number
  image_url?: string
  status: 'active' | 'inactive'
  is_featured: boolean
  sort_order: number
  created_at: string
  updated_at: string
  category_name?: string
  category_icon?: string
}

export interface Combo {
  id: string
  name: string
  description?: string
  price: number
  image_url?: string
  status: 'active' | 'inactive'
  is_featured: boolean
  sort_order: number
  created_at: string
  items?: ComboItem[]
}

export interface ComboItem {
  id: string
  combo_id: string
  product_id: string
  quantity: number
  product_name?: string
  unit_price?: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type SaleStatus = 'completed' | 'cancelled' | 'voided'
export type DiscountType = 'percentage' | 'fixed'

export interface CartItem {
  type: 'product' | 'combo'
  id: string
  name: string
  price: number
  quantity: number
  image_url?: string
}

export interface Sale {
  id: string
  sale_number: string
  branch_id: string
  branch_name?: string
  cashier_id: string
  cashier_name?: string
  customer_name?: string
  subtotal: number
  discount_type?: DiscountType
  discount_value: number
  discount_amount: number
  total: number
  payment_method: PaymentMethod
  amount_received?: number
  change_given?: number
  status: SaleStatus
  voided_at?: string
  void_reason?: string
  notes?: string
  cash_register_id?: string
  created_at: string
  sale_date?: string
  sale_time?: string
  items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  item_type: 'product' | 'combo'
  product_id?: string
  combo_id?: string
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface CashRegisterRecord {
  id: string
  branch_id: string
  branch_name?: string
  cashier_id: string
  cashier_name?: string
  status: 'open' | 'closed'
  opening_amount: number
  closing_amount?: number
  expected_cash?: number
  difference?: number
  observations?: string
  opened_at: string
  closed_at?: string
  total_sales?: number
  total_amount?: number
  cash_amount?: number
  card_amount?: number
  transfer_amount?: number
}

export interface AuditLog {
  id: string
  user_id?: string
  action: string
  table_name?: string
  record_id?: string
  old_data?: Record<string, unknown>
  new_data?: Record<string, unknown>
  branch_id?: string
  created_at: string
  user_name?: string
  branch_name?: string
}

export interface AppSetting {
  key: string
  value: unknown
  description?: string
}
