import { supabase } from '../lib/supabase'
import { CashRegisterRecord } from '../types'

export const cashService = {
  async openCash(branchId: string, cashierId: string, openingAmount: number): Promise<CashRegisterRecord> {
    // Check if the cashier already has an open cash register in ANY branch
    const { data: existing } = await supabase
      .from('cash_registers')
      .select('id, branch_id')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .maybeSingle()

    if (existing) {
      throw new Error('Ya tienes una caja abierta. Debes cerrarla antes de abrir un nuevo turno de caja.')
    }

    const { data, error } = await supabase
      .from('cash_registers')
      .insert({
        branch_id: branchId,
        cashier_id: cashierId,
        opening_amount: openingAmount,
        status: 'open',
      })
      .select()
      .single()

    if (error) throw error
    return data as CashRegisterRecord
  },

  async getOpenRegister(cashierId: string, branchId?: string): Promise<CashRegisterRecord | null> {
    let query = supabase
      .from('v_cash_register_summary')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')

    if (branchId) {
      query = query.eq('branch_id', branchId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) return null
    return data as CashRegisterRecord | null
  },

  async getOpenRegistersByBranch(branchId: string): Promise<CashRegisterRecord[]> {
    const { data, error } = await supabase
      .from('v_cash_register_summary')
      .select('*')
      .eq('branch_id', branchId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })

    if (error) return []
    return (data || []) as CashRegisterRecord[]
  },

  async getSummary(registerId: string) {
    const { data, error } = await supabase.rpc('get_cash_register_summary', { p_register_id: registerId })
    if (error) throw error
    return data
  },

  async closeCash(registerId: string, closingAmount: number, observations: string): Promise<void> {
    const summary = await this.getSummary(registerId)
    const expected = summary?.expected_cash ?? 0
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

  async getRegisters(filters: { branchId?: string; cashierId?: string; status?: string; limit?: number } = {}): Promise<CashRegisterRecord[]> {
    let query = supabase.from('v_cash_register_summary').select('*').order('opened_at', { ascending: false })
    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.cashierId) query = query.eq('cashier_id', filters.cashierId)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) throw error
    return (data || []) as CashRegisterRecord[]
  },
}
