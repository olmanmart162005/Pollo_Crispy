import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { salesService } from '../services/sales.service'
import { Sale } from '../types'
import { formatCurrency, formatDateTime, getToday, getMonthStart } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Search, Filter, Eye, Ban, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_BADGE: Record<string, string> = {
  completed: 'badge-green',
  voided: 'badge-red',
  cancelled: 'badge-gray',
}
const STATUS_LABEL: Record<string, string> = {
  completed: 'Completada',
  voided: 'Anulada',
  cancelled: 'Cancelada',
}
const PAYMENT_BADGE: Record<string, string> = {
  cash: 'badge-green', card: 'badge-blue', transfer: 'badge-purple', other: 'badge-gray'
}
const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transfer.', other: 'Otro'
}

export default function Sales() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { activeBranch } = useBranch()
  const { isAdmin, isSuperAdmin } = usePermissions()

  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [voidModal, setVoidModal] = useState<Sale | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidLoading, setVoidLoading] = useState(false)

  useEffect(() => { loadSales() }, [activeBranch?.id])

  const loadSales = async () => {
    setLoading(true)
    try {
      const branchId = !isSuperAdmin ? activeBranch?.id : undefined
      const cashierId = !isAdmin ? profile?.id : undefined
      const data = await salesService.getSales({ branchId, cashierId, startDate, endDate })
      setSales(data)
    } catch {
      toast.error('Error cargando ventas')
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = async () => {
    setLoading(true)
    try {
      const branchId = !isSuperAdmin ? activeBranch?.id : undefined
      const cashierId = !isAdmin ? profile?.id : undefined
      const data = await salesService.getSales({ branchId, cashierId, startDate, endDate })
      setSales(data)
    } catch {
      toast.error('Error aplicando filtros')
    } finally {
      setLoading(false)
    }
  }

  const handleVoid = async () => {
    if (!voidModal || !profile) return
    if (!voidReason.trim()) return toast.error('Ingresa un motivo de anulación')
    setVoidLoading(true)
    try {
      await salesService.voidSale(voidModal.id, profile.id, voidReason, profile.id)
      toast.success('Venta anulada correctamente')
      setVoidModal(null)
      setVoidReason('')
      loadSales()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al anular venta')
    } finally {
      setVoidLoading(false)
    }
  }

  const filtered = sales.filter(s => {
    if (search && !s.sale_number?.includes(search) && !s.cashier_name?.toLowerCase().includes(search.toLowerCase()))
      return false
    if (statusFilter && s.status !== statusFilter) return false
    return true
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Receipt size={22} className="text-orange-500" /> Historial de Ventas
        </h1>
      </div>

      {/* Filters */}
      <div className="card card-body flex flex-wrap gap-3">
        <input type="date" className="input w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <input type="date" className="input w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <select className="select w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="completed">Completadas</option>
          <option value="voided">Anuladas</option>
          <option value="cancelled">Canceladas</option>
        </select>
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="Buscar N° o cajero..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={handleFilter} className="btn btn-primary">
          <Filter size={14} /> Consultar
        </button>
        <button onClick={() => { setStartDate(getMonthStart()); setEndDate(getToday()); setSearch(''); setStatusFilter(''); loadSales() }} className="btn btn-secondary">
          Limpiar
        </button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total ventas', value: filtered.filter(s => s.status === 'completed').length, fmt: false },
          { label: 'Ingresos', value: filtered.filter(s => s.status === 'completed').reduce((s, v) => s + v.total, 0), fmt: true },
          { label: 'Efectivo', value: filtered.filter(s => s.status === 'completed' && s.payment_method === 'cash').reduce((s, v) => s + v.total, 0), fmt: true },
          { label: 'Anuladas', value: filtered.filter(s => s.status === 'voided').length, fmt: false },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{stat.label}</p>
            <p className="text-xl font-bold text-gray-900 font-display mt-0.5">
              {stat.fmt ? formatCurrency(stat.value, 'L') : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>N° Venta</th>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Cajero</th>
                <th>Total</th>
                <th>Pago</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No hay ventas para mostrar</td></tr>
              ) : (
                filtered.map(sale => (
                  <tr key={sale.id}>
                    <td className="font-mono text-xs font-bold text-orange-600">{sale.sale_number}</td>
                    <td className="text-xs">{formatDateTime(sale.created_at)}</td>
                    <td className="text-xs">{sale.branch_name}</td>
                    <td>{sale.cashier_name}</td>
                    <td className="font-bold">{formatCurrency(sale.total, 'L')}</td>
                    <td><span className={`badge ${PAYMENT_BADGE[sale.payment_method]}`}>{PAYMENT_LABEL[sale.payment_method]}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[sale.status]}`}>{STATUS_LABEL[sale.status]}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/ventas/${sale.id}`)} className="btn btn-ghost btn-sm p-1.5" title="Ver detalle">
                          <Eye size={14} />
                        </button>
                        {isAdmin && sale.status === 'completed' && (
                          <button onClick={() => setVoidModal(sale)} className="btn btn-ghost btn-sm p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50" title="Anular">
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void modal */}
      <Modal isOpen={!!voidModal} onClose={() => setVoidModal(null)} title="Anular Venta" size="sm"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setVoidModal(null)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={handleVoid} disabled={voidLoading} className="btn btn-danger flex-1">
              {voidLoading ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="bg-red-50 rounded-xl p-3 text-sm">
            <p className="font-bold text-red-700">Venta: {voidModal?.sale_number}</p>
            <p className="text-red-600">Total: {formatCurrency(voidModal?.total || 0, 'L')}</p>
          </div>
          <p className="text-sm text-gray-600">Esta acción no puede deshacerse. La venta quedará registrada como anulada.</p>
          <div className="form-group">
            <label className="label">Motivo de anulación *</label>
            <textarea className="textarea" rows={3} placeholder="Describe el motivo..." value={voidReason} onChange={e => setVoidReason(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
