import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { expensesService } from '../services/expenses.service'
import { Expense, ExpenseCategory, ExpensePaymentMethod } from '../types'
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
  DollarSign,
  Banknote,
  CreditCard,
  PieChart,
  Layers,
  Building,
} from 'lucide-react'
import toast from 'react-hot-toast'

const DEFAULT_EXPENSE_CATEGORIES = [
  'Servicios',
  'Transporte',
  'Mantenimiento',
  'Limpieza',
  'Gas',
  'Hielo',
  'Empaques',
  'Alquiler',
  'Personal',
  'Compras menores',
  'Otros',
]

type ExpenseReportTab = 'all_expenses' | 'by_category' | 'by_method' | 'by_branch'

export default function ExpenseReports() {
  const { profile } = useAuth()
  const { branches, activeBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()

  const [activeTab, setActiveTab] = useState<ExpenseReportTab>('all_expenses')
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMethod, setSelectedMethod] = useState<ExpensePaymentMethod | 'all'>('all')

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
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
  }, [effectiveBranchId, startDate, endDate, selectedCategory, selectedMethod])

  const loadReportData = async () => {
    setLoading(true)
    try {
      const [cats, list] = await Promise.all([
        expensesService.getCategories(),
        expensesService.getExpenses({
          branchId: effectiveBranchId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
          paymentMethod: selectedMethod !== 'all' ? selectedMethod : undefined,
          status: 'active', // Solo gastos activos para reportes financieros
          limit: 2000,
        }),
      ])
      setCategories(cats)
      setExpenses(list)
    } catch (err) {
      console.error(err)
      toast.error('Error cargando datos de reportes de gastos')
    } finally {
      setLoading(false)
    }
  }

  const displayCategories = useMemo(() => {
    if (categories.length > 0) return categories
    return DEFAULT_EXPENSE_CATEGORIES.map((name, idx) => ({
      id: `cat-${idx + 1}`,
      name,
      is_active: true,
      created_at: '',
    }))
  }, [categories])

  const branchDisplayName = useMemo(() => {
    if (isSuperAdmin && !selectedBranchId) return 'Todas las sucursales (Consolidado)'
    const b = branches.find(x => x.id === (isSuperAdmin ? selectedBranchId : activeBranch?.id))
    return b ? b.name : activeBranch?.name || 'Mi Sucursal'
  }, [branches, selectedBranchId, activeBranch, isSuperAdmin])

  // KPIs
  const kpis = useMemo(() => {
    return expensesService.calculateMetrics(expenses)
  }, [expenses])

  // Group by Category
  const byCategoryData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>()
    expenses.forEach(e => {
      const existing = map.get(e.category_name) || { name: e.category_name, total: 0, count: 0 }
      existing.total += Number(e.amount || 0)
      existing.count += 1
      map.set(e.category_name, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [expenses])

  // Group by Payment Method
  const byMethodData = useMemo(() => {
    const methods: { key: ExpensePaymentMethod; label: string; icon: string }[] = [
      { key: 'cash', label: 'Efectivo (Caja)', icon: '💵' },
      { key: 'card', label: 'Tarjeta de Débito/Crédito', icon: '💳' },
      { key: 'transfer', label: 'Transferencia Bancaria', icon: '🔄' },
      { key: 'other', label: 'Otro / Crédito', icon: '📑' },
    ]

    return methods.map(m => {
      const items = expenses.filter(e => e.payment_method === m.key)
      const total = items.reduce((sum, e) => sum + Number(e.amount || 0), 0)
      return {
        key: m.key,
        label: m.label,
        icon: m.icon,
        total,
        count: items.length,
        percentage: kpis.totalExpenses > 0 ? (total / kpis.totalExpenses) * 100 : 0,
      }
    })
  }, [expenses, kpis.totalExpenses])

  // Group by Branch (for Super Admin)
  const byBranchData = useMemo(() => {
    const map = new Map<string, { branchName: string; total: number; count: number; cashTotal: number }>()
    expenses.forEach(e => {
      const bName = e.branch_name || 'Sin sucursal'
      const existing = map.get(bName) || { branchName: bName, total: 0, count: 0, cashTotal: 0 }
      existing.total += Number(e.amount || 0)
      existing.count += 1
      if (e.payment_method === 'cash') existing.cashTotal += Number(e.amount || 0)
      map.set(bName, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [expenses])

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    setExporting(true)
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      const filename = `Reporte_Gastos_${branchDisplayName.replace(/\s+/g, '_')}_${dateStr}.xlsx`

      if (activeTab === 'all_expenses') {
        exportToExcel(
          filename,
          'Gastos Detallados',
          expenses.map(e => ({
            Fecha: formatDateTime(e.created_at),
            Sucursal: e.branch_name || branchDisplayName,
            Categoría: e.category_name,
            Descripción: e.description,
            'Monto (L)': Number(e.amount.toFixed(2)),
            'Método de Pago': e.payment_method === 'cash' ? 'Efectivo' : e.payment_method === 'card' ? 'Tarjeta' : e.payment_method === 'transfer' ? 'Transferencia' : 'Otro',
            'Nº Comprobante': e.receipt_number || '',
            'Registrado Por': e.created_by_name || 'Usuario',
            'Rol Usuario': e.created_by_role || '',
            'Autorizado Por': e.authorized_by_name || 'Pendiente',
            Estado: e.status === 'active' ? 'Activo' : 'Anulado',
            Notas: e.notes || '',
          }))
        )
      } else if (activeTab === 'by_category') {
        exportToExcel(
          filename,
          'Por Categoría',
          byCategoryData.map((c, i) => ({
            '#': i + 1,
            Categoría: c.name,
            'Total Gastado (L)': Number(c.total.toFixed(2)),
            'Cantidad de Gastos': c.count,
            'Porcentaje del Total': `${kpis.totalExpenses > 0 ? ((c.total / kpis.totalExpenses) * 100).toFixed(1) : 0}%`,
          }))
        )
      } else if (activeTab === 'by_method') {
        exportToExcel(
          filename,
          'Por Método Pago',
          byMethodData.map(m => ({
            'Método de Pago': m.label,
            'Total Gastado (L)': Number(m.total.toFixed(2)),
            'Cantidad de Gastos': m.count,
            'Porcentaje': `${m.percentage.toFixed(1)}%`,
          }))
        )
      } else if (activeTab === 'by_branch') {
        exportToExcel(
          filename,
          'Por Sucursal',
          byBranchData.map(b => ({
            Sucursal: b.branchName,
            'Total Gastos (L)': Number(b.total.toFixed(2)),
            'Gastos en Efectivo (L)': Number(b.cashTotal.toFixed(2)),
            'Cantidad de Gastos': b.count,
            'Porcentaje del Total': `${kpis.totalExpenses > 0 ? ((b.total / kpis.totalExpenses) * 100).toFixed(1) : 0}%`,
          }))
        )
      }
      toast.success('Reporte exportado a Excel correctamente')
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
      await generateReport(
        {
          title: 'REPORTE OFICIAL DE GASTOS OPERATIVOS',
          branchName: branchDisplayName,
          startDate,
          endDate,
        },
        [
          { header: 'Fecha', dataKey: 'date' },
          { header: 'Sucursal', dataKey: 'branch' },
          { header: 'Categoría', dataKey: 'category' },
          { header: 'Descripción', dataKey: 'desc' },
          { header: 'Método', dataKey: 'method', align: 'center' },
          { header: 'Monto', dataKey: 'amount', align: 'right' },
          { header: 'Registrado Por', dataKey: 'user' },
        ],
        expenses.map(e => ({
          date: formatDateTime(e.created_at),
          branch: e.branch_name || branchDisplayName,
          category: e.category_name,
          desc: e.description,
          method: e.payment_method === 'cash' ? 'Efectivo' : e.payment_method === 'card' ? 'Tarjeta' : e.payment_method === 'transfer' ? 'Transfer.' : 'Otro',
          amount: formatCurrency(e.amount, 'L'),
          user: e.created_by_name || 'Usuario',
        })),
        [
          { label: 'Total Gastos en Efectivo (Salida de Caja):', value: formatCurrency(kpis.cashExpenses, 'L') },
          { label: 'Total Tarjeta / Bancos / Transferencia:', value: formatCurrency(kpis.cardExpenses + kpis.transferExpenses, 'L') },
          { label: 'TOTAL GENERAL DE GASTOS OPERATIVOS:', value: formatCurrency(kpis.totalExpenses, 'L'), bold: true },
        ],
        `Gastos_${branchDisplayName.replace(/\s+/g, '_')}`
      )
      toast.success('Reporte PDF generado y descargado')
    } catch (err) {
      console.error(err)
      toast.error('Error al generar PDF')
    } finally {
      setExporting(false)
    }
  }

  if (loading && expenses.length === 0) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/gastos"
              className="text-xs font-bold text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} /> Volver a Gastos
            </Link>
          </div>
          <h1 className="text-2xl font-black text-gray-900 font-display flex items-center gap-2.5">
            <FileSpreadsheet size={28} className="text-red-600" /> Reportes de Gastos Operativos
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
            <MapPin size={13} className="text-red-600" />
            Análisis financiero y control de egresos para: <strong>{branchDisplayName}</strong>
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
            className="btn btn-primary font-bold text-xs shadow-md flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Printer size={14} />
            <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
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
              <option value="">Todas las sucursales (Consolidado)</option>
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
            <span>Sucursal: {branchDisplayName}</span>
          </div>
        )}

        {/* Date Range */}
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

        {/* Categoría */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            className="select select-sm text-xs w-36 bg-white"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="all">Todas categorías</option>
            {displayCategories.map(c => (
              <option key={c.id || c.name} value={c.id || c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Método */}
        <div className="flex items-center gap-2">
          <select
            className="select select-sm text-xs w-36 bg-white"
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value as any)}
          >
            <option value="all">Todos los pagos</option>
            <option value="cash">💵 Efectivo</option>
            <option value="card">💳 Tarjeta</option>
            <option value="transfer">🔄 Transferencia</option>
            <option value="other">📑 Otro</option>
          </select>
        </div>

        <button onClick={loadReportData} className="btn btn-secondary btn-sm text-xs font-bold ml-auto">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3.5 border-t-4 border-t-red-600">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total General de Gastos</span>
          <span className="text-2xl font-black text-red-600 font-display">
            {formatCurrency(kpis.totalExpenses, 'L')}
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">{kpis.count} egresos registrados</span>
        </div>

        <div className="card p-3.5 border-t-4 border-t-amber-500">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Gastos en Efectivo (Caja)</span>
          <span className="text-2xl font-black text-amber-600 font-display">
            {formatCurrency(kpis.cashExpenses, 'L')}
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">
            {kpis.totalExpenses > 0 ? ((kpis.cashExpenses / kpis.totalExpenses) * 100).toFixed(1) : 0}% del total de gastos
          </span>
        </div>

        <div className="card p-3.5 border-t-4 border-t-blue-600">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Bancos / Tarjetas / Transfer.</span>
          <span className="text-2xl font-black text-blue-600 font-display">
            {formatCurrency(kpis.cardExpenses + kpis.transferExpenses, 'L')}
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">Pagos sin afectar caja física</span>
        </div>

        <div className="card p-3.5 border-t-4 border-t-purple-600">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Categoría de Mayor Gasto</span>
          <span className="text-lg font-black text-purple-700 font-display truncate block">
            {byCategoryData[0]?.name || 'N/A'}
          </span>
          <span className="text-[11px] text-gray-500 block mt-0.5">
            {byCategoryData[0] ? formatCurrency(byCategoryData[0].total, 'L') : 'L 0.00'}
          </span>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto no-scrollbar pb-1">
        <button
          onClick={() => setActiveTab('all_expenses')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'all_expenses'
              ? 'bg-red-600 text-white shadow-md shadow-red-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          📋 Gastos Detallados ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab('by_category')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'by_category'
              ? 'bg-red-600 text-white shadow-md shadow-red-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          📂 Gastos por Categoría ({byCategoryData.length})
        </button>

        <button
          onClick={() => setActiveTab('by_method')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
            activeTab === 'by_method'
              ? 'bg-red-600 text-white shadow-md shadow-red-200'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          💳 Gastos por Método de Pago
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('by_branch')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
              activeTab === 'by_branch'
                ? 'bg-red-600 text-white shadow-md shadow-red-200'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            🏢 Comparativa por Sucursal ({byBranchData.length})
          </button>
        )}
      </div>

      {/* TAB CONTENT */}

      {/* 1. Detallado */}
      {activeTab === 'all_expenses' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  {(!effectiveBranchId || isSuperAdmin) && <th>Sucursal</th>}
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Comprobante</th>
                  <th>Método</th>
                  <th>Monto</th>
                  <th>Registrado Por</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      No hay gastos registrados en este período.
                    </td>
                  </tr>
                ) : (
                  expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50/60 text-xs">
                      <td className="whitespace-nowrap font-medium text-gray-600">{formatDateTime(e.created_at)}</td>
                      {(!effectiveBranchId || isSuperAdmin) && <td>{e.branch_name}</td>}
                      <td>
                        <span className="font-bold text-gray-800">{e.category_name}</span>
                      </td>
                      <td className="font-semibold text-gray-900 max-w-xs truncate" title={e.description}>
                        {e.description}
                      </td>
                      <td className="text-gray-500">{e.receipt_number || '-'}</td>
                      <td>
                        <span className="capitalize font-bold text-gray-700">
                          {e.payment_method === 'cash' ? '💵 Efectivo' : e.payment_method === 'card' ? '💳 Tarjeta' : e.payment_method === 'transfer' ? '🔄 Transf.' : '📑 Otro'}
                        </span>
                      </td>
                      <td className="font-black text-gray-900 text-sm font-display">
                        {formatCurrency(e.amount, 'L')}
                      </td>
                      <td>
                        <span className="text-gray-600">{e.created_by_name}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Por Categoría */}
      {activeTab === 'by_category' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Categoría</th>
                  <th>Total Gastado</th>
                  <th>Cantidad de Egresos</th>
                  <th>% del Total</th>
                </tr>
              </thead>
              <tbody>
                {byCategoryData.map((c, i) => {
                  const pct = kpis.totalExpenses > 0 ? (c.total / kpis.totalExpenses) * 100 : 0
                  return (
                    <tr key={c.name} className="hover:bg-gray-50/60 text-xs">
                      <td className="font-bold text-gray-400">{i + 1}</td>
                      <td className="font-bold text-gray-900 text-sm">{c.name}</td>
                      <td className="font-black text-red-600 text-sm font-display">{formatCurrency(c.total, 'L')}</td>
                      <td className="font-semibold text-gray-700">{c.count} gastos</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-red-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-gray-600 text-[11px]">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Por Método de Pago */}
      {activeTab === 'by_method' && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Método de Pago</th>
                  <th>Total Gastado</th>
                  <th>Cantidad de Egresos</th>
                  <th>Afecta Efectivo de Caja</th>
                  <th>% del Total</th>
                </tr>
              </thead>
              <tbody>
                {byMethodData.map(m => (
                  <tr key={m.key} className="hover:bg-gray-50/60 text-xs">
                    <td className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <span>{m.icon}</span> {m.label}
                    </td>
                    <td className="font-black text-gray-900 text-sm font-display">{formatCurrency(m.total, 'L')}</td>
                    <td className="font-semibold text-gray-700">{m.count} egresos</td>
                    <td>
                      {m.key === 'cash' ? (
                        <span className="badge badge-amber font-bold text-[10px]">Sí (Descuenta en Cierre)</span>
                      ) : (
                        <span className="badge badge-gray font-semibold text-[10px]">No (Bancos / Digital)</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${m.percentage}%` }} />
                        </div>
                        <span className="font-bold text-gray-600 text-[11px]">{m.percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Por Sucursal (Super Admin) */}
      {activeTab === 'by_branch' && isSuperAdmin && (
        <div className="card overflow-hidden">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Sucursal</th>
                  <th>Total Gastos</th>
                  <th>Gastos en Efectivo</th>
                  <th>Otros Métodos</th>
                  <th>Cantidad de Gastos</th>
                  <th>% del Total</th>
                </tr>
              </thead>
              <tbody>
                {byBranchData.map(b => {
                  const pct = kpis.totalExpenses > 0 ? (b.total / kpis.totalExpenses) * 100 : 0
                  return (
                    <tr key={b.branchName} className="hover:bg-gray-50/60 text-xs">
                      <td className="font-bold text-gray-900 text-sm flex items-center gap-2">
                        <Building size={14} className="text-gray-400" /> {b.branchName}
                      </td>
                      <td className="font-black text-red-600 text-sm font-display">{formatCurrency(b.total, 'L')}</td>
                      <td className="font-bold text-amber-700">{formatCurrency(b.cashTotal, 'L')}</td>
                      <td className="font-semibold text-blue-700">{formatCurrency(b.total - b.cashTotal, 'L')}</td>
                      <td className="font-semibold text-gray-700">{b.count}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-bold text-gray-600 text-[11px]">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
