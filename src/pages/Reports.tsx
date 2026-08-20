import { useEffect, useState } from 'react'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { reportsService } from '../services/reports.service'
import { salesService } from '../services/sales.service'
import { cashTransfersService } from '../services/cashTransfers.service'
import { cashService } from '../services/cash.service'
import { Sale, CashTransfer, CashRegisterRecord } from '../types'
import {
  formatCurrency, formatDateTime, getToday, getWeekStart, getMonthStart, getYearStart,
  paymentMethodLabel, saleStatusLabel
} from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { generateReport, printReport, createReportPdfBlobUrl } from '../utils/pdfReport'
import {
  BarChart3, TrendingUp, Download, Printer, FileText, RefreshCw, Calendar, Eye, X
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts'
import toast from 'react-hot-toast'

type ReportType = 'ventas' | 'top_productos' | 'top_combos' | 'cajeros' | 'sucursales' | 'metodos_pago' | 'envios' | 'cierre_caja'

export default function Reports() {
  const { activeBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [startDate, setStartDate] = useState(getToday())
  const [endDate, setEndDate] = useState(getToday())
  const [activeReport, setActiveReport] = useState<ReportType>('ventas')

  // Estado para la Modal de Vista Previa de PDF real
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)

  const [summary, setSummary] = useState<Record<string, number>>({})
  const [salesList, setSalesList] = useState<Sale[]>([])
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([])
  const [topCombos, setTopCombos] = useState<{ name: string; quantity: number; revenue: number }[]>([])
  const [dailySales, setDailySales] = useState<{ sale_date: string; total_amount: number; total_sales: number }[]>([])
  const [cashierSales, setCashierSales] = useState<{ cashier_name: string; total_amount: number; total_sales: number }[]>([])
  const [branchSales, setBranchSales] = useState<{ branch_name: string; total_amount: number; total_sales: number }[]>([])
  const [transfersList, setTransfersList] = useState<CashTransfer[]>([])
  const [registersList, setRegistersList] = useState<CashRegisterRecord[]>([])

  const branchId = isSuperAdmin ? null : (activeBranch?.id || null)
  const branchName = isSuperAdmin ? 'Todas las sucursales' : (activeBranch?.name || '')

  useEffect(() => { loadReports() }, [activeBranch?.id, startDate, endDate])

  const loadReports = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const [s, sales, tp, tc, ds, cs, bs, trs, regs] = await Promise.all([
        reportsService.getSummary(branchId, startDate, endDate),
        salesService.getSales({ branchId: branchId || undefined, startDate, endDate }),
        reportsService.getTopProducts(branchId, startDate, endDate, 10),
        reportsService.getTopCombos(branchId, startDate, endDate, 10),
        reportsService.getDailySales(branchId, now.getFullYear(), now.getMonth() + 1),
        reportsService.getSalesByCashier(branchId, startDate, endDate),
        isSuperAdmin ? reportsService.getSalesByBranch(startDate, endDate) : Promise.resolve([]),
        cashTransfersService.getTransfers({ branchId: branchId || undefined, startDate, endDate }),
        cashService.getRegisters({ branchId: branchId || undefined, limit: 30 }),
      ])
      setSummary(s || {})
      setSalesList(sales || [])
      setTopProducts((tp || []).map((p: Record<string, unknown>) => ({ name: p.name as string, quantity: Number(p.quantity), revenue: Number(p.revenue) })))
      setTopCombos((tc || []).map((c: Record<string, unknown>) => ({ name: c.name as string, quantity: Number(c.quantity), revenue: Number(c.revenue) })))
      setDailySales((ds || []).map((d: Record<string, unknown>) => ({ sale_date: d.sale_date as string, total_amount: Number(d.total_amount), total_sales: Number(d.total_sales) })))
      setCashierSales((cs || []).map((c: Record<string, unknown>) => ({ cashier_name: c.cashier_name as string, total_amount: Number(c.total_amount), total_sales: Number(c.total_sales) })))
      setBranchSales((bs || []).map((b: Record<string, unknown>) => ({ branch_name: b.branch_name as string, total_amount: Number(b.total_amount), total_sales: Number(b.total_sales) })))
      setTransfersList(trs)
      setRegistersList(regs)
    } catch (err) {
      console.error(err)
      toast.error('Error cargando reportes')
    } finally { setLoading(false) }
  }

  const handleFilter = () => loadReports()

  // Presets de filtro rápido
  const setPresetDate = (type: 'today' | 'week' | 'month' | 'year') => {
    const today = getToday()
    if (type === 'today') {
      setStartDate(today)
      setEndDate(today)
    } else if (type === 'week') {
      setStartDate(getWeekStart())
      setEndDate(today)
    } else if (type === 'month') {
      setStartDate(getMonthStart())
      setEndDate(today)
    } else if (type === 'year') {
      setStartDate(getYearStart())
      setEndDate(today)
    }
  }

  // ── Preparar Datos del Reporte ─────────────────────────────
  const getReportData = () => {
    switch (activeReport) {
      case 'ventas': {
        const completedSales = salesList.filter(s => s.status === 'completed')
        const totalAmount = completedSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
        const totalDiscount = completedSales.reduce((sum, s) => sum + (Number(s.discount_amount) || 0), 0)
        const avgSale = completedSales.length > 0 ? totalAmount / completedSales.length : 0

        return {
          title: 'Historial de Ventas',
          columns: [
            { header: 'N° Venta', dataKey: 'numero', align: 'left' as const, width: 35 },
            { header: 'Fecha y Hora', dataKey: 'fecha', align: 'left' as const, width: 45 },
            { header: 'Sucursal', dataKey: 'sucursal', align: 'left' as const },
            { header: 'Cajero', dataKey: 'cajero', align: 'left' as const },
            { header: 'Método', dataKey: 'metodo', align: 'center' as const, width: 32 },
            { header: 'Estado', dataKey: 'estado', align: 'center' as const, width: 30 },
            { header: 'Total', dataKey: 'total', align: 'right' as const, width: 40 },
          ],
          rows: salesList.map(s => ({
            numero: s.sale_number,
            fecha: formatDateTime(s.created_at),
            sucursal: s.branch_name || '—',
            cajero: s.cashier_name || '—',
            metodo: paymentMethodLabel(s.payment_method),
            estado: saleStatusLabel(s.status),
            total: formatCurrency(s.total, 'L'),
          })),
          summary: [
            { label: 'Total de Transacciones Completadas', value: String(completedSales.length) },
            { label: 'Descuentos Aplicados', value: formatCurrency(totalDiscount, 'L') },
            { label: 'Ticket Promedio', value: formatCurrency(avgSale, 'L') },
            { label: 'INGRESOS TOTALES DEL PERÍODO', value: formatCurrency(totalAmount, 'L'), bold: true },
          ],
        }
      }

      case 'top_productos':
        return {
          title: 'Productos Más Vendidos',
          columns: [
            { header: '#', dataKey: 'rank', align: 'center' as const, width: 12 },
            { header: 'Producto', dataKey: 'nombre', align: 'left' as const },
            { header: 'Unidades Vendidas', dataKey: 'cantidad', align: 'right' as const, width: 45 },
            { header: 'Ingresos', dataKey: 'ingresos', align: 'right' as const, width: 45 },
          ],
          rows: topProducts.map((p, i) => ({
            rank: i + 1,
            nombre: p.name,
            cantidad: p.quantity,
            ingresos: formatCurrency(p.revenue, 'L'),
          })),
          summary: [
            { label: 'Total unidades vendidas', value: String(topProducts.reduce((s, p) => s + p.quantity, 0)) },
            { label: 'Ingresos totales (productos)', value: formatCurrency(topProducts.reduce((s, p) => s + p.revenue, 0), 'L'), bold: true },
          ],
        }

      case 'top_combos':
        return {
          title: 'Combos Más Vendidos',
          columns: [
            { header: '#', dataKey: 'rank', align: 'center' as const, width: 12 },
            { header: 'Combo', dataKey: 'nombre', align: 'left' as const },
            { header: 'Unidades', dataKey: 'cantidad', align: 'right' as const, width: 40 },
            { header: 'Ingresos', dataKey: 'ingresos', align: 'right' as const, width: 45 },
          ],
          rows: topCombos.map((c, i) => ({
            rank: i + 1,
            nombre: c.name,
            cantidad: c.quantity,
            ingresos: formatCurrency(c.revenue, 'L'),
          })),
          summary: [
            { label: 'Total combos vendidos', value: String(topCombos.reduce((s, c) => s + c.quantity, 0)) },
            { label: 'Ingresos totales (combos)', value: formatCurrency(topCombos.reduce((s, c) => s + c.revenue, 0), 'L'), bold: true },
          ],
        }

      case 'cajeros':
        return {
          title: 'Ventas por Cajero',
          columns: [
            { header: 'Cajero', dataKey: 'cajero', align: 'left' as const },
            { header: 'N° Ventas', dataKey: 'ventas', align: 'center' as const, width: 35 },
            { header: 'Total', dataKey: 'total', align: 'right' as const, width: 50 },
          ],
          rows: cashierSales.map(c => ({
            cajero: c.cashier_name,
            ventas: c.total_sales,
            total: formatCurrency(c.total_amount, 'L'),
          })),
          summary: [
            { label: 'Total de ventas', value: String(cashierSales.reduce((s, c) => s + c.total_sales, 0)) },
            { label: 'Ingresos totales', value: formatCurrency(cashierSales.reduce((s, c) => s + c.total_amount, 0), 'L'), bold: true },
          ],
        }

      case 'sucursales':
        return {
          title: 'Ventas por Sucursal',
          columns: [
            { header: 'Sucursal', dataKey: 'sucursal', align: 'left' as const },
            { header: 'N° Ventas', dataKey: 'ventas', align: 'center' as const, width: 35 },
            { header: 'Total', dataKey: 'total', align: 'right' as const, width: 50 },
          ],
          rows: branchSales.map(b => ({
            sucursal: b.branch_name,
            ventas: b.total_sales,
            total: formatCurrency(b.total_amount, 'L'),
          })),
          summary: [
            { label: 'Total de ventas', value: String(branchSales.reduce((s, b) => s + b.total_sales, 0)) },
            { label: 'Ingresos totales', value: formatCurrency(branchSales.reduce((s, b) => s + b.total_amount, 0), 'L'), bold: true },
          ],
        }

      case 'metodos_pago':
        return {
          title: 'Resumen por Método de Pago',
          columns: [
            { header: 'Método', dataKey: 'metodo', align: 'left' as const },
            { header: 'Total', dataKey: 'total', align: 'right' as const, width: 50 },
            { header: 'Participación', dataKey: 'pct', align: 'right' as const, width: 40 },
          ],
          rows: [
            { metodo: 'Efectivo',       total: formatCurrency(Number(summary.cash_amount || 0), 'L'),     pct: summary.total_amount ? `${((Number(summary.cash_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%' },
            { metodo: 'Tarjeta',        total: formatCurrency(Number(summary.card_amount || 0), 'L'),     pct: summary.total_amount ? `${((Number(summary.card_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%' },
            { metodo: 'Transferencia',  total: formatCurrency(Number(summary.transfer_amount || 0), 'L'), pct: summary.total_amount ? `${((Number(summary.transfer_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%' },
            { metodo: 'Otro',           total: formatCurrency(Number(summary.other_amount || 0), 'L'),    pct: summary.total_amount ? `${((Number(summary.other_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%' },
          ],
          summary: [
            { label: 'Total Ingresos', value: formatCurrency(Number(summary.total_amount || 0), 'L'), bold: true },
          ],
        }

      case 'envios':
        return {
          title: 'Envíos / Retiros de Efectivo',
          columns: [
            { header: 'Fecha y Hora', dataKey: 'fecha', align: 'left' as const },
            { header: 'Enviado por', dataKey: 'remitente', align: 'left' as const },
            { header: 'Recibido por', dataKey: 'destinatario', align: 'left' as const },
            { header: 'Motivo', dataKey: 'motivo', align: 'left' as const },
            { header: 'Monto (L)', dataKey: 'monto', align: 'right' as const, width: 45 },
          ],
          rows: transfersList.map(t => ({
            fecha: `${t.transfer_date || ''} ${t.transfer_time || ''}`,
            remitente: t.sender_name || 'Cajero',
            destinatario: t.recipient_name,
            motivo: t.reason,
            monto: formatCurrency(t.amount, 'L'),
          })),
          summary: [
            { label: 'Total Retiros / Envíos', value: String(transfersList.length) },
            { label: 'MONTO TOTAL RETIRADO', value: formatCurrency(transfersList.reduce((s, t) => s + Number(t.amount), 0), 'L'), bold: true },
          ],
        }

      case 'cierre_caja':
        return {
          title: 'Cierres de Caja y Arqueos',
          columns: [
            { header: 'Apertura', dataKey: 'apertura', align: 'left' as const },
            { header: 'Cajero', dataKey: 'cajero', align: 'left' as const },
            { header: 'Fondo Inicial', dataKey: 'inicial', align: 'right' as const },
            { header: 'Ventas Totales', dataKey: 'ventas', align: 'right' as const },
            { header: 'Retiros', dataKey: 'retiros', align: 'right' as const },
            { header: 'Esperado', dataKey: 'esperado', align: 'right' as const },
            { header: 'Diferencia', dataKey: 'diferencia', align: 'right' as const },
          ],
          rows: registersList.map(r => ({
            apertura: r.opened_at ? new Date(r.opened_at).toLocaleDateString('es-HN') : '—',
            cajero: r.cashier_name || 'Cajero',
            inicial: formatCurrency(r.opening_amount, 'L'),
            ventas: formatCurrency(r.total_amount || 0, 'L'),
            retiros: formatCurrency(r.total_transfers || 0, 'L'),
            esperado: formatCurrency(r.expected_cash || 0, 'L'),
            diferencia: r.difference !== null && r.difference !== undefined ? formatCurrency(r.difference, 'L') : '—',
          })),
          summary: [
            { label: 'Total Cierres Registrados', value: String(registersList.length) },
          ],
        }

      default:
        return { title: 'Reporte', columns: [], rows: [], summary: [] }
    }
  }

  const handleGeneratePdf = async () => {
    setPdfLoading(true)
    try {
      const data = getReportData()
      const filename = `Reporte_${data.title.replace(/\s+/g, '_')}_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.pdf`

      await generateReport(
        {
          title: data.title,
          startDate,
          endDate,
          branchName,
        },
        data.columns,
        data.rows as Record<string, string | number>[],
        data.summary,
        filename
      )
      toast.success('PDF generado correctamente')
    } catch (err) {
      console.error(err)
      toast.error('Error al generar PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const handlePrint = async () => {
    setPdfLoading(true)
    try {
      const data = getReportData()
      await printReport(
        { title: data.title, startDate, endDate, branchName },
        data.columns,
        data.rows as Record<string, string | number>[],
        data.summary
      )
    } catch (err) {
      console.error(err)
      toast.error('Error al preparar impresión')
    } finally {
      setPdfLoading(false)
    }
  }

  const handleOpenPdfModal = async () => {
    setPdfLoading(true)
    try {
      const data = getReportData()
      const url = await createReportPdfBlobUrl(
        { title: data.title, startDate, endDate, branchName },
        data.columns,
        data.rows as Record<string, string | number>[],
        data.summary
      )
      setPdfBlobUrl(url)
      setPdfModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('Error al preparar vista previa del PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) return <PageLoader />

  const REPORT_TABS: { id: ReportType; label: string }[] = [
    { id: 'ventas', label: '📋 Historial de Ventas' },
    { id: 'envios', label: '💸 Envíos de Efectivo' },
    { id: 'cierre_caja', label: '🏦 Cierres de Caja' },
    { id: 'top_productos', label: '🍗 Top Productos' },
    { id: 'top_combos', label: '🍱 Top Combos' },
    { id: 'cajeros', label: '👤 Por Cajero' },
    ...(isSuperAdmin ? [{ id: 'sucursales' as ReportType, label: '🏠 Por Sucursal' }] : []),
    { id: 'metodos_pago', label: '💳 Resumen Métodos' },
  ]

  const todayStr = getToday()
  const isToday = startDate === todayStr && endDate === todayStr
  const isWeek = startDate === getWeekStart() && endDate === todayStr
  const isMonth = startDate === getMonthStart() && endDate === todayStr
  const isYear = startDate === getYearStart() && endDate === todayStr

  const currentReportData = getReportData()

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <BarChart3 size={24} className="text-red-600" /> Reportes de Ventas
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Consulta el historial, exporta informes en PDF y analiza el rendimiento por período.
          </p>
        </div>

        {/* Filtros de Fecha */}
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
          {/* Botones Rápidos de Período */}
          <div className="flex gap-1 border-r border-gray-200 pr-2 mr-1">
            <button
              onClick={() => setPresetDate('today')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isToday ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-red-700'
              }`}
            >
              Hoy (Día)
            </button>
            <button
              onClick={() => setPresetDate('week')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isWeek ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-red-700'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setPresetDate('month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isMonth ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-red-700'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setPresetDate('year')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isYear ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-red-700'
              }`}
            >
              Este Año
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar size={14} className="text-amber-500" />
            <input
              type="date"
              className="input py-1 text-xs w-32 border-gray-200"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span>a</span>
            <input
              type="date"
              className="input py-1 text-xs w-32 border-gray-200"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          <button onClick={handleFilter} className="btn btn-primary btn-sm bg-red-600 hover:bg-red-700 border-red-600">
            <RefreshCw size={13} /> Consultar
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total ventas', value: Number(summary.total_sales || 0), fmt: false, color: 'bg-red-50 border-red-200 text-red-600' },
          { label: 'Ingresos totales', value: Number(summary.total_amount || 0), fmt: true, color: 'bg-amber-50 border-amber-200 text-amber-600' },
          { label: 'Ticket promedio', value: Number(summary.avg_sale || 0), fmt: true, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
          { label: 'Descuentos', value: Number(summary.total_discount || 0), fmt: true, color: 'bg-rose-50 border-rose-200 text-rose-600' },
        ].map(s => (
          <div key={s.label} className={`card p-4 border ${s.color}`}>
            <p className="text-xs uppercase tracking-wide font-bold">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 font-display mt-1">
              {s.fmt ? formatCurrency(s.value, 'L') : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ══ SECCIÓN DE EXPORTACIÓN Y VISTA PREVIA INTERACTIVA ══════════════ */}
      <div className="card border border-amber-200 shadow-sm">
        <div className="card-header bg-gradient-to-r from-red-600 to-amber-500 text-white rounded-t-2xl flex items-center justify-between">
          <h2 className="font-bold text-white font-display flex items-center gap-2">
            <FileText size={18} />
            Exportar e Inspeccionar Reporte PDF — {currentReportData.title}
          </h2>
          <span className="text-xs bg-amber-400 text-red-950 font-bold px-2.5 py-0.5 rounded-full">
            Pollo Crispy
          </span>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-600 mb-4">
            Selecciona la pestaña para cambiar el reporte. A continuación puedes ver la <strong>Vista Previa del Documento</strong> exactamente con los colores de marca (Rojo y Amarillo), columnas y totales correspondientes al período del <strong>{startDate}</strong> al <strong>{endDate}</strong>.
          </p>

          {/* Tabs de tipo de reporte */}
          <div className="flex flex-wrap gap-2 mb-5">
            {REPORT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeReport === tab.id
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-yellow-100 hover:text-red-700 border border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Barra de Acciones Principales */}
          <div className="flex flex-wrap justify-between items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl p-3 mb-5">
            <div className="text-xs text-gray-700">
              <span className="font-bold text-red-700 uppercase tracking-wide">Reporte Activo:</span>{' '}
              <strong className="text-gray-900">{currentReportData.title}</strong> · Registros:{' '}
              <strong>{currentReportData.rows.length}</strong>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleOpenPdfModal}
                disabled={pdfLoading}
                className="btn bg-gray-800 hover:bg-black text-white border-gray-800 text-xs shadow-sm"
              >
                <Eye size={14} />
                👁️ Vista Previa Documento PDF
              </button>

              <button
                onClick={handleGeneratePdf}
                disabled={pdfLoading}
                className="btn bg-red-600 hover:bg-red-700 text-white border-red-600 text-xs shadow-sm"
              >
                {pdfLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {pdfLoading ? 'Generando...' : '📄 Descargar PDF'}
              </button>

              <button
                onClick={handlePrint}
                disabled={pdfLoading}
                className="btn bg-amber-500 hover:bg-amber-600 text-white border-amber-500 text-xs shadow-sm"
              >
                <Printer size={14} />
                🖨️ Imprimir
              </button>
            </div>
          </div>

          {/* ══ MOCKUP VISTA PREVIA VISUAL DE LA HOJA DEL REPORTE ══════════════ */}
          <div className="border-2 border-red-500 rounded-2xl shadow-lg bg-white overflow-hidden">
            {/* Encabezado Rojo del Documento */}
            <div className="bg-red-600 text-white p-4 relative">
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <img src="/LogoCrispyBueno.png" alt="Pollo Crispy" className="w-12 h-12 object-contain bg-white/10 rounded-xl p-1" />
                  <div>
                    <h3 className="text-xl font-bold font-display tracking-tight leading-none text-white">POLLO CRISPY</h3>
                    <p className="text-sm font-bold text-amber-300 mt-1">{currentReportData.title}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-red-100 leading-relaxed font-mono">
                  <p>Período: <strong className="text-white">{startDate} — {endDate}</strong></p>
                  <p>Sucursal: <strong className="text-white">{branchName}</strong></p>
                </div>
              </div>
              {/* Franja decorativa Amarilla */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-amber-400" />
            </div>

            {/* Tabla de la Vista Previa */}
            <div className="p-4 bg-gray-50">
              <div className="table-wrapper bg-white rounded-xl border border-gray-200 overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-red-600 text-white font-bold sticky top-0 z-10">
                    <tr>
                      {currentReportData.columns.map(col => (
                        <th
                          key={col.dataKey}
                          className={`py-2.5 px-3 uppercase tracking-wider ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentReportData.rows.length === 0 ? (
                      <tr>
                        <td colSpan={currentReportData.columns.length} className="text-center py-8 text-gray-400 font-medium">
                          No hay datos registrados en el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      currentReportData.rows.map((rowItem, rIdx) => {
                        const rowObj = rowItem as Record<string, unknown>
                        return (
                          <tr key={rIdx} className="even:bg-red-50/40 hover:bg-amber-50/60 transition-colors">
                            {currentReportData.columns.map(col => {
                              const val = rowObj[col.dataKey]
                              return (
                                <td
                                  key={col.dataKey}
                                  className={`py-2 px-3 ${
                                    col.align === 'right' ? 'text-right font-mono font-medium' : col.align === 'center' ? 'text-center' : 'text-left'
                                  }`}
                                >
                                  {val !== undefined && val !== null ? String(val) : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Caja de Resumen del Documento */}
              {currentReportData.summary && currentReportData.summary.length > 0 && (
                <div className="mt-4 bg-amber-50 border-2 border-red-500 rounded-xl p-4 shadow-sm">
                  <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp size={14} /> RESUMEN DEL REPORTE
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {currentReportData.summary.map((sumItem, sIdx) => {
                      const sum = sumItem as { label: string; value: string; bold?: boolean }
                      return (
                        <div key={sIdx} className={`p-2.5 rounded-lg ${sum.bold ? 'bg-red-600 text-white font-bold' : 'bg-white text-gray-800 border border-amber-200'}`}>
                          <p className={`text-[10px] uppercase font-bold ${sum.bold ? 'text-amber-300' : 'text-gray-500'}`}>{sum.label}</p>
                          <p className="text-sm font-bold font-mono mt-0.5">{sum.value}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ MODAL DE VISTA PREVIA DEL DOCUMENTO PDF REAL ══════════════ */}
      <Modal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        title={`Vista Previa PDF — ${currentReportData.title}`}
        size="xl"
        footer={
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-gray-500 font-mono">Documento A4 Horizontal (Landscape)</span>
            <div className="flex gap-2">
              <button onClick={() => setPdfModalOpen(false)} className="btn btn-secondary text-xs">
                Cerrar
              </button>
              <button onClick={handleGeneratePdf} className="btn bg-red-600 hover:bg-red-700 text-white text-xs">
                <Download size={14} /> Descargar PDF
              </button>
              <button onClick={handlePrint} className="btn bg-amber-500 hover:bg-amber-600 text-white text-xs">
                <Printer size={14} /> Imprimir
              </button>
            </div>
          </div>
        }
      >
        {pdfBlobUrl ? (
          <iframe
            src={pdfBlobUrl}
            title="Vista previa PDF"
            className="w-full h-[600px] rounded-xl border border-gray-200 shadow-inner"
          />
        ) : (
          <div className="py-20 text-center text-gray-400">Cargando vista previa...</div>
        )}
      </Modal>

      {/* Gráfica de ventas diarias */}
      {dailySales.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-gray-900 font-display">Ventas Diarias — Mes Actual</h2>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sale_date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `L${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v, 'L'), 'Ventas']} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="total_amount" stroke="#dc2626" strokeWidth={2} dot={{ fill: '#dc2626', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Desglose visual por productos y combos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        {topProducts.length > 0 && (
          <div className="card">
            <div className="card-header"><h2 className="font-bold text-gray-900 font-display">Top Productos</h2></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topProducts.slice(0, 7)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110}
                    tickFormatter={n => n.length > 16 ? n.slice(0, 15) + '...' : n} />
                  <Tooltip formatter={(v: number) => [v, 'Unidades']} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Bar dataKey="quantity" fill="#dc2626" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top combos */}
        {topCombos.length > 0 && (
          <div className="card">
            <div className="card-header"><h2 className="font-bold text-gray-900 font-display">Top Combos</h2></div>
            <div className="card-body space-y-3">
              {topCombos.slice(0, 5).map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(c.quantity / topCombos[0].quantity) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-900">{c.quantity} uds.</p>
                    <p className="text-xs text-red-600 font-bold">{formatCurrency(c.revenue, 'L')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
