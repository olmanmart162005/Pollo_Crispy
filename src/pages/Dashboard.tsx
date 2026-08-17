import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { reportsService } from '../services/reports.service'
import { salesService } from '../services/sales.service'
import { formatCurrency, getToday, getMonthStart, getYearStart } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import {
  TrendingUp, ShoppingBag, Users, Store, DollarSign,
  Package, ArrowUpRight, Banknote
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#dc2626', '#f59e0b', '#2563eb', '#9333ea']

function StatCard({ label, value, icon, color, change }: {
  label: string; value: string; icon: React.ReactNode
  color: string; change?: string
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="stat-label">{label}</p>
        <p className="stat-value truncate">{value}</p>
        {change && (
          <p className="stat-change text-green-600 flex items-center gap-1 mt-0.5">
            <ArrowUpRight size={12} />{change}
          </p>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { activeBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()

  // Requirement 8: Cajero is not allowed in Administrative Dashboard
  if (profile?.role === 'CAJERO') {
    return <Navigate to="/pos" replace />
  }

  const [loading, setLoading] = useState(true)
  const [todaySummary, setTodaySummary] = useState<Record<string, number>>({})
  const [monthSummary, setMonthSummary] = useState<Record<string, number>>({})
  const [yearSummary, setYearSummary] = useState<Record<string, number>>({})
  const [monthlyData, setMonthlyData] = useState<{ month_name: string; total_amount: number }[]>([])
  const [branchStats, setBranchStats] = useState<{ name: string; today_amount: number }[]>([])
  const [recentSales, setRecentSales] = useState<import('../types').Sale[]>([])
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([])

  useEffect(() => {
    loadDashboard()
  }, [activeBranch?.id])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const today = getToday()
      const monthStart = getMonthStart()
      const yearStart = getYearStart()
      // Requirement 2 & 10: Always scope to the selected activeBranch ID
      const effectiveBranchId = activeBranch?.id || null

      const [todayR, monthR, yearR, monthly, recent] = await Promise.all([
        reportsService.getSummary(effectiveBranchId, today, today),
        reportsService.getSummary(effectiveBranchId, monthStart, today),
        reportsService.getSummary(effectiveBranchId, yearStart, today),
        reportsService.getMonthlySales(effectiveBranchId, new Date().getFullYear()),
        salesService.getSales({ branchId: effectiveBranchId || undefined, limit: 5 }),
      ])

      setTodaySummary(todayR || {})
      setMonthSummary(monthR || {})
      setYearSummary(yearR || {})
      setMonthlyData((monthly || []).map((m: { month_name: string; total_amount: number }) => ({
        month_name: m.month_name?.trim().slice(0, 3),
        total_amount: Number(m.total_amount || 0),
      })))
      setRecentSales(recent)

      if (monthR) {
        setPaymentData([
          { name: 'Efectivo', value: Number(monthR.cash_amount || 0) },
          { name: 'Tarjeta', value: Number(monthR.card_amount || 0) },
          { name: 'Transferencia', value: Number(monthR.transfer_amount || 0) },
          { name: 'Otro', value: Number(monthR.other_amount || 0) },
        ].filter(d => d.value > 0))
      }

      if (isSuperAdmin) {
        const stats = await reportsService.getBranchStats()
        setBranchStats(stats)
      }
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <PageLoader />

  const currency = 'L'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">
            Buenos días, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <img src="/LogoCrispyBueno.png" alt="Pollo Crispy" className="w-12 h-12 object-contain hidden sm:block" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Ventas de Hoy"
          value={formatCurrency(Number(todaySummary.total_amount || 0), currency)}
          icon={<DollarSign size={20} className="text-red-600" />}
          color="bg-red-100"
          change={`${Number(todaySummary.total_sales || 0)} ventas`}
        />
        <StatCard
          label="Ventas del Mes"
          value={formatCurrency(Number(monthSummary.total_amount || 0), currency)}
          icon={<TrendingUp size={20} className="text-green-600" />}
          color="bg-green-100"
          change={`${Number(monthSummary.total_sales || 0)} ventas`}
        />
        <StatCard
          label="Ventas del Año"
          value={formatCurrency(Number(yearSummary.total_amount || 0), currency)}
          icon={<ShoppingBag size={20} className="text-blue-600" />}
          color="bg-blue-100"
          change={`${Number(yearSummary.total_sales || 0)} ventas`}
        />
        {isSuperAdmin ? (
          <StatCard
            label="Sucursales Activas"
            value={String(branchStats.filter((b: { name: string; today_amount: number }) => b).length)}
            icon={<Store size={20} className="text-purple-600" />}
            color="bg-purple-100"
          />
        ) : (
          <StatCard
            label="Ticket Promedio"
            value={formatCurrency(Number(monthSummary.avg_sale || 0), currency)}
            icon={<Package size={20} className="text-amber-600" />}
            color="bg-amber-100"
          />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h2 className="font-bold text-gray-900 font-display">Ventas por Mes</h2>
            <span className="text-sm text-gray-400">{new Date().getFullYear()}</span>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month_name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `L${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v, 'L'), 'Ventas']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                />
                <Bar dataKey="total_amount" fill="#dc2626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment methods pie */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-gray-900 font-display">Métodos de Pago</h2>
            <span className="text-sm text-gray-400">Este mes</span>
          </div>
          <div className="card-body flex items-center justify-center">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="45%"
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={10}
                  >
                    {paymentData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-gray-400 py-10">
                <DollarSign size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin datos de pagos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Branch comparison (Super Admin only) */}
      {isSuperAdmin && branchStats.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-bold text-gray-900 font-display">Comparación por Sucursal — Hoy</h2>
          </div>
          <div className="card-body">
            <div className="space-y-3">
              {branchStats.map((b: Record<string, unknown>) => {
                const max = Math.max(...branchStats.map((x: Record<string, unknown>) => Number(x.today_amount || 0)), 1)
                const pct = (Number(b.today_amount || 0) / max) * 100
                return (
                  <div key={b.id as string}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{b.name as string}</span>
                      <span className="text-sm font-bold text-orange-600">
                        {formatCurrency(Number(b.today_amount || 0), 'L')}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent sales */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-gray-900 font-display">Ventas Recientes</h2>
          <a href="/ventas" className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
            Ver todas <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="table-wrapper rounded-none border-0">
          {recentSales.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay ventas registradas hoy</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>N° Venta</th>
                  <th>Cajero</th>
                  <th>Sucursal</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map(sale => (
                  <tr key={sale.id}>
                    <td className="font-mono text-xs font-bold text-orange-600">{sale.sale_number}</td>
                    <td>{sale.cashier_name}</td>
                    <td>{sale.branch_name}</td>
                    <td className="font-bold">{formatCurrency(sale.total, 'L')}</td>
                    <td>
                      <span className={`badge ${
                        sale.payment_method === 'cash' ? 'badge-green'
                        : sale.payment_method === 'card' ? 'badge-blue' : 'badge-purple'
                      }`}>
                        {sale.payment_method === 'cash' ? 'Efectivo' : sale.payment_method === 'card' ? 'Tarjeta' : 'Transfer.'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        sale.status === 'completed' ? 'badge-green'
                        : sale.status === 'voided' ? 'badge-red' : 'badge-gray'
                      }`}>
                        {sale.status === 'completed' ? 'Completada' : sale.status === 'voided' ? 'Anulada' : 'Cancelada'}
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
