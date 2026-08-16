import { supabase } from '../lib/supabase'
import { CashRegisterRecord } from '../types'

export const cashService = {
  async openCash(branchId: string, cashierId: string, openingAmount: number): Promise<CashRegisterRecord> {
    const { data: existing } = await supabase
      .from('cash_registers')
      .select('id')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .maybeSingle()
    if (existing) throw new Error('Ya tienes una caja abierta. Ciérrala antes de abrir otra.')

    const { data, error } = await supabase
      .from('cash_registers')
      .insert({ branch_id: branchId, cashier_id: cashierId, opening_amount: openingAmount, status: 'open' })
      .select()
      .single()
    if (error) throw error
    return data as CashRegisterRecord
  },

  async getOpenRegister(cashierId: string): Promise<CashRegisterRecord | null> {
    const { data, error } = await supabase
      .from('v_cash_register_summary')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .maybeSingle()
    if (error) return null
    return data as CashRegisterRecord | null
  },

  async getSummary(registerId: string) {
    const { data, error } = await supabase.rpc('get_cash_register_summary', { p_register_id: registerId })
    if (error) throw error
    return data
  },

  async closeCash(registerId: string, closingAmount: number, observations: string): Promise<void> {
    const summary = await this.getSummary(registerId)
    const expected = summary?.expected_cash || 0
    const diff = closingAmount - expected

    const { error } = await supabase
      .from('cash_registers')
      .update({
        status: 'closed',
        closing_amount: closingAmount,
        expected_cash: expected,
        difference: diff,
        observations: observations || null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', registerId)
    if (error) throw error
  },

  async getRegisters(filters: { branchId?: string; cashierId?: string; limit?: number } = {}): Promise<CashRegisterRecord[]> {
    let query = supabase.from('v_cash_register_summary').select('*').order('opened_at', { ascending: false })
    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.cashierId) query = query.eq('cashier_id', filters.cashierId)
    if (filters.limit) query = query.limit(filters.limit)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as CashRegisterRecord[]
  },
}
