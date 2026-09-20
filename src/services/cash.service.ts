import { supabase } from '../lib/supabase'
import { CashRegisterRecord } from '../types'

export function validateOpenCashSchedule(): { allowed: boolean; message?: string } {
  const currentHour = new Date().getHours()
  if (currentHour < 6) {
    return {
      allowed: false,
      message: 'No se puede abrir la caja antes de las 6:00 AM. El horario de apertura inicia a las 6:00 AM.',
    }
  }
  return { allowed: true }
}

export function validateCloseCashSchedule(openedAt?: string): { allowed: boolean; message?: string } {
  const now = new Date()
  const currentHour = now.getHours()

  if (openedAt) {
    const openedDate = new Date(openedAt)
    const isSameDay =
      openedDate.getFullYear() === now.getFullYear() &&
      openedDate.getMonth() === now.getMonth() &&
      openedDate.getDate() === now.getDate()

    if (isSameDay && currentHour < 9) {
      return {
        allowed: false,
        message: 'No se puede cerrar la caja todavía. El cierre de caja está habilitado a partir de las 9:00 AM. Por favor, continúe operando hasta el horario permitido.',
      }
    }
  } else if (currentHour < 9) {
    return {
      allowed: false,
      message: 'No se puede cerrar la caja todavía. El cierre de caja está habilitado a partir de las 9:00 AM. Por favor, continúe operando hasta el horario permitido.',
    }
  }
  return { allowed: true }
}

export const cashService = {
  async openCash(branchId: string, cashierId: string, openingAmount: number): Promise<CashRegisterRecord> {
    // 0. Validar horario de apertura (a partir de las 6:00 AM)
    const scheduleCheck = validateOpenCashSchedule()
    if (!scheduleCheck.allowed) {
      throw new Error(scheduleCheck.message)
    }

    // 1. Intentar aperturar usando la función RPC atómica y segura
    const { data: rpcData, error: rpcErr } = await supabase.rpc('open_cash_register', {
      p_branch_id: branchId,
      p_cashier_id: cashierId,
      p_opening_amount: openingAmount,
    })

    if (!rpcErr && rpcData?.id) {
      return rpcData as unknown as CashRegisterRecord
    }

    // Si el error es una regla de negocio (ej. ya tiene caja abierta), propagar el mensaje
    if (rpcErr && rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
      throw new Error(rpcErr.message)
    }

    // 2. Fallback de inserción directa si la función RPC aún no fue creada en la BD
    const { data: existing } = await supabase
      .from('cash_registers')
      .select('id, branch_id, branches(name)')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .maybeSingle()

    if (existing) {
      const branchName = (existing as unknown as { branches?: { name?: string } })?.branches?.name || 'otra sucursal'
      throw new Error(`Ya tienes una caja abierta en "${branchName}". Debes cerrarla antes de aperturar un nuevo turno.`)
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

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permiso denegado por políticas de seguridad (RLS). Ejecuta la migración 12_cash_registers_fix.sql en Supabase.')
      }
      throw error
    }
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

  async getAnyOpenRegister(cashierId: string): Promise<CashRegisterRecord | null> {
    const { data, error } = await supabase
      .from('v_cash_register_summary')
      .select('*')
      .eq('cashier_id', cashierId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

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
    // 1. Intentar cierre usando la función RPC atómica y segura
    const { data: rpcData, error: rpcErr } = await supabase.rpc('close_cash_register', {
      p_register_id: registerId,
      p_closing_amount: closingAmount,
      p_observations: observations || null,
    })

    if (!rpcErr && rpcData?.success) {
      return
    }

    if (rpcErr && rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
      throw new Error(rpcErr.message)
    }

    // 2. Fallback de actualización directa
    let expected = 0
    try {
      const summary = await this.getSummary(registerId)
      expected = summary?.expected_cash ?? 0
    } catch {
      // Si falla getSummary, mantener expected en 0 o cálculo básico
    }

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

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permiso denegado por políticas de seguridad (RLS). Ejecuta la migración 12_cash_registers_fix.sql en Supabase.')
      }
      throw error
    }
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
