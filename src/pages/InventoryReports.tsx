import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { inventoryService } from '../services/inventory.service'
import {
  BranchInventoryItem,
  InventoryMovement,
  InventoryMovementType,
} from '../types'
import { formatCurrency, formatDateTime, getToday, getMonthStart } from '../utils'
import { exportToExcel } from '../utils/excelExport'
import { generateReport } from '../utils/pdfReport'
import { PageLoader } from '../components/ui/EmptyState'
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  MapPin,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'

type InventoryReportType = 'current_stock' | 'critical_stock' | 'movements_summary' | 'top_movements' | 'full_kardex'

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

export default function InventoryReports() {
  const { profile } = useAuth()
  const { branches, activeBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()

  const [activeReport, setActiveReport] = useState<InventoryReportType>('current_stock')
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMovementType, setSelectedMovementType] = useState<InventoryMovementType | 'all'>('all')

  const [inventory, setInventory] = useState<BranchInventoryItem[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const effectiveBranchId = isSuperAdmin ? selectedBranchId : activeBranch?.id || ''

  useEffect(() => {
    if (!isSuperAdmin && activeBranch?.id) {
      setSelectedBranchId(activeBranch.id)
    }
  }, [activeBranch?.id, isSuperAdmin])

  useEffect(() => {
    loadReportData()
  }, [effectiveBranchId, startDate, endDate, selectedMovementType])

  const loadReportData = async () => {
    setLoading(true)
    try {
      const [inv, movs] = await Promise.all([
        inventoryService.getInventory({ branchId: effectiveBranchId || undefined }),
        inventoryService.getMovements({
          branchId: effectiveBranchId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          movementType: selectedMovementType !== 'all' ? selectedMovementType : undefined,
          limit: 1000,
        }),
      ])
      setInventory(inv)
      setMovements(movs)
    } catch (err) {
      console.error(err)
      toast.error('Error cargando datos del reporte de insumos')
    } finally {
      setLoading(false)
    }
  }

  // Branch Name
  const branchDisplayName = useMemo(() => {
    if (isSuperAdmin && !selectedBranchId) return 'Todas las sucursales'
    const b = branches.find(x => x.id === (isSuperAdmin ? selectedBranchId : activeBranch?.id))
    return b ? b.name : activeBranch?.name || 'Mi Sucursal'
  }, [branches, selectedBranchId, activeBranch, isSuperAdmin])

  // Filtered Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false
      return true
    })
  }, [inventory, selectedCategory])

  // Critical stock
  const criticalItems = useMemo(() => {
    return filteredInventory.filter(
      item => item.stock_status === 'low_stock' || item.stock_status === 'out_of_stock'
    )
  }, [filteredInventory])

  // Top moved items
  const topMovedItems = useMemo(() => {
    const map = new Map<string, { name: string; category: string; unit: string; ins: number; outs: number; total: number }>()

    movements.forEach(m => {
      const existing = map.get(m.item_id) || {
        name: m.item_name,
        category: m.category || 'General',
        unit: m.unit_measure || 'Unidad',
        ins: 0,
        outs: 0,
        total: 0,
      }
      if (m.movement_type === 'in') existing.ins += m.quantity
      if (m.movement_type === 'out') existing.outs += m.quantity
      existing.total += m.quantity
      map.set(m.item_id, existing)
    })

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }, [movements])

  // KPIs
  const kpis = useMemo(() => {
    const totalVal = filteredInventory.reduce((s, i) => s + i.total_value, 0)
    const inMovements = movements.filter(m => m.movement_type === 'in')
    const outMovements = movements.filter(m => m.movement_type === 'out')
    const adjustMovements = movements.filter(m => m.movement_type === 'adjustment')

    const totalQtyIn = inMovements.reduce((s, m) => s + m.quantity, 0)
    const totalQtyOut = outMovements.reduce((s, m) => s + m.quantity, 0)

    return {
      totalVal,
      totalItemsCount: filteredInventory.length,
      inCount: inMovements.length,
      outCount: outMovements.length,
      adjustCount: adjustMovements.length,
      totalQtyIn,
      totalQtyOut,
      lowStockCount: filteredInventory.filter(i => i.stock_status === 'low_stock').length,
      outOfStockCount: filteredInventory.filter(i => i.stock_status === 'out_of_stock').length,
    }
  }, [filteredInventory, movements])

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    setExporting(true)
    try {
      const dateStr = new Date().toISOString().split('T')[0]

      if (activeReport === 'current_stock' || activeReport === 'critical_stock') {
        const dataset = activeReport === 'critical_stock' ? criticalItems : filteredInventory
        const filename = `Reporte_Tandas_${branchDisplayName.replace(/\s+/g, '_')}_${dateStr}.xlsx`

        exportToExcel(
          filename,
          'Tandas de Pollo',
          dataset.map(item => ({
            Sucursal: item.branch_name || branchDisplayName,
            Insumo: item.item_name,
            'Tandas Disponibles': item.stock,
            'Stock Mínimo': item.min_stock,
            Estado:
              item.stock_status === 'available'
                ? 'Disponible'
                : item.stock_status === 'low_stock'
                ? 'Stock Bajo'
                : 'Agotado',
            'Última Actualización': formatDateTime(item.updated_at),
          }))
        )
        toast.success('Reporte exportado a Excel')
      } else if (activeReport === 'full_kardex' || activeReport === 'movements_summary') {
        const filename = `Kardex_Tandas_${branchDisplayName.replace(/\s+/g, '_')}_${dateStr}.xlsx`

        exportToExcel(
          filename,
          'Movimientos',
          movements.map(m => ({
            Fecha: formatDateTime(m.created_at),
            Sucursal: m.branch_name || branchDisplayName,
            Insumo: m.item_name,
            'Tipo Movimiento':
              m.movement_type === 'in' ? 'Entrada' : m.movement_type === 'out' ? 'Salida' : 'Ajuste',
            'Cantidad (Tandas)': m.quantity,
            'Stock Anterior': m.previous_stock,
            'Stock Nuevo': m.new_stock,
            Usuario: m.user_name || 'Sistema',
            'Rol Usuario': m.user_role || '',
            'Motivo / Observación': m.reason,
          }))
        )
        toast.success('Kardex exportado a Excel')
      } else if (activeReport === 'top_movements') {
        const filename = `Tandas_Rotacion_${dateStr}.xlsx`
        exportToExcel(
          filename,
          'Top Movimientos',
          topMovedItems.map((p, idx) => ({
            Posición: idx + 1,
            Insumo: p.name,
            'Total Ingresado (+)': `${p.ins} Tandas`,
            'Total Retirado (-)': `${p.outs} Tandas`,
            'Rotación Total': `${p.total} Tandas`,
          }))
        )
        toast.success('Top movimientos exportado a Excel')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al exportar a Excel')
    } finally {
      setExporting(false)
    }
  }

  // EXPORT TO PDF
  const handleExportPdf = async () => {
    setExporting(true)
    try {
      if (activeReport === 'current_stock' || activeReport === 'critical_stock') {
        const dataset = activeReport === 'critical_stock' ? criticalItems : filteredInventory
        const title =
          activeReport === 'critical_stock'
            ? 'REPORTE DE TANDAS DE POLLO EN STOCK CRÍTICO'
            : 'REPORTE DE DISPONIBILIDAD DE TANDAS DE POLLO'

        const totalTandas = dataset.reduce((s, i) => s + (Number(i.stock) || 0), 0)

        await generateReport(
          {
            title,
            branchName: branchDisplayName,
            startDate: getToday(),
            endDate: getToday(),
          },
          [
            { header: 'Insumo', dataKey: 'item' },
            { header: 'Sucursal', dataKey: 'branch' },
            { header: 'Tandas Disp.', dataKey: 'stock', align: 'center' },
            { header: 'Stock Mín.', dataKey: 'min_stock', align: 'center' },
            { header: 'Estado', dataKey: 'status', align: 'center' },
          ],
          dataset.map(i => ({
            item: i.item_name,
            branch: i.branch_name || branchDisplayName,
            stock: `${i.stock} Tandas`,
            min_stock: `${i.min_stock} Tandas`,
            status:
              i.stock_status === 'available' ? 'Disponible' : i.stock_status === 'low_stock' ? 'Stock Bajo' : 'Agotado',
          })),
          [
            { label: 'TOTAL TANDAS DISPONIBLES:', value: `${totalTandas} Tandas`, bold: true },
          ],
          `Tandas_${branchDisplayName.replace(/\s+/g, '_')}`
        )
        toast.success('Reporte PDF descargado')
      } else if (activeReport === 'full_kardex' || activeReport === 'movements_summary') {
        await generateReport(
          {
            title: 'KARDEX DE MOVIMIENTOS DE INSUMOS Y MATERIA PRIMA',
            branchName: branchDisplayName,
            startDate,
            endDate,
          },
          [
            { header: 'Fecha', dataKey: 'date' },
            { header: 'Insumo', dataKey: 'item' },
            { header: 'Tipo', dataKey: 'type', align: 'center' },
            { header: 'Cant.', dataKey: 'qty', align: 'center' },
            { header: 'Unidad', dataKey: 'unit', align: 'center' },
            { header: 'Saldo', dataKey: 'balance', align: 'center' },
            { header: 'Usuario', dataKey: 'user' },
            { header: 'Motivo', dataKey: 'reason' },
          ],
          movements.map(m => ({
            date: formatDateTime(m.created_at),
            item: m.item_name,
            type: m.movement_type === 'in' ? 'Entrada' : m.movement_type === 'out' ? 'Salida' : 'Ajuste',
            qty: (m.movement_type === 'in' ? '+' : m.movement_type === 'out' ? '-' : '') + m.quantity,
            unit: m.unit_measure || 'Und',
            balance: `${m.previous_stock} → ${m.new_stock}`,
            user: m.user_name || 'Sistema',
            reason: m.reason,
          })),
          [
            { label: 'Total Entradas (+):', value: `${kpis.inCount} registros (${kpis.totalQtyIn} unidades)` },
            { label: 'Total Salidas (-):', value: `${kpis.outCount} registros (${kpis.totalQtyOut} unidades)` },
            { label: 'Total Ajustes (=):', value: `${kpis.adjustCount} registros` },
          ],
          `Kardex_Insumos_${branchDisplayName.replace(/\s+/g, '_')}`
        )
        toast.success('Kardex PDF descargado')
      } else if (activeReport === 'top_movements') {
        await generateReport(
          {
            title: 'INSUMOS CON MAYOR ROTACIÓN Y CONSUMO',
            branchName: branchDisplayName,
            startDate,
            endDate,
          },
          [
            { header: '#', dataKey: 'pos', align: 'center' },
            { header: 'Insumo', dataKey: 'item' },
            { header: 'Categoría', dataKey: 'category' },
            { header: 'Unidad', dataKey: 'unit', align: 'center' },
            { header: 'Entradas (+)', dataKey: 'ins', align: 'center' },
            { header: 'Salidas (-)', dataKey: 'outs', align: 'center' },
            { header: 'Total Rotación', dataKey: 'total', align: 'center' },
          ],
          topMovedItems.map((p, idx) => ({
            pos: (idx + 1).toString(),
            item: p.name,
            category: p.category,
            unit: p.unit,
            ins: p.ins.toString(),
            outs: p.outs.toString(),
            total: p.total.toString(),
          })),
          [{ label: 'Total de Insumos Analizados:', value: topMovedItems.length.toString(), bold: true }],
          `Top_Rotacion_Insumos_${branchDisplayName.replace(/\s+/g, '_')}`
        )
        toast.success('Reporte PDF descargado')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error al generar PDF')
    } finally {
      setExporting(false)
    }
  }

  if (loading && inventory.length === 0 && movements.length === 0) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/inventario" className="text-gray-400 hover:text-red-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-black text-gray-900 font-display flex items-center gap-2">
              <FileSpreadsheet size={26} className="text-emerald-600" /> Reportes de Insumos y Bodega
            </h1>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5 ml-7">
            <MapPin size={13} className="text-red-600" />
            Control analítico de insumos para: <strong>{branchDisplayName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="btn btn-secondary font-bold text-xs shadow-sm flex items-center gap-1.5 border-emerald-300 hover:bg-emerald-50 text-emerald-800"
          >
            <Download size={14} className="text-emerald-600" />
            <span>Exportar Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="btn btn-primary font-bold text-xs shadow-md flex items-center gap-1.5"
          >
            <Printer size={14} />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {/* Selector de Sucursal y Filtros Principales */}
      <div className="card p-4 flex flex-wrap items-center gap-4 bg-gray-50/70 border-gray-200">
        {/* Branch selector for Super Admin */}
        {isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-red-600 shrink-0" />
            <span className="text-xs font-bold text-gray-700">Sucursal:</span>
            <select
              className="select select-sm text-xs font-bold w-52 bg-white"
              value={selectedBranchId}
              onChange={e => setSelectedBranchId(e.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700">
            <MapPin size={14} className="text-red-600" />
            <span>Sucursal Asignada: {branchDisplayName}</span>
          </div>
        )}

        {/* Date Range for movements */}
        {(activeReport === 'movements_summary' ||
          activeReport === 'full_kardex' ||
          activeReport === 'top_movements') && (
          <>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-600">Desde:</span>
              <input
                type="date"
                className="input input-sm text-xs w-36 bg-white"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600">Hasta:</span>
              <input
                type="date"
                className="input input-sm text-xs w-36 bg-white"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Category filter for stock */}
        {(activeReport === 'current_stock' || activeReport === 'critical_stock') && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600">Categoría:</span>
            <select
              className="select select-sm text-xs w-52 bg-white"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {SUPPLY_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <button onClick={loadReportData} className="btn btn-secondary btn-sm text-xs font-bold ml-auto">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* KPI Cards enfocadas únicamente en Tandas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3.5 border-t-4 border-t-emerald-600 bg-emerald-50/20">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Tandas Disponibles</span>
          <span className="text-2xl font-black text-emerald-700 font-display">
            {filteredInventory.reduce((s, i) => s + (Number(i.stock) || 0), 0)} <span className="text-xs font-bold text-gray-500">Tandas</span>
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">En {branchDisplayName}</span>
        </div>

        <div className="card p-3.5 border-t-4 border-t-blue-600">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Entradas del Período</span>
          <span className="text-2xl font-black text-blue-600 font-display">+{kpis.totalQtyIn} <span className="text-xs font-bold text-gray-500">Tandas</span></span>
          <span className="text-[11px] text-gray-500 block mt-0.5">{kpis.inCount} registros de entrada</span>
        </div>

        <div className="card p-3.5 border-t-4 border-t-red-500">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Salidas a Cocina (Período)</span>
          <span className="text-2xl font-black text-red-500 font-display">-{kpis.totalQtyOut} <span className="text-xs font-bold text-gray-500">Tandas</span></span>
          <span className="text-[11px] text-gray-500 block mt-0.5">{kpis.outCount} registros de salida</span>
        </div>

        <div className="card p-3.5 border-t-4 border-t-amber-500">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Alertas de Stock</span>
          <span className="text-2xl font-black text-amber-600 font-display">
            {kpis.lowStockCount + kpis.outOfStockCount}
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">
            {kpis.lowStockCount} stock bajo, {kpis.outOfStockCount} agotadas
          </span>
        </div>
      </div>

      {/* Report Sub-Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveReport('current_stock')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeReport === 'current_stock'
              ? 'bg-red-600 text-white shadow-md shadow-red-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          🍗 Disponibilidad de Tandas
        </button>

        <button
          onClick={() => setActiveReport('critical_stock')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeReport === 'critical_stock'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          ⚠️ Stock Crítico ({criticalItems.length})
        </button>

        <button
          onClick={() => setActiveReport('top_movements')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeReport === 'top_movements'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          🔥 Rotación / Consumo
        </button>

        <button
          onClick={() => setActiveReport('full_kardex')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeReport === 'full_kardex'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          📋 Kardex / Auditoría de Movimientos
        </button>
      </div>

      {/* REPORT CONTENT TABLES */}

      {/* 1. Existencias de Tandas */}
      {activeReport === 'current_stock' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  {(!effectiveBranchId || isSuperAdmin) && <th>Sucursal</th>}
                  <th>Tandas Disponibles</th>
                  <th>Stock Mínimo</th>
                  <th>Estado</th>
                  <th>Última Actualización</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => (
                  <tr key={`${item.branch_id}-${item.item_id}`} className="hover:bg-gray-50/60 text-xs">
                    <td className="font-bold text-gray-900 flex items-center gap-2">
                      <span>🍗</span> {item.item_name}
                    </td>
                    {(!effectiveBranchId || isSuperAdmin) && <td>{item.branch_name}</td>}
                    <td className="font-black text-emerald-700 text-sm">{item.stock} Tandas</td>
                    <td className="text-gray-500 font-bold">{item.min_stock} Tandas</td>
                    <td>
                      <span
                        className={`badge ${
                          item.stock_status === 'available'
                            ? 'badge-green'
                            : item.stock_status === 'low_stock'
                            ? 'badge-amber'
                            : 'badge-red'
                        } font-bold text-[11px]`}
                      >
                        {item.stock_status === 'available'
                          ? 'Disponible'
                          : item.stock_status === 'low_stock'
                          ? 'Stock Bajo'
                          : 'Agotado'}
                      </span>
                    </td>
                    <td className="text-gray-500">{formatDateTime(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Stock Crítico */}
      {activeReport === 'critical_stock' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  {(!effectiveBranchId || isSuperAdmin) && <th>Sucursal</th>}
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Existencia Actual</th>
                  <th>Stock Mínimo</th>
                  <th>Faltante para Mínimo</th>
                  <th>Estado Crítico</th>
                </tr>
              </thead>
              <tbody>
                {criticalItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      <p className="font-bold text-emerald-600 text-sm">
                        🎉 ¡Excelente! Todos los insumos cuentan con existencias por encima del mínimo.
                      </p>
                    </td>
                  </tr>
                ) : (
                  criticalItems.map(item => (
                    <tr key={`${item.branch_id}-${item.item_id}`} className="hover:bg-gray-50/60 text-xs">
                      <td className="font-bold text-gray-900">{item.item_name}</td>
                      {(!effectiveBranchId || isSuperAdmin) && <td>{item.branch_name}</td>}
                      <td>{item.category}</td>
                      <td>
                        <span className="badge badge-gray font-bold">{item.unit_measure}</span>
                      </td>
                      <td className="font-black text-red-600 text-sm">{item.stock}</td>
                      <td className="font-bold text-gray-700">{item.min_stock}</td>
                      <td className="font-bold text-amber-700">
                        {Math.max(0, item.min_stock - item.stock)} {item.unit_measure}(s)
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.stock_status === 'out_of_stock' ? 'badge-red' : 'badge-amber'
                          } font-extrabold`}
                        >
                          {item.stock_status === 'out_of_stock' ? '🔴 AGOTADO' : '⚠️ STOCK BAJO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Top Rotación */}
      {activeReport === 'top_movements' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Total Ingresado (+)</th>
                  <th>Total Retirado (-)</th>
                  <th>Rotación Total</th>
                </tr>
              </thead>
              <tbody>
                {topMovedItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No hay registros de movimientos en este rango de fechas
                    </td>
                  </tr>
                ) : (
                  topMovedItems.map((p, idx) => (
                    <tr key={p.name} className="hover:bg-gray-50/60 text-xs">
                      <td className="font-bold text-gray-400">{idx + 1}</td>
                      <td className="font-bold text-gray-900">{p.name}</td>
                      <td>{p.category}</td>
                      <td>{p.unit}</td>
                      <td className="font-bold text-emerald-700">+{p.ins}</td>
                      <td className="font-bold text-red-600">-{p.outs}</td>
                      <td className="font-black text-gray-900 text-sm">{p.total} {p.unit}(s)</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Kardex Completo */}
      {activeReport === 'full_kardex' && (
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
                  <th>Saldo Posterior</th>
                  <th>Usuario</th>
                  <th>Motivo / Observación</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50/60 text-xs">
                    <td className="whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                    {(!effectiveBranchId || isSuperAdmin) && <td>{m.branch_name}</td>}
                    <td className="font-bold text-gray-900">{m.item_name}</td>
                    <td>
                      <span
                        className={`badge ${
                          m.movement_type === 'in'
                            ? 'badge-green'
                            : m.movement_type === 'out'
                            ? 'badge-red'
                            : 'badge-blue'
                        } font-bold text-[10px]`}
                      >
                        {m.movement_type === 'in' ? 'Entrada' : m.movement_type === 'out' ? 'Salida' : 'Ajuste'}
                      </span>
                    </td>
                    <td
                      className={`font-black ${
                        m.movement_type === 'in'
                          ? 'text-emerald-700'
                          : m.movement_type === 'out'
                          ? 'text-red-600'
                          : 'text-blue-700'
                      }`}
                    >
                      {m.movement_type === 'in' ? `+${m.quantity}` : m.movement_type === 'out' ? `-${m.quantity}` : m.quantity}
                    </td>
                    <td className="font-bold text-gray-600">{m.unit_measure || 'Und'}</td>
                    <td className="text-gray-500">{m.previous_stock}</td>
                    <td className="font-bold text-gray-900">{m.new_stock}</td>
                    <td className="font-semibold">{m.user_name}</td>
                    <td className="max-w-xs truncate text-gray-600" title={m.reason}>
                      {m.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
