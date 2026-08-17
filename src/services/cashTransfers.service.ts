import { supabase } from '../lib/supabase'
import { CashTransfer } from '../types'

export interface CreateTransferParams {
  branchId: string
  cashRegisterId?: string
  senderId: string
  recipientName: string
  amount: number
  reason?: string
  notes?: string
  authorizedBy?: string
}

export const cashTransfersService = {
  async getTransfers(filters: {
    branchId?: string
    senderId?: string
    cashRegisterId?: string
    startDate?: string
    endDate?: string
    status?: string
    limit?: number
  } = {}): Promise<CashTransfer[]> {
    let query = supabase.from('v_cash_transfers_detail').select('*').order('created_at', { ascending: false })

    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.senderId) query = query.eq('sender_id', filters.senderId)
    if (filters.cashRegisterId) query = query.eq('cash_register_id', filters.cashRegisterId)
    if (filters.status) query = query.eq('status', filters.status)

    if (filters.startDate) {
      query = query.gte('transfer_date', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('transfer_date', filters.endDate)
    }

    if (filters.limit) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) throw error
    return (data || []) as CashTransfer[]
  },

  async createTransfer(params: CreateTransferParams): Promise<CashTransfer> {
    if (!params.recipientName || !params.recipientName.trim()) {
      throw new Error('Debe especificar el nombre de la persona que recibe el efectivo.')
    }
    if (!params.amount || params.amount <= 0) {
      throw new Error('El monto del envío debe ser mayor a L 0.00.')
    }

    const { data, error } = await supabase
      .from('cash_transfers')
      .insert({
        branch_id: params.branchId,
        cash_register_id: params.cashRegisterId || null,
        sender_id: params.senderId,
        recipient_name: params.recipientName.trim(),
        amount: params.amount,
        reason: params.reason?.trim() || 'Retiro de efectivo / Depósito',
        notes: params.notes?.trim() || null,
        authorized_by: params.authorizedBy || null,
        status: 'confirmed',
      })
      .select()
      .single()

    if (error) throw error
    return data as CashTransfer
  },

  async getSummary(branchId?: string, startDate?: string, endDate?: string) {
    const { data, error } = await supabase.rpc('get_transfers_summary', {
      p_branch_id: branchId || null,
      p_start_date: startDate || new Date().toISOString().split('T')[0],
      p_end_date: endDate || new Date().toISOString().split('T')[0],
    })
    if (error) throw error
    return data
  },
}
