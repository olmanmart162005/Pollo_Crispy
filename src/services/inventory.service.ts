import { supabase } from '../lib/supabase'
import {
  BranchInventoryItem,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryStockStatus,
  InventorySummaryMetrics,
} from '../types'

export interface GetInventoryFilters {
  branchId?: string
  category?: string
  status?: InventoryStockStatus | 'all'
  search?: string
}

export interface GetMovementsFilters {
  branchId?: string
  itemId?: string
  movementType?: InventoryMovementType | 'all'
  startDate?: string
  endDate?: string
  search?: string
  limit?: number
}

export const inventoryService = {
  /**
   * Obtiene la lista de insumos maestros creados.
   */
  async getMasterItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      console.warn('Error fetching inventory_items:', error.message)
      return []
    }
    return (data || []) as InventoryItem[]
  },

  /**
   * Crea un nuevo insumo / materia prima en el catálogo maestro y lo inicializa en las sucursales.
   */
  async createItem(params: {
    name: string
    category: string
    unitMeasure: string
    costPrice: number
  }): Promise<InventoryItem> {
    const { data, error } = await supabase.rpc('create_inventory_item', {
      p_name: params.name.trim(),
      p_category: params.category.trim(),
      p_unit_measure: params.unitMeasure.trim(),
      p_cost_price: params.costPrice,
    })

    if (error) {
      if (error.message && !error.message.includes('function') && !error.message.includes('does not exist')) {
        throw new Error(error.message)
      }
      // Fallback manual
      const { data: inserted, error: insErr } = await supabase
        .from('inventory_items')
        .insert({
          name: params.name.trim(),
          category: params.category.trim(),
          unit_measure: params.unitMeasure.trim(),
          cost_price: params.costPrice,
        })
        .select()
        .single()

      if (insErr) throw insErr

      // Asignar a sucursales
      const { data: branches } = await supabase.from('branches').select('id')
      if (branches && branches.length > 0) {
        const rows = branches.map(b => ({
          branch_id: b.id,
          item_id: inserted.id,
          stock: 0,
          min_stock: 5,
        }))
        await supabase.from('branch_inventory').upsert(rows, { onConflict: 'branch_id,item_id' })
      }

      return inserted as InventoryItem
    }

    return data as InventoryItem
  },

  /**
   * Consulta las existencias de insumos por sucursal con filtros.
   */
  async getInventory(filters: GetInventoryFilters = {}): Promise<BranchInventoryItem[]> {
    let query = supabase
      .from('v_branch_inventory')
      .select('*')
      .order('item_name', { ascending: true })

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }

    if (filters.status && filters.status !== 'all') {
      query = query.eq('stock_status', filters.status)
    }

    const { data, error } = await query
    if (error) {
      console.warn('Error consultando v_branch_inventory, usando fallback:', error.message)
      return this.getInventoryFallback(filters)
    }

    let items = (data || []) as BranchInventoryItem[]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      items = items.filter(
        i =>
          i.item_name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.unit_measure.toLowerCase().includes(q) ||
          (i.branch_name && i.branch_name.toLowerCase().includes(q))
      )
    }

    return items
  },

  /**
   * Fallback de consulta directa a branch_inventory unida a inventory_items.
   */
  async getInventoryFallback(filters: GetInventoryFilters = {}): Promise<BranchInventoryItem[]> {
    let query = supabase
      .from('branch_inventory')
      .select(`
        id,
        branch_id,
        item_id,
        stock,
        min_stock,
        updated_at,
        branches(name, code),
        inventory_items(id, name, category, unit_measure, cost_price, is_active)
      `)

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((row: any) => {
      const item = row.inventory_items || {}
      const b = row.branches || {}
      const stock = Number(row.stock || 0)
      const minStock = Number(row.min_stock || 5)
      const costPrice = Number(item.cost_price || 0)

      let stockStatus: InventoryStockStatus = 'available'
      if (stock <= 0) stockStatus = 'out_of_stock'
      else if (stock <= minStock) stockStatus = 'low_stock'

      return {
        id: row.id,
        branch_id: row.branch_id,
        branch_name: b.name || 'Sucursal',
        branch_code: b.code || '',
        item_id: row.item_id,
        item_name: item.name || 'Insumo',
        category: item.category || 'General',
        unit_measure: item.unit_measure || 'Unidad',
        cost_price: costPrice,
        item_active: item.is_active,
        stock,
        min_stock: minStock,
        total_value: Number((stock * costPrice).toFixed(2)),
        stock_status: stockStatus,
        updated_at: row.updated_at,
      }
    })
  },

  /**
   * Consulta el historial de movimientos (Kardex de Insumos).
   */
  async getMovements(filters: GetMovementsFilters = {}): Promise<InventoryMovement[]> {
    let query = supabase
      .from('v_inventory_movements')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.branchId) {
      query = query.eq('branch_id', filters.branchId)
    }

    if (filters.itemId) {
      query = query.eq('item_id', filters.itemId)
    }

    if (filters.movementType && filters.movementType !== 'all') {
      query = query.eq('movement_type', filters.movementType)
    }

    if (filters.startDate) {
      query = query.gte('created_at', `${filters.startDate}T00:00:00`)
    }

    if (filters.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59`)
    }

    query = query.limit(filters.limit || 500)

    const { data, error } = await query
    if (error) {
      console.warn('Error consultando v_inventory_movements, usando fallback:', error.message)
      return this.getMovementsFallback(filters)
    }

    let list = (data || []) as InventoryMovement[]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(
        m =>
          m.item_name.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          (m.user_name && m.user_name.toLowerCase().includes(q))
      )
    }

    return list
  },

  /**
   * Fallback de consulta directa a inventory_movements.
   */
  async getMovementsFallback(filters: GetMovementsFilters = {}): Promise<InventoryMovement[]> {
    let query = supabase
      .from('inventory_movements')
      .select(`
        id,
        branch_id,
        item_id,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        user_id,
        reason,
        created_at,
        branches(name),
        inventory_items(name, category, unit_measure),
        profiles(full_name, role)
      `)
      .order('created_at', { ascending: false })

    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.itemId) query = query.eq('item_id', filters.itemId)
    if (filters.movementType && filters.movementType !== 'all') query = query.eq('movement_type', filters.movementType)
    if (filters.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`)
    if (filters.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`)
    query = query.limit(filters.limit || 500)

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((row: any) => {
      const it = row.inventory_items || {}
      const pr = row.profiles || {}
      return {
        id: row.id,
        branch_id: row.branch_id,
        branch_name: row.branches?.name || 'Sucursal',
        item_id: row.item_id,
        item_name: it.name || 'Insumo',
        category: it.category || 'General',
        unit_measure: it.unit_measure || 'Unidad',
        movement_type: row.movement_type,
        quantity: Number(row.quantity),
        previous_stock: Number(row.previous_stock),
        new_stock: Number(row.new_stock),
        user_id: row.user_id,
        user_name: pr.full_name || 'Sistema',
        user_role: pr.role || 'SISTEMA',
        reason: row.reason,
        created_at: row.created_at,
      }
    })
  },

  /**
   * Registra una Entrada ('in') o Salida ('out') de insumo vía función RPC.
   */
  async registerMovement(params: {
    branchId: string
    itemId: string
    movementType: 'in' | 'out'
    quantity: number
    reason: string
  }): Promise<{ success: boolean; new_stock: number }> {
    const { data, error } = await supabase.rpc('register_inventory_movement', {
      p_branch_id: params.branchId,
      p_item_id: params.itemId,
      p_movement_type: params.movementType,
      p_quantity: params.quantity,
      p_reason: params.reason.trim(),
    })

    if (error) {
      if (error.message && !error.message.includes('function') && !error.message.includes('does not exist')) {
        throw new Error(error.message)
      }
      // Fallback manual
      return this.registerMovementFallback(params)
    }

    return data
  },

  /**
   * Fallback manual para registro de movimiento de insumo.
   */
  async registerMovementFallback(params: {
    branchId: string
    itemId: string
    movementType: 'in' | 'out'
    quantity: number
    reason: string
  }): Promise<{ success: boolean; new_stock: number }> {
    const { data: inv } = await supabase
      .from('branch_inventory')
      .select('id, stock')
      .eq('branch_id', params.branchId)
      .eq('item_id', params.itemId)
      .maybeSingle()

    const prevStock = Number(inv?.stock || 0)
    let newStock = prevStock

    if (params.movementType === 'in') {
      newStock = prevStock + params.quantity
    } else {
      if (prevStock < params.quantity) {
        throw new Error(`Existencias insuficientes. Stock actual: ${prevStock}, cantidad a retirar: ${params.quantity}`)
      }
      newStock = prevStock - params.quantity
    }

    if (inv?.id) {
      await supabase
        .from('branch_inventory')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', inv.id)
    } else {
      await supabase.from('branch_inventory').insert({
        branch_id: params.branchId,
        item_id: params.itemId,
        stock: newStock,
        min_stock: 5,
      })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    await supabase.from('inventory_movements').insert({
      branch_id: params.branchId,
      item_id: params.itemId,
      movement_type: params.movementType,
      quantity: params.quantity,
      previous_stock: prevStock,
      new_stock: newStock,
      user_id: user?.id,
      reason: params.reason,
    })

    return { success: true, new_stock: newStock }
  },

  /**
   * Ajusta el stock a un valor específico mediante conteo físico de insumo.
   */
  async adjustStock(params: {
    branchId: string
    itemId: string
    newStock: number
    reason: string
  }): Promise<{ success: boolean; new_stock: number; difference: number }> {
    const { data, error } = await supabase.rpc('adjust_inventory_stock', {
      p_branch_id: params.branchId,
      p_item_id: params.itemId,
      p_new_stock: params.newStock,
      p_reason: params.reason.trim(),
    })

    if (error) {
      if (error.message && !error.message.includes('function') && !error.message.includes('does not exist')) {
        throw new Error(error.message)
      }
      // Fallback manual
      const { data: inv } = await supabase
        .from('branch_inventory')
        .select('id, stock')
        .eq('branch_id', params.branchId)
        .eq('item_id', params.itemId)
        .maybeSingle()

      const prevStock = Number(inv?.stock || 0)
      const diff = params.newStock - prevStock

      if (inv?.id) {
        await supabase
          .from('branch_inventory')
          .update({ stock: params.newStock, updated_at: new Date().toISOString() })
          .eq('id', inv.id)
      } else {
        await supabase.from('branch_inventory').insert({
          branch_id: params.branchId,
          item_id: params.itemId,
          stock: params.newStock,
          min_stock: 5,
        })
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      await supabase.from('inventory_movements').insert({
        branch_id: params.branchId,
        item_id: params.itemId,
        movement_type: 'adjustment',
        quantity: Math.abs(diff),
        previous_stock: prevStock,
        new_stock: params.newStock,
        user_id: user?.id,
        reason: params.reason,
      })

      return { success: true, new_stock: params.newStock, difference: diff }
    }

    return data
  },

  /**
   * Actualiza el stock mínimo de alerta de un insumo en la sucursal.
   */
  async updateMinStock(branchId: string, itemId: string, minStock: number): Promise<void> {
    const { error } = await supabase.rpc('update_inventory_min_stock', {
      p_branch_id: branchId,
      p_item_id: itemId,
      p_min_stock: minStock,
    })

    if (error) {
      await supabase
        .from('branch_inventory')
        .upsert(
          { branch_id: branchId, item_id: itemId, min_stock: minStock, updated_at: new Date().toISOString() },
          { onConflict: 'branch_id,item_id' }
        )
    }
  },

  /**
   * Métricas agregadas de insumos (Total insumos, valor L, stock bajo, agotados).
   */
  async getSummary(branchId?: string): Promise<InventorySummaryMetrics> {
    const items = await this.getInventory({ branchId })

    const totalItems = items.length
    const totalInventoryValue = items.reduce((sum, item) => sum + item.total_value, 0)
    const lowStockCount = items.filter(item => item.stock_status === 'low_stock').length
    const outOfStockCount = items.filter(item => item.stock_status === 'out_of_stock').length

    return {
      totalItems,
      totalInventoryValue,
      lowStockCount,
      outOfStockCount,
    }
  },
}
