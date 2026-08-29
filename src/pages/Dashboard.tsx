import { useEffect, useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { reportsService } from '../services/reports.service'
import { salesService } from '../services/sales.service'
import {
  formatCurrency,
  getToday,
  getMonthStart,
  getYearStart,
  getWeekStart,
  formatDate,
  formatTime,
} from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import { supabase } from '../lib/supabase'
import {
  TrendingUp,
  ShoppingBag,
  Store,
  DollarSign,
  Package,
  Plus,
  Calendar,
  Filter,
  MapPin,
  Banknote,
  Receipt,
  ArrowUpRight,
  CreditCard,
  Building2,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'

// Colores corporativos oficiales de Pollo Crispy (Rojo, Ámbar, Azul, Esmeralda)
const POLLO_COLORS = ['#dc2626', '#f59e0b', '#2563eb', '#10b981']

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom'

interface ChartPoint {
  label: string
  total: number
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { branches, activeBranch, setActiveBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()
  const navigate = useNavigate()

  // Cajero no tiene acceso a panel administrativo
  if (profile?.role === 'CAJERO') {
    return <Navigate to="/pos" replace />
  }

  // Filtros de fecha
  const [period, setPeriod] = useState<PeriodType>('month')
  const [customStart, setCustomStart] = useState(getMonthStart())
  const [customEnd, setCustomEnd] = useState(getToday())

  // Filtro de sucursal en dashboard (para Super Admin permite alternar o ver todas)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')

  useEffect(() => {
    if (activeBranch) {
      setSelectedBranchId(activeBranch.id)
    } else if (isSuperAdmin) {
      setSelectedBranchId('')
    }
  }, [activeBranch?.id, isSuperAdmin])

  const [loading, setLoading] = useState(true)
  const [summaryData, setSummaryData] = useState<Record<string, number>>({})
  const [todayData, setTodayData] = useState<Record<string, number>>({})
  const [trendData, setTrendData] = useState<ChartPoint[]>([])
  const [branchStats, setBranchStats] = useState<{ id?: string; name: string; today_amount?: number; total_amount?: number }[]>([])
  const [recentSales, setRecentSales] = useState<import('../types').Sale[]>([])
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([])

  useEffect(() => {
    loadDashboard()
  }, [period, customStart, customEnd, selectedBranchId])

  const getDateRange = () => {
    const today = getToday()
    const pad = (n: number) => String(n).padStart(2, '0')
    if (period === 'today') return { start: today, end: today }
    if (period === 'week') {
      const d = new Date()
      const day = d.getDay() // 0 = Dom, 1 = Lun, ..., 6 = Sab
      const diffToMon = d.getDate() - (day === 0 ? 6 : day - 1)
      const monday = new Date(d.getFullYear(), d.getMonth(), diffToMon)
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
      return {
        start: `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`,
        end: `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`,
      }
    }
    if (period === 'month') return { start: getMonthStart(), end: today }
    if (period === 'year') return { start: getYearStart(), end: today }
    return { start: customStart || getMonthStart(), end: customEnd || today }
  }

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const effectiveBranchId = selectedBranchId ? selectedBranchId : null
      const today = getToday()
      const pad = (n: number) => String(n).padStart(2, '0')

      const [periodSummary, todaySummary, recent, branchesComparison] = await Promise.all([
        reportsService.getSummary(effectiveBranchId, start, end),
        reportsService.getSummary(effectiveBranchId, today, today),
        salesService.getSales({ branchId: effectiveBranchId || undefined, limit: 6 }),
        isSuperAdmin ? reportsService.getBranchStats() : Promise.resolve([]),
      ])

      setSummaryData(periodSummary || {})
      setTodayData(todaySummary || {})
      setRecentSales(recent || [])
      setBranchStats(branchesComparison || [])

      // Cargar tendencia de ventas en base al período
      let salesQuery = supabase
        .from('sales')
        .select('total, created_at, status')
        .gte('created_at', `${start}T00:00:00`)
        .lte('created_at', `${end}T23:59:59`)
        .eq('status', 'completed')
        .order('created_at', { ascending: true })

      if (effectiveBranchId) {
        salesQuery = salesQuery.eq('branch_id', effectiveBranchId)
      }

      const { data: salesList } = await salesQuery

      if (period === 'today') {
        // Agrupar por horas del día
        const hoursMap: Record<number, number> = {}
        for (let h = 8; h <= 22; h += 2) hoursMap[h] = 0
        ;(salesList || []).forEach((s: { total: number; created_at: string }) => {
          const hour = new Date(s.created_at).getHours()
          const bucket = Math.floor(hour / 2) * 2
          if (hoursMap[bucket] !== undefined) hoursMap[bucket] += Number(s.total || 0)
        })
        setTrendData(
          Object.entries(hoursMap).map(([h, val]) => ({
            label: `${h}:00`,
            total: val,
          }))
        )
      } else if (period === 'year') {
        // Agrupar los 12 meses en español
        const SPANISH_MONTHS_SHORT = [
          'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
          'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
        ]
        const monthly = await reportsService.getMonthlySales(
          effectiveBranchId,
          new Date().getFullYear()
        )
        const monthTotals: number[] = Array(12).fill(0)
        ;(monthly || []).forEach((m: any) => {
          let idx = -1
          if (m.month && m.month >= 1 && m.month <= 12) {
            idx = m.month - 1
          } else if (m.month_num && m.month_num >= 1 && m.month_num <= 12) {
            idx = m.month_num - 1
          } else if (m.month_name) {
            const raw = String(m.month_name).toLowerCase().trim()
            const enMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
            const esMonths = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
            idx = esMonths.findIndex(e => raw.startsWith(e))
            if (idx === -1) idx = enMonths.findIndex(e => raw.startsWith(e))
          }
          if (idx >= 0 && idx < 12) {
            monthTotals[idx] = Number(m.total_amount || 0)
          }
        })

        setTrendData(
          SPANISH_MONTHS_SHORT.map((name, i) => ({
            label: name,
            total: monthTotals[i] || 0,
          }))
        )
      } else {
        // Agrupar por días asegurando semana completa y etiquetas en español
        const dailyMap: Record<string, number> = {}
        ;(salesList || []).forEach((s: { total: number; created_at: string }) => {
          const day = s.created_at.split('T')[0]
          dailyMap[day] = (dailyMap[day] || 0) + Number(s.total || 0)
        })

        const sDate = new Date(`${start}T12:00:00`)
        const eDate = new Date(`${end}T12:00:00`)
        const points: ChartPoint[] = []
        for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
          const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
          const weekday = d.toLocaleDateString('es-HN', { weekday: 'short' }).replace('.', '').toLowerCase()
          const dayNum = d.getDate()
          points.push({
            label: `${weekday} ${dayNum}`,
            total: dailyMap[key] || 0,
          })
        }
        setTrendData(points)
      }

      // Distribución de métodos de pago
      if (periodSummary) {
        setPaymentData(
          [
            { name: 'Efectivo', value: Number(periodSummary.cash_amount || 0) },
            { name: 'Tarjeta', value: Number(periodSummary.card_amount || 0) },
            { name: 'Transferencia', value: Number(periodSummary.transfer_amount || 0) },
            { name: 'Otro', value: Number(periodSummary.other_amount || 0) },
          ].filter(d => d.value > 0)
        )
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoader />

  const currency = 'L'
  const totalSalesPeriod = Number(summaryData.total_amount || 0)
  const countSalesPeriod = Number(summaryData.total_sales || 0)
  const todayTotal = Number(todayData.total_amount || 0)
  const todayCount = Number(todayData.total_sales || 0)
  const avgTicket = Number(summaryData.avg_sale || 0)
  const cashTotal = Number(summaryData.cash_amount || 0)

  const totalPaymentSum = paymentData.reduce((acc, curr) => acc + curr.value, 0)

  const periodLabels: Record<PeriodType, string> = {
    today: 'Hoy',
    week: 'Esta Semana',
    month: 'Este Mes',
    year: 'Este Año',
    custom: 'Personalizado',
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── 1. HEADER & BARRA DE FILTROS ROJO POLLO CRISPY ─────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-gray-900 font-display">
              Buenos días, {profile?.full_name?.split(' ')[0]} 👋
            </h1>
            <span className="badge badge-red font-bold text-xs">Pollo Crispy</span>
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <Calendar size={13} className="text-red-500" />
            <span className="capitalize">
              {new Date().toLocaleDateString('es-HN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span>•</span>
            <span className="font-semibold text-gray-700">
              {selectedBranchId
                ? branches.find(b => b.id === selectedBranchId)?.name || 'Sucursal Seleccionada'
                : 'Todas las Sucursales'}
            </span>
          </p>
        </div>

        {/* Controles de Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Sucursal (Para Super Admin) */}
          {isSuperAdmin && (
            <div className="relative">
              <select
                value={selectedBranchId}
                onChange={e => {
                  setSelectedBranchId(e.target.value)
                  const branchObj = branches.find(b => b.id === e.target.value)
                  if (branchObj) setActiveBranch(branchObj)
                }}
                className="select text-xs font-semibold py-2 pl-8 pr-8 bg-gray-50 border-gray-200 text-gray-800 rounded-xl"
              >
                <option value="">Todas las Sucursales</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <Building2
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none"
              />
            </div>
          )}

          {/* Selector de Período (Hoy, Semana, Mes, Año, Personalizado) */}
          <div className="inline-flex bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-bold">
            {(['today', 'week', 'month', 'year', 'custom'] as PeriodType[]).map(pKey => (
              <button
                key={pKey}
                onClick={() => setPeriod(pKey)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  period === pKey
                    ? 'bg-red-600 text-white shadow-sm font-extrabold'
                    : 'text-gray-600 hover:text-red-600'
                }`}
              >
                {periodLabels[pKey]}
              </button>
            ))}
          </div>

          {/* Botón rápido a POS */}
          <button
            onClick={() => navigate('/pos')}
            className="btn btn-yellow font-bold text-xs px-4 py-2 rounded-xl shadow-sm hover:shadow active:scale-95 flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Nueva Venta</span>
          </button>
        </div>
      </div>

      {/* Rango de fechas personalizado si está activo */}
      {period === 'custom' && (
        <div className="p-4 bg-red-50/70 border border-red-200 rounded-2xl flex flex-wrap items-center gap-4 text-xs animate-scale-in">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-red-600" />
            <span className="font-bold text-red-950">Rango personalizado:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-700">Desde:</label>
            <input
              type="date"
              className="input text-xs py-1 px-2.5 w-auto"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-gray-700">Hasta:</label>
            <input
              type="date"
              className="input text-xs py-1 px-2.5 w-auto"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── 2. TARJETAS DE MÉTRICAS KPI (Rojo & Ámbar Pollo Crispy) ─────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* 01 • Ventas del Período */}
        <div className="card p-5 border-t-4 border-t-red-600 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">
              01 • VENTAS ({periodLabels[period].toUpperCase()})
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
              {formatCurrency(totalSalesPeriod, currency)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{countSalesPeriod} venta(s) completadas</span>
            </div>
          </div>
        </div>

        {/* 02 • Ventas de Hoy */}
        <div className="card p-5 border-t-4 border-t-amber-500 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">
              02 • VENTAS DE HOY
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
              {formatCurrency(todayTotal, currency)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>{todayCount} venta(s) hoy</span>
            </div>
          </div>
        </div>

        {/* 03 • Ticket Promedio */}
        <div className="card p-5 border-t-4 border-t-blue-600 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">
              03 • TICKET PROMEDIO
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              <Package size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
              {formatCurrency(avgTicket, currency)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-blue-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Promedio por orden</span>
            </div>
          </div>
        </div>

        {/* 04 • Cobro en Efectivo */}
        <div className="card p-5 border-t-4 border-t-emerald-600 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">
              04 • EFECTIVO COBRADO
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              <Banknote size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
              {formatCurrency(cashTotal, currency)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Efectivo en el período</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. GRÁFICOS EN ROJO Y ÁMBAR DE POLLO CRISPY ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Tendencia de Ingresos (Curva suave en Rojo Pollo Crispy) */}
        <div className="lg:col-span-2 card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-display">
                Tendencia de Ventas ({periodLabels[period]})
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Ingresos registrados en Lempiras para {selectedBranchId ? 'esta sucursal' : 'todas las sucursales'}
              </p>
            </div>
            <span className="badge badge-red text-xs font-semibold px-3 py-1">
              {currency} Lempiras
            </span>
          </div>

          <div className="pt-2">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `L${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(v: number) => [`${formatCurrency(v, 'L')}`, 'Ventas']}
                  labelFormatter={(l: string) => `Fecha / Hora: ${l}`}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #fee2e2',
                    boxShadow: '0 10px 25px -5px rgba(220, 38, 38, 0.1)',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#dc2626"
                  strokeWidth={3}
                  fill="url(#redGradient)"
                  activeDot={{ r: 6, fill: '#dc2626', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Métodos de Pago (Donut Chart) */}
        <div className="card p-6 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 font-display">Métodos de Pago</h2>
            <p className="text-xs text-gray-400 mt-0.5">Distribución en el período seleccionado</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            {paymentData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={paymentData}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentData.map((_, i) => (
                        <Cell key={i} fill={POLLO_COLORS[i % POLLO_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`${formatCurrency(v, 'L')}`, 'Monto']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Leyenda corporativa */}
                <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100 text-xs">
                  {paymentData.map((item, idx) => {
                    const pct =
                      totalPaymentSum > 0
                        ? ((item.value / totalPaymentSum) * 100).toFixed(0)
                        : '0'
                    return (
                      <div key={item.name} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: POLLO_COLORS[idx % POLLO_COLORS.length] }}
                        />
                        <span className="text-gray-600 truncate">{item.name}</span>
                        <span className="font-bold text-gray-900 ml-auto">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <DollarSign size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Sin transacciones registradas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 4. COMPARACIÓN POR SUCURSAL (Solo Super Admin) ──────────────── */}
      {isSuperAdmin && branchStats.length > 0 && !selectedBranchId && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 font-display">
                Comparación de Ventas por Sucursal (Hoy)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Rendimiento en tiempo real de cada local de Pollo Crispy
              </p>
            </div>
            <span className="badge badge-yellow font-bold text-xs">Multi-Sucursal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {branchStats.map(b => {
              const amount = Number(b.today_amount || b.total_amount || 0)
              return (
                <div
                  key={b.name}
                  onClick={() => {
                    if (b.id) {
                      setSelectedBranchId(b.id)
                      const found = branches.find(br => br.id === b.id)
                      if (found) setActiveBranch(found)
                    }
                  }}
                  className="p-4 bg-gray-50/80 hover:bg-red-50/50 rounded-2xl border border-gray-100 flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                      <Store size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{b.name}</p>
                      <p className="text-xs text-gray-400">Clic para filtrar</p>
                    </div>
                  </div>
                  <div className="text-right font-extrabold text-red-600 text-base font-display">
                    {formatCurrency(amount, currency)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 5. VENTAS RECIENTES (Tabla / Tarjetas Limpias) ─────────────── */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <Receipt size={16} />
            </div>
            <h2 className="text-base font-bold text-gray-900 font-display">Ventas Recientes</h2>
          </div>
          <Link
            to="/ventas"
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors"
          >
            Ver todas las ventas <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="table-wrapper border-0">
          {recentSales.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No hay ventas recientes registradas para esta selección.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N° Venta</th>
                  <th>Cajero</th>
                  <th>Sucursal</th>
                  <th>Monto Total</th>
                  <th>Método de Pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr
                    key={sale.id}
                    onClick={() => navigate(`/ventas/${sale.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="font-mono text-xs font-bold text-red-600">
                      {sale.sale_number}
                    </td>
                    <td className="font-medium text-gray-800">{sale.cashier_name}</td>
                    <td className="text-xs">
                      <span className="badge badge-gray font-semibold flex items-center gap-1 w-fit">
                        <MapPin size={10} className="text-red-500" />
                        {sale.branch_name || 'Sucursal'}
                      </span>
                    </td>
                    <td className="font-extrabold text-gray-900">
                      {formatCurrency(sale.total, currency)}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          sale.payment_method === 'cash'
                            ? 'badge-green'
                            : sale.payment_method === 'card'
                            ? 'badge-blue'
                            : 'badge-yellow'
                        }`}
                      >
                        {sale.payment_method === 'cash'
                          ? 'Efectivo'
                          : sale.payment_method === 'card'
                          ? 'Tarjeta'
                          : 'Transferencia'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          sale.status === 'completed'
                            ? 'badge-green'
                            : sale.status === 'voided'
                            ? 'badge-red'
                            : 'badge-gray'
                        }`}
                      >
                        {sale.status === 'completed'
                          ? 'Completada'
                          : sale.status === 'voided'
                          ? 'Anulada'
                          : 'Cancelada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
