import { useEffect, useState } from 'react'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { reportsService } from '../services/reports.service'
import { formatCurrency, getToday, getMonthStart } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import { generateReport, printReport } from '../utils/pdfReport'
import {
  BarChart3, TrendingUp, Download, Printer, FileText, RefreshCw
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts'
import toast from 'react-hot-toast'

type ReportType = 'ventas' | 'top_productos' | 'top_combos' | 'cajeros' | 'sucursales' | 'metodos_pago'

export default function Reports() {
  const { activeBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [activeReport, setActiveReport] = useState<ReportType>('ventas')

  const [summary, setSummary] = useState<Record<string, number>>({})
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([])
  const [topCombos, setTopCombos] = useState<{ name: string; quantity: number; revenue: number }[]>([])
  const [dailySales, setDailySales] = useState<{ sale_date: string; total_amount: number; total_sales: number }[]>([])
  const [cashierSales, setCashierSales] = useState<{ cashier_name: string; total_amount: number; total_sales: number }[]>([])
  const [branchSales, setBranchSales] = useState<{ branch_name: string; total_amount: number; total_sales: number }[]>([])

  const branchId = isSuperAdmin ? null : (activeBranch?.id || null)
  const branchName = isSuperAdmin ? 'Todas las sucursales' : (activeBranch?.name || '')

  useEffect(() => { loadReports() }, [activeBranch?.id])

  const loadReports = async () => {
    setLoading(true)
    try {
      const now = new Date()
      const [s, tp, tc, ds, cs, bs] = await Promise.all([
        reportsService.getSummary(branchId, startDate, endDate),
        reportsService.getTopProducts(branchId, startDate, endDate, 10),
        reportsService.getTopCombos(branchId, startDate, endDate, 10),
        reportsService.getDailySales(branchId, now.getFullYear(), now.getMonth() + 1),
        reportsService.getSalesByCashier(branchId, startDate, endDate),
        isSuperAdmin ? reportsService.getSalesByBranch(startDate, endDate) : Promise.resolve([]),
      ])
      setSummary(s || {})
      setTopProducts((tp || []).map((p: Record<string, unknown>) => ({ name: p.name as string, quantity: Number(p.quantity), revenue: Number(p.revenue) })))
      setTopCombos((tc || []).map((c: Record<string, unknown>) => ({ name: c.name as string, quantity: Number(c.quantity), revenue: Number(c.revenue) })))
      setDailySales((ds || []).map((d: Record<string, unknown>) => ({ sale_date: d.sale_date as string, total_amount: Number(d.total_amount), total_sales: Number(d.total_sales) })))
      setCashierSales((cs || []).map((c: Record<string, unknown>) => ({ cashier_name: c.cashier_name as string, total_amount: Number(c.total_amount), total_sales: Number(c.total_sales) })))
      setBranchSales((bs || []).map((b: Record<string, unknown>) => ({ branch_name: b.branch_name as string, total_amount: Number(b.total_amount), total_sales: Number(b.total_sales) })))
    } catch (err) {
      console.error(err)
      toast.error('Error cargando reportes')
    } finally { setLoading(false) }
  }

  const handleFilter = () => loadReports()

  // ── PDF / Impresión ──────────────────────────────────────────
  const getReportData = () => {
    switch (activeReport) {
      case 'ventas':
        return {
          title: 'Reporte de Ventas',
          columns: [
            { header: 'Método de Pago', dataKey: 'metodo', align: 'left' as const },
            { header: 'N° Transacciones', dataKey: 'transacciones', align: 'center' as const, width: 40 },
            { header: 'Total', dataKey: 'total', align: 'right' as const, width: 45 },
            { header: '% del Total', dataKey: 'porcentaje', align: 'right' as const, width: 35 },
          ],
          rows: [
            {
              metodo: 'Efectivo',
              transacciones: Number(summary.cash_sales || 0),
              total: formatCurrency(Number(summary.cash_amount || 0), 'L'),
              porcentaje: summary.total_amount ? `${((Number(summary.cash_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%',
            },
            {
              metodo: 'Tarjeta',
              transacciones: Number(summary.card_sales || 0),
              total: formatCurrency(Number(summary.card_amount || 0), 'L'),
              porcentaje: summary.total_amount ? `${((Number(summary.card_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%',
            },
            {
              metodo: 'Transferencia',
              transacciones: Number(summary.transfer_sales || 0),
              total: formatCurrency(Number(summary.transfer_amount || 0), 'L'),
              porcentaje: summary.total_amount ? `${((Number(summary.transfer_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%',
            },
            {
              metodo: 'Otro',
              transacciones: Number(summary.other_sales || 0),
              total: formatCurrency(Number(summary.other_amount || 0), 'L'),
              porcentaje: summary.total_amount ? `${((Number(summary.other_amount || 0) / Number(summary.total_amount)) * 100).toFixed(1)}%` : '0%',
            },
          ],
          summary: [
            { label: 'Total de Transacciones', value: String(Number(summary.total_sales || 0)) },
            { label: 'Descuentos Aplicados', value: formatCurrency(Number(summary.total_discount || 0), 'L') },
            { label: 'Ticket Promedio', value: formatCurrency(Number(summary.avg_sale || 0), 'L') },
            { label: 'INGRESOS TOTALES', value: formatCurrency(Number(summary.total_amount || 0), 'L'), bold: true },
          ],
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
          title: 'Ventas por Método de Pago',
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

      default:
        return { title: 'Reporte', columns: [], rows: [], summary: [] }
    }
  }

  const handleGeneratePdf = async () => {
    setPdfLoading(true)
    try {
      const data = getReportData()
      const today = new Date()
      const dateTag = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`
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

  if (loading) return <PageLoader />

  const REPORT_TABS: { id: ReportType; label: string }[] = [
    { id: 'ventas', label: '💰 Ventas' },
    { id: 'top_productos', label: '🍗 Top Productos' },
    { id: 'top_combos', label: '🍱 Top Combos' },
    { id: 'cajeros', label: '👤 Por Cajero' },
    ...(isSuperAdmin ? [{ id: 'sucursales' as ReportType, label: '🏠 Por Sucursal' }] : []),
    { id: 'metodos_pago', label: '💳 Métodos de Pago' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <BarChart3 size={22} className="text-orange-500" /> Reportes
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          <input type="date" className="input w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span className="text-gray-400 text-sm">a</span>
          <input type="date" className="input w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
          <button onClick={handleFilter} className="btn btn-primary">
            <RefreshCw size={14} /> Consultar
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total ventas', value: Number(summary.total_sales || 0), fmt: false, color: 'bg-blue-100 text-blue-600' },
          { label: 'Ingresos totales', value: Number(summary.total_amount || 0), fmt: true, color: 'bg-orange-100 text-orange-600' },
          { label: 'Ticket promedio', value: Number(summary.avg_sale || 0), fmt: true, color: 'bg-green-100 text-green-600' },
          { label: 'Descuentos', value: Number(summary.total_discount || 0), fmt: true, color: 'bg-red-100 text-red-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 font-display mt-1">
              {s.fmt ? formatCurrency(s.value, 'L') : s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Métodos de pago */}
      <div className="card card-body">
        <h2 className="font-bold text-gray-900 font-display mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-orange-500" /> Ventas por Método de Pago
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Efectivo', value: Number(summary.cash_amount || 0), color: 'border-green-400' },
            { label: 'Tarjeta', value: Number(summary.card_amount || 0), color: 'border-blue-400' },
            { label: 'Transferencia', value: Number(summary.transfer_amount || 0), color: 'border-purple-400' },
            { label: 'Otro', value: Number(summary.other_amount || 0), color: 'border-gray-400' },
          ].map(p => (
            <div key={p.label} className={`bg-gray-50 rounded-xl p-3 border-l-4 ${p.color}`}>
              <p className="text-xs text-gray-500 font-medium">{p.label}</p>
              <p className="font-bold text-gray-900 mt-0.5">{formatCurrency(p.value, 'L')}</p>
              <p className="text-xs text-gray-400">
                {summary.total_amount ? ((p.value / Number(summary.total_amount)) * 100).toFixed(1) : 0}%
              </p>
            </div>
          ))}
        </div>
      </div>

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
                <Line type="monotone" dataKey="total_amount" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
                  <Bar dataKey="quantity" fill="#f97316" radius={[0, 4, 4, 0]} />
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
                  <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${(c.quantity / topCombos[0].quantity) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-gray-900">{c.quantity} uds.</p>
                    <p className="text-xs text-orange-600">{formatCurrency(c.revenue, 'L')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Por cajero */}
      {cashierSales.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-gray-900 font-display">Ventas por Cajero</h2>
          </div>
          <div className="table-wrapper rounded-none border-0">
            <table>
              <thead><tr><th>Cajero</th><th>N° Ventas</th><th>Total</th></tr></thead>
              <tbody>
                {cashierSales.map(c => (
                  <tr key={c.cashier_name}>
                    <td className="font-medium">{c.cashier_name}</td>
                    <td>{c.total_sales}</td>
                    <td className="font-bold">{formatCurrency(c.total_amount, 'L')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Por sucursal */}
      {isSuperAdmin && branchSales.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-gray-900 font-display">Ventas por Sucursal</h2>
          </div>
          <div className="table-wrapper rounded-none border-0">
            <table>
              <thead><tr><th>Sucursal</th><th>N° Ventas</th><th>Total</th></tr></thead>
              <tbody>
                {branchSales.map(b => (
                  <tr key={b.branch_name}>
                    <td className="font-medium">{b.branch_name}</td>
                    <td>{b.total_sales}</td>
                    <td className="font-bold">{formatCurrency(b.total_amount, 'L')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SECCIÓN PDF ══════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-gray-900 font-display flex items-center gap-2">
            <FileText size={18} className="text-orange-500" />
            Exportar Reporte PDF
          </h2>
        </div>
        <div className="card-body">
          <p className="text-sm text-gray-500 mb-4">
            Selecciona el tipo de reporte y genera un PDF horizontal con logo, tablas y totales.
            Los datos corresponden al período seleccionado: <strong>{startDate}</strong> → <strong>{endDate}</strong>
          </p>

          {/* Tabs de tipo de reporte */}
          <div className="flex flex-wrap gap-2 mb-5">
            {REPORT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveReport(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeReport === tab.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Vista previa del reporte seleccionado */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Reporte seleccionado</p>
            <p className="text-sm font-bold text-gray-900">{getReportData().title}</p>
            <p className="text-xs text-gray-500 mt-1">
              {getReportData().rows.length} filas · {startDate} → {endDate}
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleGeneratePdf}
              disabled={pdfLoading}
              className="btn btn-primary"
            >
              {pdfLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {pdfLoading ? 'Generando...' : '📄 Descargar PDF'}
            </button>

            <button
              onClick={handlePrint}
              disabled={pdfLoading}
              className="btn btn-secondary"
            >
              <Printer size={16} />
              🖨️ Imprimir
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-3">
            El PDF se genera en formato horizontal (A4 landscape) con logo de Pollo Crispy,
            encabezado, tabla de datos y resumen de totales.
          </p>
        </div>
      </div>
    </div>
  )
}
