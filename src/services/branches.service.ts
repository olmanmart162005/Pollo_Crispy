import { supabase } from '../lib/supabase'
import { Branch } from '../types'

export const branchesService = {
  async getAll(): Promise<Branch[]> {
    const { data, error } = await supabase.from('branches').select('*').order('name')
    if (error) throw error
    return (data || []) as Branch[]
  },

  async create(branch: Omit<Branch, 'id' | 'created_at' | 'updated_at'>): Promise<Branch> {
    const { data, error } = await supabase.from('branches').insert(branch).select().single()
    if (error) throw error
    await supabase.from('sale_sequences').insert({ branch_id: (data as Branch).id, last_number: 0 })
    return data as Branch
  },

  async update(id: string, updates: Partial<Branch>): Promise<Branch> {
    const { data, error } = await supabase.from('branches').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data as Branch
  },

  async toggleStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
    const { error } = await supabase.from('branches').update({ status }).eq('id', id)
    if (error) throw error
  },
}
