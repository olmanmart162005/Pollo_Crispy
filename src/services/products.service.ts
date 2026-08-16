import { supabase } from '../lib/supabase'
import { Product, Category } from '../types'

export const productsService = {
  async getProducts(includeInactive = false): Promise<Product[]> {
    let query = supabase.from('v_products_with_category').select('*').order('sort_order')
    if (!includeInactive) query = query.eq('status', 'active')
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Product[]
  },

  async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'category_icon'>): Promise<Product> {
    const { data, error } = await supabase.from('products').insert(product).select().single()
    if (error) throw error
    return data as Product
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { category_name, category_icon, created_at, updated_at, ...rest } = updates as Product
    const { data, error } = await supabase.from('products').update(rest).eq('id', id).select().single()
    if (error) throw error
    return data as Product
  },

  async toggleStatus(id: string, status: 'active' | 'inactive'): Promise<void> {
    const { error } = await supabase.from('products').update({ status }).eq('id', id)
    if (error) throw error
  },

  async getCategories(includeInactive = false): Promise<Category[]> {
    let query = supabase.from('categories').select('*').order('sort_order')
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as Category[]
  },

  async createCategory(cat: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<Category> {
    const { data, error } = await supabase.from('categories').insert(cat).select().single()
    if (error) throw error
    return data as Category
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data as Category
  },
}
