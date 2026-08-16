import { supabase } from '../lib/supabase'

export const reportsService = {
  async getSummary(branchId: string | null, startDate: string, endDate: string) {
    const { data, error } = await supabase.rpc('get_sales_summary', {
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (error) throw error
    return data
  },

  async getTopProducts(branchId: string | null, startDate: string, endDate: string, limit = 10) {
    const { data, error } = await supabase.rpc('get_top_products', {
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit: limit,
    })
    if (error) throw error
    return data || []
  },

  async getTopCombos(branchId: string | null, startDate: string, endDate: string, limit = 10) {
    const { data, error } = await supabase.rpc('get_top_combos', {
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit: limit,
    })
    if (error) throw error
    return data || []
  },

  async getSalesByBranch(startDate: string, endDate: string) {
    const { data, error } = await supabase.rpc('get_sales_by_branch', {
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (error) throw error
    return data || []
  },

  async getSalesByCashier(branchId: string | null, startDate: string, endDate: string) {
    const { data, error } = await supabase.rpc('get_sales_by_cashier', {
      p_branch_id: branchId,
      p_start_date: startDate,
      p_end_date: endDate,
    })
    if (error) throw error
    return data || []
  },

  async getDailySales(branchId: string | null, year: number, month: number) {
    const { data, error } = await supabase.rpc('get_daily_sales', {
      p_branch_id: branchId,
      p_year: year,
      p_month: month,
    })
    if (error) throw error
    return data || []
  },

  async getMonthlySales(branchId: string | null, year: number) {
    const { data, error } = await supabase.rpc('get_monthly_sales', {
      p_branch_id: branchId,
      p_year: year,
    })
    if (error) throw error
    return data || []
  },

  async getBranchStats() {
    const { data, error } = await supabase.from('v_branch_stats').select('*')
    if (error) throw error
    return data || []
  },

  async getSettings(): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.from('app_settings').select('key, value')
    if (error) throw error
    const settings: Record<string, unknown> = {}
    for (const s of (data || [])) settings[(s as { key: string; value: unknown }).key] = (s as { key: string; value: unknown }).value
    return settings
  },

  async updateSetting(key: string, value: unknown, userId: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .update({ value: value as never, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('key', key)
    if (error) throw error
  },

  async getAuditLogs(filters: { branchId?: string; limit?: number } = {}) {
    let query = supabase
      .from('audit_logs')
      .select('*, profiles(full_name), branches(name)')
      .order('created_at', { ascending: false })
    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.limit) query = query.limit(filters.limit)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map((log: Record<string, unknown>) => ({
      ...log,
      user_name: (log.profiles as Record<string, unknown> | null)?.full_name,
      branch_name: (log.branches as Record<string, unknown> | null)?.name,
    }))
  },
}
