import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { inventoryService } from '../services/inventory.service'
import {
  BranchInventoryItem,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  InventoryStockStatus,
} from '../types'
import { formatCurrency, formatDateTime } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  Boxes,
  Plus,
  Minus,
  SlidersHorizontal,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  History,
  TrendingUp,
  MapPin,
  RefreshCw,
  Edit3,
  Calendar,
  PackagePlus,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'

const SUPPLY_CATEGORIES = [
  'Pollo y Carnes',
  'Verduras y Perecederos',
  'Salsas y Condimentos',
  'Aceites y Harinas',
  'Papas y Congelados',
  'Empaques y Desechables',
  'Bebidas y Suministros',
  'Limpieza y Otros',
]

const UNIT_MEASURES = [
  'Saco',
  'Caja',
  'Tanda',
  'Cubeta',
  'Libra',
  'Galón',
  'Fardo',
  'Paquete',
  'Bolsa',
  'Malla',
  'Unidad',
]

export default function Inventory() {
  const { profile } = useAuth()
  const { branches, activeBranch, setActiveBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()

  // Branch state
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')
  const [activeTab, setActiveTab] = useState<'stock' | 'movements'>('stock')

  // Inventory & Items State
  const [inventory, setInventory] = useState<BranchInventoryItem[]>([])
  const [masterItems, setMasterItems] = useState<InventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters for Stock tab
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<InventoryStockStatus | 'all'>('all')

  // Filters for Movements tab
  const [movSearch, setMovSearch] = useState('')
  const [movTypeFilter, setMovTypeFilter] = useState<InventoryMovementType | 'all'>('all')
  const [movStartDate, setMovStartDate] = useState<string>('')
  const [movEndDate, setMovEndDate] = useState<string>('')

  // Modals state
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)
  const [showInModal, setShowInModal] = useState(false)
  const [showOutModal, setShowOutModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showMinStockModal, setShowMinStockModal] = useState(false)
  const [selectedItemForAction, setSelectedItemForAction] = useState<BranchInventoryItem | null>(null)

  // Form states for Create Item
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState(SUPPLY_CATEGORIES[0])
  const [newItemUnit, setNewItemUnit] = useState(UNIT_MEASURES[0])
  const [newItemCost, setNewItemCost] = useState('')
  const [creatingItem, setCreatingItem] = useState(false)

  // Form states for Movements
  const [actionItemId, setActionItemId] = useState('')
  const [actionQuantity, setActionQuantity] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [actionNewStock, setActionNewStock] = useState('')
  const [actionMinStock, setActionMinStock] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)

  // Determine the effective branch ID
  const effectiveBranchId = isSuperAdmin ? selectedBranchId : activeBranch?.id || ''

  useEffect(() => {
    if (!isSuperAdmin && activeBranch?.id) {
      setSelectedBranchId(activeBranch.id)
    }
  }, [activeBranch?.id, isSuperAdmin])

  useEffect(() => {
    loadData()
  }, [effectiveBranchId, activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const items = await inventoryService.getMasterItems()
      setMasterItems(items)

      if (activeTab === 'stock') {
        const inv = await inventoryService.getInventory({
          branchId: effectiveBranchId || undefined,
        })
        setInventory(inv)
      } else {
        const movs = await inventoryService.getMovements({
          branchId: effectiveBranchId || undefined,
          startDate: movStartDate || undefined,
          endDate: movEndDate || undefined,
          movementType: movTypeFilter !== 'all' ? movTypeFilter : undefined,
        })
        setMovements(movs)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error cargando inventario de insumos')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const items = await inventoryService.getMasterItems()
      setMasterItems(items)

      if (activeTab === 'stock') {
        const inv = await inventoryService.getInventory({
          branchId: effectiveBranchId || undefined,
        })
        setInventory(inv)
      } else {
        const movs = await inventoryService.getMovements({
          branchId: effectiveBranchId || undefined,
          startDate: movStartDate || undefined,
          endDate: movEndDate || undefined,
          movementType: movTypeFilter !== 'all' ? movTypeFilter : undefined,
        })
        setMovements(movs)
      }
      toast.success('Inventario actualizado')
    } catch {
      toast.error('Error al actualizar')
    } finally {
      setRefreshing(false)
    }
  }

  // Stock Filtered items
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false
      if (selectedStatus !== 'all' && item.stock_status !== selectedStatus) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          item.item_name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.unit_measure.toLowerCase().includes(q) ||
          (item.branch_name && item.branch_name.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [inventory, selectedCategory, selectedStatus, search])

  // Metrics calculation focused purely on Tandas de Pollo
  const metrics = useMemo(() => {
    const totalTandas = inventory.reduce((sum, i) => sum + (Number(i.stock) || 0), 0)
    const lowStock = inventory.filter(i => i.stock_status === 'low_stock').length
    const outOfStock = inventory.filter(i => i.stock_status === 'out_of_stock').length
    
    // Entradas y salidas en historial
    const totalIn = movements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)
    const totalOut = movements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + (Number(m.quantity) || 0), 0)

    return { totalTandas, lowStock, outOfStock, totalIn, totalOut }
  }, [inventory, movements])

  // Open Modals
  const openCreateItemModal = () => {
    setNewItemName('')
    setNewItemCategory(SUPPLY_CATEGORIES[0])
    setNewItemUnit(UNIT_MEASURES[0])
    setNewItemCost('')
    setShowCreateItemModal(true)
  }

  const openInModal = (item?: BranchInventoryItem) => {
    setSelectedItemForAction(item || null)
    setActionItemId(item?.item_id || (masterItems[0]?.id || ''))
    setActionQuantity('')
    setActionReason('Preparación de tandas de pollo')
    setShowInModal(true)
  }

  const openOutModal = (item?: BranchInventoryItem) => {
    setSelectedItemForAction(item || null)
    setActionItemId(item?.item_id || (masterItems[0]?.id || ''))
    setActionQuantity('')
    setActionReason('Pase a freidora / Cocina')
    setShowOutModal(true)
  }

  const openAdjustModal = (item: BranchInventoryItem) => {
    setSelectedItemForAction(item)
    setActionItemId(item.item_id)
    setActionNewStock(item.stock.toString())
    setActionReason('Conteo físico de cambio de turno')
    setShowAdjustModal(true)
  }

  const openMinStockModal = (item: BranchInventoryItem) => {
    setSelectedItemForAction(item)
    setActionItemId(item.item_id)
    setActionMinStock(item.min_stock.toString())
    setShowMinStockModal(true)
  }

  // Handlers
  const handleCreateNewItem = async () => {
    if (!newItemName.trim()) {
      toast.error('El nombre del insumo es requerido (ej: Saco de Cebolla, Cajas de Salsa, Tandas de Pollo)')
      return
    }
    const cost = parseFloat(newItemCost) || 0
    if (cost < 0) {
      toast.error('El costo no puede ser negativo')
      return
    }

    setCreatingItem(true)
    try {
      await inventoryService.createItem({
        name: newItemName.trim(),
        category: newItemCategory,
        unitMeasure: newItemUnit,
        costPrice: cost,
      })
      toast.success(`Insumo "${newItemName}" creado y habilitado en las sucursales`)
      setShowCreateItemModal(false)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear insumo')
    } finally {
      setCreatingItem(false)
    }
  }

  const handleRegisterMovement = async (type: 'in' | 'out') => {
    const branchTarget = selectedItemForAction?.branch_id || effectiveBranchId || activeBranch?.id
    if (!branchTarget) {
      toast.error('Debes seleccionar una sucursal específica para registrar movimientos')
      return
    }
    if (!actionItemId) {
      toast.error('Selecciona un insumo')
      return
    }
    const qty = parseFloat(actionQuantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Ingresa una cantidad válida mayor a 0')
      return
    }
    if (!actionReason.trim()) {
      toast.error('Ingresa el motivo u observación del movimiento')
      return
    }

    setActionSubmitting(true)
    try {
      const res = await inventoryService.registerMovement({
        branchId: branchTarget,
        itemId: actionItemId,
        movementType: type,
        quantity: qty,
        reason: actionReason.trim(),
      })
      toast.success(
        type === 'in'
          ? `Entrada de ${qty} registrada. Nuevo saldo: ${res.new_stock}`
          : `Salida de ${qty} registrada. Nuevo saldo: ${res.new_stock}`
      )
      setShowInModal(false)
      setShowOutModal(false)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar movimiento')
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleAdjustStock = async () => {
    const branchTarget = selectedItemForAction?.branch_id || effectiveBranchId || activeBranch?.id
    if (!branchTarget) {
      toast.error('Debes seleccionar una sucursal específica')
      return
    }
    const newStock = parseFloat(actionNewStock)
    if (isNaN(newStock) || newStock < 0) {
      toast.error('Ingresa un stock válido mayor o igual a 0')
      return
    }
    if (!actionReason.trim()) {
      toast.error('Ingresa el motivo del ajuste')
      return
    }

    setActionSubmitting(true)
    try {
      const res = await inventoryService.adjustStock({
        branchId: branchTarget,
        itemId: actionItemId,
        newStock,
        reason: actionReason.trim(),
      })
      toast.success(`Stock ajustado a ${res.new_stock}`)
      setShowAdjustModal(false)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al ajustar stock')
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleSaveMinStock = async () => {
    if (!selectedItemForAction) return
    const minStock = parseFloat(actionMinStock)
    if (isNaN(minStock) || minStock < 0) {
      toast.error('Ingresa un stock mínimo válido mayor o igual a 0')
      return
    }

    setActionSubmitting(true)
    try {
      await inventoryService.updateMinStock(selectedItemForAction.branch_id, selectedItemForAction.item_id, minStock)
      toast.success('Stock mínimo actualizado')
      setShowMinStockModal(false)
      loadData()
    } catch {
      toast.error('Error al actualizar stock mínimo')
    } finally {
      setActionSubmitting(false)
    }
  }

  const currentBranchName = useMemo(() => {
    if (isSuperAdmin && !selectedBranchId) return 'Todas las sucursales (Consolidado)'
    const b = branches.find(x => x.id === (isSuperAdmin ? selectedBranchId : activeBranch?.id))
    return b ? b.name : activeBranch?.name || 'Mi Sucursal'
  }, [branches, selectedBranchId, activeBranch, isSuperAdmin])

  const selectedItemUnit = useMemo(() => {
    if (selectedItemForAction) return selectedItemForAction.unit_measure
    const it = masterItems.find(i => i.id === actionItemId)
    return it?.unit_measure || 'Unidades'
  }, [selectedItemForAction, actionItemId, masterItems])

  if (loading && inventory.length === 0 && movements.length === 0) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 font-display flex items-center gap-2.5">
            <span className="text-2xl">🍗</span> Inventario — Tandas de Pollo
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <MapPin size={14} className="text-red-600" />
            Control y disponibilidad de tandas de pollo para: <strong>{currentBranchName}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openInModal()}
            className="btn btn-primary font-bold text-xs shadow-md flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus size={15} /> Entrada de Tandas (+)
          </button>
          <button
            onClick={() => openOutModal()}
            className="btn btn-secondary font-bold text-xs shadow-sm flex items-center gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
          >
            <Minus size={15} /> Salida a Cocina (-)
          </button>
          <Link
            to="/inventario/reportes"
            className="btn btn-secondary font-bold text-xs shadow-sm flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" /> Reportes de Tandas
          </Link>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-ghost btn-sm p-2 text-gray-500 hover:text-gray-800"
            title="Refrescar datos"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de Sucursal para Super Admin */}
      {isSuperAdmin && (
        <div className="p-3 bg-red-50/60 border border-red-100 rounded-2xl flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-red-600" />
            <span className="text-xs font-bold text-gray-800">Filtrar por Sucursal:</span>
          </div>
          <select
            className="select select-sm text-xs font-bold w-64 bg-white"
            value={selectedBranchId}
            onChange={e => {
              setSelectedBranchId(e.target.value)
              const found = branches.find(b => b.id === e.target.value)
              if (found) setActiveBranch(found)
            }}
          >
            <option value="">Todas las sucursales (Consolidado)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-gray-500">
            Como Super Admin puedes verificar las tandas de pollo de cada sucursal o ver el consolidado total.
          </span>
        </div>
      )}

      {/* KPI Cards enfocadas únicamente en Tandas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 border-l-4 border-l-emerald-600 flex items-center gap-3 bg-emerald-50/20">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 text-xl font-bold">
            🍗
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tandas Disponibles</p>
            <p className="text-2xl font-black text-emerald-700 font-display">
              {metrics.totalTandas} <span className="text-xs font-bold text-gray-500">Tandas</span>
            </p>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-red-500 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <Minus size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tandas a Cocina (Salidas)</p>
            <p className="text-2xl font-black text-gray-900 font-display">
              {metrics.totalOut} <span className="text-xs font-bold text-gray-500">Tandas</span>
            </p>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-blue-600 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Plus size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tandas Ingresadas (Entradas)</p>
            <p className="text-2xl font-black text-gray-900 font-display">
              {metrics.totalIn} <span className="text-xs font-bold text-gray-500">Tandas</span>
            </p>
          </div>
        </div>

        <div className="card p-4 border-l-4 border-l-amber-500 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Alerta de Stock</p>
            <p className="text-sm font-black font-display mt-0.5">
              {metrics.outOfStock > 0 ? (
                <span className="text-red-600">🔴 Agotado ({metrics.outOfStock})</span>
              ) : metrics.lowStock > 0 ? (
                <span className="text-amber-600">🟡 Stock Bajo ({metrics.lowStock})</span>
              ) : (
                <span className="text-emerald-600">🟢 Stock Disponible</span>
              )}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold">Mínimo sugerido: 3 tandas</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('stock')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'stock'
              ? 'border-red-600 text-red-600 bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <span className="text-base">🍗</span> Disponibilidad de Tandas ({inventory.length})
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'movements'
              ? 'border-red-600 text-red-600 bg-red-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <History size={18} /> Kardex / Movimientos ({movements.length})
        </button>
      </div>

      {/* TAB 1: STOCK VIEW */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar sucursal o tandas..."
                className="input pl-9 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Estado:</span>
              <select
                className="select text-xs w-36"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value as any)}
              >
                <option value="all">Todos los estados</option>
                <option value="available">🟢 Disponible</option>
                <option value="low_stock">🟡 Stock Bajo</option>
                <option value="out_of_stock">🔴 Agotado</option>
              </select>
            </div>
          </div>

          {/* Stock Table */}
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Insumo</th>
                    {(!effectiveBranchId || isSuperAdmin) && <th>Sucursal</th>}
                    <th>Existencia Disponible</th>
                    <th>Stock Mínimo</th>
                    <th>Estado</th>
                    <th>Acciones Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        <Boxes size={36} className="mx-auto mb-2 opacity-30 text-red-500" />
                        <p className="font-semibold text-sm">No se encontraron registros de tandas de pollo</p>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map(item => (
                      <tr key={`${item.branch_id}-${item.item_id}`} className="hover:bg-gray-50/60 transition-colors">
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">🍗</span>
                            <div>
                              <span className="font-black text-gray-900 text-sm">{item.item_name}</span>
                              <p className="text-[11px] text-gray-400 font-medium">Unidad: {item.unit_measure}</p>
                            </div>
                          </div>
                        </td>
                        {(!effectiveBranchId || isSuperAdmin) && (
                          <td>
                            <span className="badge badge-gray text-xs font-semibold">{item.branch_name}</span>
                          </td>
                        )}
                        <td>
                          <div className="flex items-baseline gap-1.5">
                            <span
                              className={`text-2xl font-black ${
                                item.stock_status === 'out_of_stock'
                                  ? 'text-red-600'
                                  : item.stock_status === 'low_stock'
                                  ? 'text-amber-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {item.stock}
                            </span>
                            <span className="text-xs text-gray-600 font-bold">{item.unit_measure}(s)</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-gray-700">{item.min_stock} {item.unit_measure}(s)</span>
                            <button
                              onClick={() => openMinStockModal(item)}
                              className="text-gray-400 hover:text-red-600 p-1 rounded"
                              title="Modificar stock mínimo"
                            >
                              <Edit3 size={13} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {item.stock_status === 'available' && (
                            <span className="badge badge-green font-bold text-xs inline-flex items-center gap-1">
                              <CheckCircle2 size={13} /> Disponible
                            </span>
                          )}
                          {item.stock_status === 'low_stock' && (
                            <span className="badge badge-amber font-bold text-xs inline-flex items-center gap-1">
                              <AlertTriangle size={13} /> Stock Bajo
                            </span>
                          )}
                          {item.stock_status === 'out_of_stock' && (
                            <span className="badge badge-red font-bold text-xs inline-flex items-center gap-1">
                              <XCircle size={13} /> Agotado
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openInModal(item)}
                              className="btn btn-sm text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200"
                              title="Ingresar tandas (+)"
                            >
                              <Plus size={13} /> Entrada
                            </button>
                            <button
                              onClick={() => openOutModal(item)}
                              className="btn btn-sm text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200"
                              title="Retirar tandas para cocina (-)"
                            >
                              <Minus size={13} /> Salida
                            </button>
                            <button
                              onClick={() => openAdjustModal(item)}
                              className="btn btn-sm text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-200"
                              title="Ajuste físico de existencias"
                            >
                              <SlidersHorizontal size={13} /> Ajustar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MOVEMENTS HISTORY VIEW */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por insumo, motivo o usuario..."
                className="input pl-9 text-xs"
                value={movSearch}
                onChange={e => setMovSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Tipo:</span>
              <select
                className="select text-xs w-36 font-semibold"
                value={movTypeFilter}
                onChange={e => setMovTypeFilter(e.target.value as any)}
              >
                <option value="all">Todos</option>
                <option value="in">🟢 Entradas (+)</option>
                <option value="out">🔴 Salidas (-)</option>
                <option value="adjustment">🔵 Ajustes (=)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-700">Desde:</span>
              <input
                type="date"
                className="input text-xs w-36"
                value={movStartDate}
                onChange={e => setMovStartDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">Hasta:</span>
              <input
                type="date"
                className="input text-xs w-36"
                value={movEndDate}
                onChange={e => setMovEndDate(e.target.value)}
              />
            </div>

            <button onClick={loadData} className="btn btn-secondary btn-sm text-xs font-bold">
              Filtrar
            </button>
          </div>

          {/* Movements Table */}
          <div className="card overflow-hidden">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Fecha y Hora</th>
                    {(!effectiveBranchId || isSuperAdmin) && <th>Sucursal</th>}
                    <th>Insumo</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Saldo Anterior</th>
                    <th>Saldo Nuevo</th>
                    <th>Usuario Responsable</th>
                    <th>Motivo / Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-gray-400">
                        <History size={36} className="mx-auto mb-2 opacity-30 text-gray-400" />
                        <p className="font-semibold text-sm">No hay movimientos registrados en este período</p>
                      </td>
                    </tr>
                  ) : (
                    movements.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50/60 transition-colors text-xs">
                        <td className="whitespace-nowrap font-medium text-gray-600">
                          {formatDateTime(m.created_at)}
                        </td>
                        {(!effectiveBranchId || isSuperAdmin) && (
                          <td>
                            <span className="badge badge-gray font-semibold">{m.branch_name}</span>
                          </td>
                        )}
                        <td className="font-bold text-gray-900">{m.item_name}</td>
                        <td>
                          {m.movement_type === 'in' && (
                            <span className="badge badge-green font-bold inline-flex items-center gap-1">
                              <Plus size={11} /> Entrada
                            </span>
                          )}
                          {m.movement_type === 'out' && (
                            <span className="badge badge-red font-bold inline-flex items-center gap-1">
                              <Minus size={11} /> Salida
                            </span>
                          )}
                          {m.movement_type === 'adjustment' && (
                            <span className="badge badge-blue font-bold inline-flex items-center gap-1">
                              <SlidersHorizontal size={11} /> Ajuste
                            </span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`font-black text-sm ${
                              m.movement_type === 'in'
                                ? 'text-emerald-700'
                                : m.movement_type === 'out'
                                ? 'text-red-600'
                                : 'text-blue-700'
                            }`}
                          >
                            {m.movement_type === 'in' ? `+${m.quantity}` : m.movement_type === 'out' ? `-${m.quantity}` : m.quantity}
                          </span>
                        </td>
                        <td>
                          <span className="font-bold text-gray-600">{m.unit_measure || 'Und'}</span>
                        </td>
                        <td className="text-gray-500 font-semibold">{m.previous_stock}</td>
                        <td className="text-gray-900 font-black">{m.new_stock}</td>
                        <td>
                          <div>
                            <p className="font-bold text-gray-900">{m.user_name}</p>
                            <p className="text-[10px] text-gray-400">{m.user_role}</p>
                          </div>
                        </td>
                        <td className="max-w-xs truncate text-gray-700 font-medium" title={m.reason}>
                          {m.reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREAR NUEVO INSUMO MAESTRO */}
      <Modal
        isOpen={showCreateItemModal}
        onClose={() => setShowCreateItemModal(false)}
        title="Crear Nuevo Insumo / Materia Prima"
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowCreateItemModal(false)} className="btn btn-secondary flex-1 font-bold">
              Cancelar
            </button>
            <button
              onClick={handleCreateNewItem}
              disabled={creatingItem}
              className="btn btn-primary flex-1 font-bold"
            >
              {creatingItem ? 'Creando...' : 'Crear Insumo'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nombre del Insumo o Materia Prima *</label>
            <input
              className="input font-bold text-sm"
              placeholder="Ej: Saco de Cebolla, Caja de Salsa Ranch, Tanda de Pollo"
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Categoría *</label>
              <select
                className="select text-xs font-semibold"
                value={newItemCategory}
                onChange={e => setNewItemCategory(e.target.value)}
              >
                {SUPPLY_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Unidad de Medida *</label>
              <select
                className="select text-xs font-bold"
                value={newItemUnit}
                onChange={e => setNewItemUnit(e.target.value)}
              >
                {UNIT_MEASURES.map(u => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Costo Unitario Estimado (Lempiras) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">L</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input pl-8 font-bold text-sm"
                placeholder="0.00"
                value={newItemCost}
                onChange={e => setNewItemCost(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Se utilizará para valorizar el inventario de bodega en los reportes contables.
            </p>
          </div>
        </div>
      </Modal>

      {/* MODAL: ENTRADA DE INSUMO */}
      <Modal
        isOpen={showInModal}
        onClose={() => setShowInModal(false)}
        title="Registrar Entrada de Insumo (+)"
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowInModal(false)} className="btn btn-secondary flex-1 font-bold">
              Cancelar
            </button>
            <button
              onClick={() => handleRegisterMovement('in')}
              disabled={actionSubmitting}
              className="btn btn-primary flex-1 font-bold bg-emerald-600 hover:bg-emerald-700"
            >
              {actionSubmitting ? 'Guardando...' : 'Confirmar Entrada'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Sucursal de Destino</label>
            <input
              className="input bg-gray-50 font-bold"
              value={selectedItemForAction?.branch_name || currentBranchName}
              disabled
            />
          </div>

          <div className="form-group">
            <label className="label">Insumo / Materia Prima *</label>
            {selectedItemForAction ? (
              <input className="input bg-gray-50 font-bold" value={selectedItemForAction.item_name} disabled />
            ) : (
              <select
                className="select font-medium text-xs"
                value={actionItemId}
                onChange={e => setActionItemId(e.target.value)}
              >
                {masterItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit_measure})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="form-group">
            <label className="label">Cantidad a Ingresar ({selectedItemUnit}) *</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              className="input font-black text-base text-emerald-700"
              placeholder="Ej: 5"
              value={actionQuantity}
              onChange={e => setActionQuantity(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Motivo / Proveedor / Factura *</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Proveedor Avícola #5412, Compra en mercado"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: SALIDA DE INSUMO */}
      <Modal
        isOpen={showOutModal}
        onClose={() => setShowOutModal(false)}
        title="Registrar Salida de Insumo (-)"
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowOutModal(false)} className="btn btn-secondary flex-1 font-bold">
              Cancelar
            </button>
            <button
              onClick={() => handleRegisterMovement('out')}
              disabled={actionSubmitting}
              className="btn btn-danger flex-1 font-bold"
            >
              {actionSubmitting ? 'Guardando...' : 'Confirmar Salida'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Sucursal</label>
            <input
              className="input bg-gray-50 font-bold"
              value={selectedItemForAction?.branch_name || currentBranchName}
              disabled
            />
          </div>

          <div className="form-group">
            <label className="label">Insumo / Materia Prima *</label>
            {selectedItemForAction ? (
              <input className="input bg-gray-50 font-bold" value={selectedItemForAction.item_name} disabled />
            ) : (
              <select
                className="select font-medium text-xs"
                value={actionItemId}
                onChange={e => setActionItemId(e.target.value)}
              >
                {masterItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit_measure})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedItemForAction && (
            <div className="p-2.5 bg-gray-50 rounded-xl text-xs flex justify-between">
              <span className="text-gray-500 font-bold">Stock Actual en Bodega:</span>
              <span className="font-black text-gray-900">
                {selectedItemForAction.stock} {selectedItemForAction.unit_measure}(s)
              </span>
            </div>
          )}

          <div className="form-group">
            <label className="label">Cantidad a Retirar ({selectedItemUnit}) *</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              className="input font-black text-base text-red-600"
              placeholder="Ej: 2"
              value={actionQuantity}
              onChange={e => setActionQuantity(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Motivo de la Salida *</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Uso en cocina para turno de la tarde, Merma, Dañado"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: AJUSTE DE STOCK FÍSICO */}
      <Modal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        title="Ajuste de Conteo Físico de Insumo (=)"
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowAdjustModal(false)} className="btn btn-secondary flex-1 font-bold">
              Cancelar
            </button>
            <button
              onClick={handleAdjustStock}
              disabled={actionSubmitting}
              className="btn btn-primary flex-1 font-bold bg-blue-600 hover:bg-blue-700"
            >
              {actionSubmitting ? 'Guardando...' : 'Aplicar Ajuste'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
            <p className="font-bold text-sm">{selectedItemForAction?.item_name}</p>
            <p className="text-blue-700">Sucursal: {selectedItemForAction?.branch_name}</p>
            <p className="text-blue-700">
              Existencia registrada: <strong>{selectedItemForAction?.stock} {selectedItemForAction?.unit_measure}(s)</strong>
            </p>
          </div>

          <div className="form-group">
            <label className="label">Existencia Real Contada Físicamente ({selectedItemUnit}) *</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="input font-black text-base text-blue-700"
              value={actionNewStock}
              onChange={e => setActionNewStock(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Motivo / Justificación del Ajuste *</label>
            <input
              type="text"
              className="input"
              placeholder="Ej: Conteo físico quincenal de bodega, Corrección"
              value={actionReason}
              onChange={e => setActionReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: EDITAR STOCK MÍNIMO */}
      <Modal
        isOpen={showMinStockModal}
        onClose={() => setShowMinStockModal(false)}
        title="Configurar Umbral de Stock Mínimo"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowMinStockModal(false)} className="btn btn-secondary flex-1 font-bold">
              Cancelar
            </button>
            <button
              onClick={handleSaveMinStock}
              disabled={actionSubmitting}
              className="btn btn-primary flex-1 font-bold"
            >
              {actionSubmitting ? 'Guardando...' : 'Guardar Umbral'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Insumo: <strong>{selectedItemForAction?.item_name}</strong>
          </p>
          <div className="form-group">
            <label className="label">
              Alerta de Stock Mínimo ({selectedItemForAction?.unit_measure || 'Unidades'}) *
            </label>
            <input
              type="number"
              step="1"
              min="0"
              className="input font-bold"
              value={actionMinStock}
              onChange={e => setActionMinStock(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Cuando las existencias sean menores o iguales a este número, se marcará automáticamente como <strong>Stock Bajo</strong>.
          </p>
        </div>
      </Modal>
    </div>
  )
}
