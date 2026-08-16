import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { cashService } from '../services/cash.service'
import { CashRegisterRecord } from '../types'
import { formatCurrency, formatDateTime } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Archive, Lock, Unlock, DollarSign, CreditCard, Smartphone, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CashRegister() {
  const { profile } = useAuth()
  const { activeBranch } = useBranch()

  const [openRegister, setOpenRegister] = useState<CashRegisterRecord | null>(null)
  const [registers, setRegisters] = useState<CashRegisterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Record<string, number> | null>(null)

  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [observations, setObservations] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { if (profile) loadData() }, [profile?.id, activeBranch?.id])

  const loadData = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [reg, hist] = await Promise.all([
        cashService.getOpenRegister(profile.id),
        cashService.getRegisters({ cashierId: profile.id, limit: 10 }),
      ])
      setOpenRegister(reg)
      setRegisters(hist)
      if (reg?.id) {
        const s = await cashService.getSummary(reg.id)
        setSummary(s)
      }
    } catch { toast.error('Error cargando caja') }
    finally { setLoading(false) }
  }

  const handleOpen = async () => {
    if (!profile || !activeBranch) return toast.error('Selecciona una sucursal')
    const amount = parseFloat(openingAmount) || 0
    setActionLoading(true)
    try {
      await cashService.openCash(activeBranch.id, profile.id, amount)
      toast.success('Caja abierta correctamente')
      setShowOpenModal(false)
      setOpeningAmount('')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error abriendo caja')
    } finally { setActionLoading(false) }
  }

  const handleClose = async () => {
    if (!openRegister) return
    const closing = parseFloat(closingAmount)
    if (isNaN(closing)) return toast.error('Ingresa el monto en efectivo contado')
    setActionLoading(true)
    try {
      await cashService.closeCash(openRegister.id, closing, observations)
      toast.success('Caja cerrada correctamente')
      setShowCloseModal(false)
      setClosingAmount('')
      setObservations('')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error cerrando caja')
    } finally { setActionLoading(false) }
  }

  if (loading) return <PageLoader />

  const expected = summary?.expected_cash || 0
  const closingNum = parseFloat(closingAmount) || 0
  const diff = closingNum - expected

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Archive size={22} className="text-orange-500" /> Caja
        </h1>
        {!openRegister ? (
          <button onClick={() => setShowOpenModal(true)} className="btn btn-primary">
            <Unlock size={16} /> Aperturar Caja
          </button>
        ) : (
          <button onClick={() => setShowCloseModal(true)} className="btn btn-danger">
            <Lock size={16} /> Cerrar Caja
          </button>
        )}
      </div>

      {/* Current register status */}
      {openRegister ? (
        <div className="card card-body">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Unlock size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Caja Abierta</p>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={11} /> {formatDateTime(openRegister.opened_at)}
              </p>
            </div>
            <span className="badge badge-green ml-auto">ABIERTA</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Efectivo inicial', value: openRegister.opening_amount, icon: <DollarSign size={16} className="text-orange-500" /> },
              { label: 'Total vendido', value: summary?.total_amount || 0, icon: <DollarSign size={16} className="text-green-500" /> },
              { label: 'Ventas efectivo', value: summary?.cash_sales || 0, icon: <DollarSign size={16} className="text-blue-500" /> },
              { label: 'Ventas tarjeta', value: summary?.card_sales || 0, icon: <CreditCard size={16} className="text-purple-500" /> },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">{item.icon}
                  <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                </div>
                <p className="font-bold text-gray-900 text-lg">{formatCurrency(Number(item.value), 'L')}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex justify-between">
            <span className="text-sm text-gray-600 font-medium">N° de ventas hoy:</span>
            <span className="font-bold text-orange-600">{summary?.total_sales || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 font-medium">Efectivo esperado en caja:</span>
            <span className="font-bold text-gray-900">{formatCurrency(Number(expected), 'L')}</span>
          </div>
        </div>
      ) : (
        <div className="card card-body text-center py-10">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Lock size={28} className="text-gray-400" />
          </div>
          <p className="font-bold text-gray-700 text-lg font-display">No tienes una caja abierta</p>
          <p className="text-sm text-gray-500 mt-1">Apertura tu caja para comenzar a registrar ventas</p>
          <button onClick={() => setShowOpenModal(true)} className="btn btn-primary mx-auto mt-4">
            <Unlock size={16} /> Aperturar Caja
          </button>
        </div>
      )}

      {/* History */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-gray-900 font-display">Historial de Cajas</h2>
        </div>
        <div className="table-wrapper rounded-none border-0">
          <table>
            <thead><tr>
              <th>Apertura</th><th>Cierre</th><th>Monto inicial</th>
              <th>Total vendido</th><th>Efectivo esperado</th><th>Diferencia</th><th>Estado</th>
            </tr></thead>
            <tbody>
              {registers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin registros</td></tr>
              ) : registers.map(r => (
                <tr key={r.id}>
                  <td className="text-xs">{formatDateTime(r.opened_at)}</td>
                  <td className="text-xs">{r.closed_at ? formatDateTime(r.closed_at) : '—'}</td>
                  <td>{formatCurrency(r.opening_amount, 'L')}</td>
                  <td>{formatCurrency(Number(r.total_amount || 0), 'L')}</td>
                  <td>{formatCurrency(Number(r.expected_cash || 0), 'L')}</td>
                  <td className={r.difference !== undefined && r.difference !== null
                    ? Math.abs(Number(r.difference)) < 0.01 ? 'text-green-600 font-medium'
                    : Number(r.difference) < 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium' : ''}>
                    {r.difference !== undefined && r.difference !== null ? formatCurrency(Number(r.difference), 'L') : '—'}
                  </td>
                  <td><span className={`badge ${r.status === 'open' ? 'badge-green' : 'badge-gray'}`}>
                    {r.status === 'open' ? 'Abierta' : 'Cerrada'}
                  </span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open modal */}
      <Modal isOpen={showOpenModal} onClose={() => setShowOpenModal(false)} title="Aperturar Caja" size="sm"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowOpenModal(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={handleOpen} disabled={actionLoading} className="btn btn-primary flex-1">
              {actionLoading ? 'Abriendo...' : 'Aperturar'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Ingresa el monto de efectivo inicial en caja.</p>
          <div className="form-group">
            <label className="label">Monto inicial (efectivo)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">L</span>
              <input type="number" step="0.01" min="0" className="input pl-8" placeholder="0.00"
                value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-400">Sucursal: {activeBranch?.name || '—'}</p>
        </div>
      </Modal>

      {/* Close modal */}
      <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} title="Cerrar Caja" size="sm"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowCloseModal(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={handleClose} disabled={actionLoading} className="btn btn-danger flex-1">
              {actionLoading ? 'Cerrando...' : 'Cerrar Caja'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="bg-orange-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-600">Efectivo inicial:</span><span className="font-medium">{formatCurrency(openRegister?.opening_amount || 0, 'L')}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Ventas efectivo:</span><span className="font-medium">{formatCurrency(Number(summary?.cash_sales || 0), 'L')}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Tarjeta/Transfer.:</span><span className="font-medium">{formatCurrency(Number((summary?.card_sales || 0) + (summary?.transfer_sales || 0)), 'L')}</span></div>
            <div className="flex justify-between font-bold border-t pt-1 text-orange-600">
              <span>Efectivo esperado:</span><span>{formatCurrency(Number(expected), 'L')}</span>
            </div>
          </div>
          <div className="form-group">
            <label className="label">Efectivo contado *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-sm">L</span>
              <input type="number" step="0.01" min="0" className="input pl-8" placeholder="0.00"
                value={closingAmount} onChange={e => setClosingAmount(e.target.value)} />
            </div>
            {closingAmount && (
              <p className={`text-xs mt-1 font-medium ${Math.abs(diff) < 0.01 ? 'text-green-600' : diff > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                Diferencia: {diff > 0 ? '+' : ''}{formatCurrency(diff, 'L')}
                {Math.abs(diff) > 0.01 && ' — Se requiere observación'}
              </p>
            )}
          </div>
          {(Math.abs(diff) > 0.01 || diff !== 0) && closingAmount && (
            <div className="form-group">
              <label className="label">Observaciones {Math.abs(diff) > 0.01 ? '*' : ''}</label>
              <textarea className="textarea" rows={2} placeholder="Describe cualquier diferencia..."
                value={observations} onChange={e => setObservations(e.target.value)} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
