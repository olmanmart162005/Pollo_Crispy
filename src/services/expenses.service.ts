import { supabase } from '../lib/supabase'
import {
  Expense,
  ExpenseCategory,
  CreateExpenseInput,
  ExpensePaymentMethod,
  ExpenseStatus,
  ExpenseSummaryMetrics,
} from '../types'

export const expensesService = {
  /**
   * Obtener lista de categorías de gastos activas
   */
  async getCategories(): Promise<ExpenseCategory[]> {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error || !data || data.length === 0) {
      if (error) console.warn('Aviso al cargar categorías de gastos:', error.message)
      // Fallback categorías estáticas
      return [
        { id: '1', name: 'Servicios', is_active: true, created_at: '' },
        { id: '2', name: 'Transporte', is_active: true, created_at: '' },
        { id: '3', name: 'Mantenimiento', is_active: true, created_at: '' },
        { id: '4', name: 'Limpieza', is_active: true, created_at: '' },
        { id: '5', name: 'Gas', is_active: true, created_at: '' },
        { id: '6', name: 'Hielo', is_active: true, created_at: '' },
        { id: '7', name: 'Empaques', is_active: true, created_at: '' },
        { id: '8', name: 'Alquiler', is_active: true, created_at: '' },
        { id: '9', name: 'Personal', is_active: true, created_at: '' },
        { id: '10', name: 'Compras menores', is_active: true, created_at: '' },
        { id: '11', name: 'Otros', is_active: true, created_at: '' },
      ]
    }
    return (data || []) as ExpenseCategory[]
  },

  /**
   * Crear una nueva categoría de gasto (Administración)
   */
  async createCategory(name: string, description?: string): Promise<ExpenseCategory> {
    const { data, error } = await supabase
      .from('expense_categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return data as ExpenseCategory
  },

  /**
   * Consultar gastos con filtros
   */
  async getExpenses(filters: {
    branchId?: string
    startDate?: string
    endDate?: string
    categoryId?: string
    paymentMethod?: ExpensePaymentMethod
    status?: ExpenseStatus
    createdBy?: string
    search?: string
    limit?: number
  } = {}): Promise<Expense[]> {
    // 1. Intentar desde la vista v_expenses_detail
    let query = supabase
      .from('v_expenses_detail')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }
    if (filters.startDate) {
      query = query.gte('expense_date', filters.startDate)
    }
    if (filters.endDate) {
      query = query.lte('expense_date', filters.endDate)
    }
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    if (filters.paymentMethod) {
      query = query.eq('payment_method', filters.paymentMethod)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.createdBy) {
      query = query.eq('created_by', filters.createdBy)
    }
    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query

    if (!error && data) {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        return (data as Expense[]).filter(
          e =>
            e.description.toLowerCase().includes(q) ||
            e.category_name.toLowerCase().includes(q) ||
            (e.receipt_number && e.receipt_number.toLowerCase().includes(q)) ||
            (e.created_by_name && e.created_by_name.toLowerCase().includes(q))
        )
      }
      return data as Expense[]
    }

    // 2. Fallback directo a tabla expenses si la vista aún no estuviera disponible
    let fallbackQuery = supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.branchId) fallbackQuery = fallbackQuery.eq('branch_id', filters.branchId)
    if (filters.startDate) fallbackQuery = fallbackQuery.gte('expense_date', filters.startDate)
    if (filters.endDate) fallbackQuery = fallbackQuery.lte('expense_date', filters.endDate)
    if (filters.paymentMethod) fallbackQuery = fallbackQuery.eq('payment_method', filters.paymentMethod)
    if (filters.status) fallbackQuery = fallbackQuery.eq('status', filters.status)
    if (filters.limit) fallbackQuery = fallbackQuery.limit(filters.limit)

    const { data: fbData, error: fbErr } = await fallbackQuery
    if (fbErr) throw fbErr

    return (fbData || []) as Expense[]
  },

  /**
   * Registrar un gasto operativo
   */
  async createExpense(input: CreateExpenseInput): Promise<{ id: string }> {
    // 1. Intentar registrar vía función RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_expense', {
      p_branch_id: input.branchId,
      p_category_id: input.categoryId || null,
      p_category_name: input.categoryName,
      p_description: input.description,
      p_amount: input.amount,
      p_payment_method: input.paymentMethod,
      p_receipt_number: input.receiptNumber || null,
      p_notes: input.notes || null,
      p_cash_register_id: input.cashRegisterId || null,
    })

    if (!rpcErr && rpcData?.id) {
      return { id: rpcData.id }
    }

    if (rpcErr && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
      throw new Error(rpcErr.message)
    }

    // 2. Fallback de inserción directa
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('Usuario no autenticado')

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        branch_id: input.branchId,
        cash_register_id: input.cashRegisterId || null,
        category_id: input.categoryId || null,
        category_name: input.categoryName,
        description: input.description,
        amount: input.amount,
        payment_method: input.paymentMethod,
        receipt_number: input.receiptNumber || null,
        notes: input.notes || null,
        expense_date: new Date().toISOString().split('T')[0],
        created_by: user.user.id,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) throw error
    return { id: data.id }
  },

  /**
   * Marcar gasto como revisado / autorizado (Admin o Super Admin)
   */
  async authorizeExpense(expenseId: string): Promise<void> {
    const { error: rpcErr } = await supabase.rpc('authorize_expense', {
      p_expense_id: expenseId,
    })

    if (!rpcErr) return

    if (rpcErr && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
      throw new Error(rpcErr.message)
    }

    // Fallback directo
    const { data: user } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('expenses')
      .update({
        authorized_by: user.user?.id || null,
        authorized_at: new Date().toISOString(),
      })
      .eq('id', expenseId)

    if (error) throw error
  },

  /**
   * Anular gasto (Admin o Super Admin)
   */
  async cancelExpense(expenseId: string, reason: string): Promise<void> {
    if (!reason.trim()) {
      throw new Error('Debe ingresar el motivo de anulación del gasto')
    }

    const { error: rpcErr } = await supabase.rpc('cancel_expense', {
      p_expense_id: expenseId,
      p_reason: reason.trim(),
    })

    if (!rpcErr) return

    if (rpcErr && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
      throw new Error(rpcErr.message)
    }

    // Fallback directo
    const { data: user } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('expenses')
      .update({
        status: 'cancelled',
        cancelled_by: user.user?.id || null,
        cancellation_reason: reason.trim(),
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', expenseId)

    if (error) throw error
  },

  /**
   * Calcular métricas de resumen
   */
  calculateMetrics(expenses: Expense[]): ExpenseSummaryMetrics {
    const active = expenses.filter(e => e.status === 'active')
    const totalExpenses = active.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const cashExpenses = active
      .filter(e => e.payment_method === 'cash')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const cardExpenses = active
      .filter(e => e.payment_method === 'card')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const transferExpenses = active
      .filter(e => e.payment_method === 'transfer')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const otherExpenses = active
      .filter(e => e.payment_method === 'other')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)

    return {
      totalExpenses,
      cashExpenses,
      cardExpenses,
      transferExpenses,
      otherExpenses,
      count: active.length,
    }
  },
}
