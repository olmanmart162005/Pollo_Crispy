export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CAJERO'

export interface Profile {
  id: string
  full_name: string
  email?: string
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
  current_expected_cash?: number
  difference?: number
  observations?: string
  opened_at: string
  closed_at?: string
  closed_by?: string
  closed_by_name?: string
  total_sales?: number
  total_amount?: number
  cash_amount?: number
  card_amount?: number
  transfer_amount?: number
  total_transfers?: number
  cash_expenses?: number
  total_expenses?: number
}

export interface CashTransfer {
  id: string
  branch_id: string
  branch_name?: string
  branch_code?: string
  cash_register_id?: string
  register_opened_at?: string
  sender_id: string
  sender_name?: string
  recipient_name: string
  amount: number
  reason: string
  notes?: string
  status: 'confirmed' | 'pending' | 'cancelled'
  authorized_by?: string
  authorizer_name?: string
  confirmed_at?: string
  created_at: string
  transfer_date?: string
  transfer_time?: string
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

export type InventoryMovementType = 'in' | 'out' | 'adjustment'
export type InventoryStockStatus = 'available' | 'low_stock' | 'out_of_stock'

export interface InventoryItem {
  id: string
  name: string
  category: string
  unit_measure: string
  cost_price: number
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface BranchInventoryItem {
  id: string
  branch_id: string
  branch_name?: string
  branch_code?: string
  item_id: string
  item_name: string
  category: string
  unit_measure: string
  cost_price: number
  item_active?: boolean
  stock: number
  min_stock: number
  total_value: number
  stock_status: InventoryStockStatus
  updated_at: string
}

export interface InventoryMovement {
  id: string
  branch_id: string
  branch_name?: string
  item_id: string
  item_name: string
  category?: string
  unit_measure?: string
  movement_type: InventoryMovementType
  quantity: number
  previous_stock: number
  new_stock: number
  user_id?: string
  user_name?: string
  user_role?: string
  reason: string
  created_at: string
}

export interface InventorySummaryMetrics {
  totalItems: number
  totalInventoryValue: number
  lowStockCount: number
  outOfStockCount: number
}

export type ExpensePaymentMethod = 'cash' | 'card' | 'transfer' | 'other'
export type ExpenseStatus = 'active' | 'cancelled'

export interface ExpenseCategory {
  id: string
  name: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface Expense {
  id: string
  branch_id: string
  branch_name?: string
  branch_code?: string
  cash_register_id?: string
  category_id?: string
  category_name: string
  description: string
  amount: number
  payment_method: ExpensePaymentMethod
  receipt_number?: string
  notes?: string
  expense_date: string
  created_by: string
  created_by_name?: string
  created_by_role?: string
  authorized_by?: string
  authorized_by_name?: string
  authorized_at?: string
  status: ExpenseStatus
  cancelled_by?: string
  cancelled_by_name?: string
  cancellation_reason?: string
  cancelled_at?: string
  created_at: string
  updated_at?: string
}

export interface CreateExpenseInput {
  branchId: string
  categoryId?: string
  categoryName: string
  description: string
  amount: number
  paymentMethod: ExpensePaymentMethod
  receiptNumber?: string
  notes?: string
  cashRegisterId?: string
}

export interface ExpenseSummaryMetrics {
  totalExpenses: number
  cashExpenses: number
  cardExpenses: number
  transferExpenses: number
  otherExpenses: number
  count: number
}
