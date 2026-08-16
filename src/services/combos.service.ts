import { supabase } from '../lib/supabase'
import { Combo, ComboItem } from '../types'

export const combosService = {
  async getCombos(includeInactive = false): Promise<Combo[]> {
    let query = supabase.from('v_combos_with_items').select('*').order('sort_order')
    if (!includeInactive) query = query.eq('status', 'active')
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Combo[]
  },

  async create(combo: Omit<Combo, 'id' | 'created_at' | 'items'>): Promise<Combo> {
    const { data, error } = await supabase.from('combos').insert(combo).select().single()
    if (error) throw error
    return data as Combo
  },

  async update(id: string, updates: Partial<Combo>): Promise<Combo> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { items, created_at, ...rest } = updates as Combo
    const { data, error } = await supabase.from('combos').update(rest).eq('id', id).select().single()
    if (error) throw error
    return data as Combo
  },

  async setItems(comboId: string, items: { product_id: string; quantity: number }[]): Promise<void> {
    await supabase.from('combo_items').delete().eq('combo_id', comboId)
    if (items.length === 0) return
    const { error } = await supabase.from('combo_items').insert(
      items.map(i => ({ combo_id: comboId, product_id: i.product_id, quantity: i.quantity }))
    )
    if (error) throw error
  },

  async toggleStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
    const { error } = await supabase.from('combos').update({ status }).eq('id', id)
    if (error) throw error
  },

  async getComboItems(comboId: string): Promise<ComboItem[]> {
    const { data, error } = await supabase
      .from('combo_items')
      .select('*, products(name, price)')
      .eq('combo_id', comboId)
    if (error) throw error
    return (data || []).map((ci: Record<string, unknown>) => ({
      id: ci.id as string,
      combo_id: ci.combo_id as string,
      product_id: ci.product_id as string,
      quantity: ci.quantity as number,
      product_name: (ci.products as Record<string, unknown>)?.name as string,
      unit_price: (ci.products as Record<string, unknown>)?.price as number,
    }))
  },
}
