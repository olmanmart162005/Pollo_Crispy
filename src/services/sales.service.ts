import { supabase } from '../lib/supabase'
import { Sale, CartItem, PaymentMethod, DiscountType } from '../types'

interface RegisterSaleParams {
  branchId: string
  cashierId: string
  cashRegisterId?: string
  customerName?: string
  items: CartItem[]
  paymentMethod: PaymentMethod
  amountReceived?: number
  discountType?: DiscountType
  discountValue?: number
  discountBy?: string
  notes?: string
}

export const salesService = {
  async registerSale(params: RegisterSaleParams): Promise<{ sale_id: string; sale_number: string; total: number; change_given: number }> {
    const items = params.items.map(item => ({
      item_type: item.type,
      product_id: item.type === 'product' ? item.id : null,
      combo_id: item.type === 'combo' ? item.id : null,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
    }))

    const { data, error } = await supabase.rpc('register_sale', {
      p_branch_id: params.branchId,
      p_cashier_id: params.cashierId,
      p_cash_register_id: params.cashRegisterId || null,
      p_customer_name: params.customerName || null,
      p_items: items,
      p_payment_method: params.paymentMethod,
      p_amount_received: params.amountReceived || null,
      p_discount_type: params.discountType || null,
      p_discount_value: params.discountValue || 0,
      p_discount_by: params.discountBy || null,
      p_notes: params.notes || null,
    })
    if (error) throw error
    return data
  },

  async getSales(filters: {
    branchId?: string
    cashierId?: string
    startDate?: string
    endDate?: string
    status?: string
    limit?: number
  } = {}): Promise<Sale[]> {
    let query = supabase
      .from('v_sales_summary')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.cashierId) query = query.eq('cashier_id', filters.cashierId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.startDate) query = query.gte('sale_date', filters.startDate)
    if (filters.endDate) query = query.lte('sale_date', filters.endDate)
    if (filters.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) throw error
    return (data || []) as Sale[]
  },

  async getSaleById(id: string): Promise<Sale & { items: import('../types').SaleItem[] }> {
    const { data: sale, error } = await supabase
      .from('v_sales_summary').select('*').eq('id', id).single()
    if (error) throw error
    const { data: items, error: iErr } = await supabase
      .from('sale_items').select('*').eq('sale_id', id)
    if (iErr) throw iErr
    return { ...(sale as Sale), items: items || [] }
  },

  async voidSale(saleId: string, voidedBy: string, reason: string, authorizedBy: string): Promise<void> {
    const { error } = await supabase.rpc('void_sale', {
      p_sale_id: saleId,
      p_voided_by: voidedBy,
      p_void_reason: reason,
      p_authorized_by: authorizedBy,
    })
    if (error) throw error
  },
}
