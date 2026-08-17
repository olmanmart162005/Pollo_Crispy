import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { cashService } from '../services/cash.service'
import { cashTransfersService } from '../services/cashTransfers.service'
import { CashRegisterRecord, CashTransfer } from '../types'
import { formatCurrency, formatDateTime } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Archive, Lock, Unlock, DollarSign, CreditCard, Clock, Banknote, ArrowUpRight, CheckCircle, AlertCircle, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CashRegister() {
  const { profile } = useAuth()
  const { activeBranch } = useBranch()
  const { isCajero, isAdmin, isSuperAdmin } = usePermissions()

  const [openRegister, setOpenRegister] = useState<CashRegisterRecord | null>(null)
  const [branchOpenRegisters, setBranchOpenRegisters] = useState<CashRegisterRecord[]>([])
  const [registersHistory, setRegistersHistory] = useState<CashRegisterRecord[]>([])
  const [transfers, setTransfers] = useState<CashTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Record<string, number> | null>(null)

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState<CashRegisterRecord | null>(null)
  const [detailSummary, setDetailSummary] = useState<Record<string, number> | null>(null)

  // Form states
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [observations, setObservations] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (profile) loadData()
  }, [profile?.id, activeBranch?.id])

  const loadData = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const branchId = activeBranch?.id

      if (isCajero) {
        // Cajero logic: check current open register and user history
        const reg = await cashService.getOpenRegister(profile.id, branchId)
        const hist = await cashService.getRegisters({ cashierId: profile.id, limit: 15 })
        setOpenRegister(reg)
        setRegistersHistory(hist)

        if (reg?.id) {
          const [s, trs] = await Promise.all([
            cashService.getSummary(reg.id),
            cashTransfersService.getTransfers({ cashRegisterId: reg.id })
          ])
          setSummary(s)
          setTransfers(trs)
        } else {
          setSummary(null)
          setTransfers([])
        }
      } else {
        // Admin / Super Admin logic: view active registers in branch and branch history
        const [openRegs, hist] = await Promise.all([
          branchId ? cashService.getOpenRegistersByBranch(branchId) : Promise.resolve([]),
          cashService.getRegisters({ branchId, limit: 20 })
        ])

        // Check if admin also has an active register for themselves
        const selfReg = await cashService.getOpenRegister(profile.id, branchId)
        setOpenRegister(selfReg)
        setBranchOpenRegisters(openRegs)
        setRegistersHistory(hist)

        if (selfReg?.id) {
          const s = await cashService.getSummary(selfReg.id)
          setSummary(s)
        }
      }
    } catch (err) {
      console.error(err)
      toast.error('Error cargando información de caja')
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = async () => {
    if (!profile || !activeBranch) return toast.error('Selecciona una sucursal')
    const amount = parseFloat(openingAmount)
    if (isNaN(amount) || amount < 0) return toast.error('Ingresa un monto inicial válido')

    setActionLoading(true)
    try {
      await cashService.openCash(activeBranch.id, profile.id, amount)
      toast.success('Caja aperturada correctamente')
      setShowOpenModal(false)
      setOpeningAmount('')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al abrir caja')
    } finally {
      setActionLoading(false)
    }
  }

  const handleClose = async () => {
    if (!openRegister) return
    const closing = parseFloat(closingAmount)
    if (isNaN(closing)) return toast.error('Ingresa el monto de efectivo contado')

    setActionLoading(true)
    try {
      await cashService.closeCash(openRegister.id, closing, observations)
      toast.success('Caja cerrada correctamente')
      setShowCloseModal(false)
      setClosingAmount('')
      setObservations('')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cerrar caja')
    } finally {
      setActionLoading(false)
    }
  }

  const inspectRegister = async (reg: CashRegisterRecord) => {
    try {
      const s = await cashService.getSummary(reg.id)
      setDetailSummary(s)
      setShowDetailModal(reg)
    } catch {
      toast.error('Error al cargar detalle de la caja')
    }
  }

  if (loading) return <PageLoader />

  const expectedCash = summary?.expected_cash ?? ((openRegister?.opening_amount || 0) + (summary?.cash_sales || 0) - (summary?.total_transfers || 0))
  const closingNum = parseFloat(closingAmount) || 0
  const diff = closingNum - expectedCash

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Archive size={26} className="text-red-600" /> Turno de Caja
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestión de turnos, efectivo en caja y arqueos para <strong>{activeBranch?.name || 'Sucursal'}</strong>
          </p>
        </div>

        <div className="flex gap-2">
          {openRegister ? (
            <button onClick={() => setShowCloseModal(true)} className="btn btn-danger font-bold">
              <Lock size={16} /> Cerrar Caja
            </button>
          ) : isCajero ? (
            <button onClick={() => setShowOpenModal(true)} className="btn btn-primary font-bold shadow-md">
              <Unlock size={16} /> Abrir Mi Caja
            </button>
          ) : null}
        </div>
      </div>

      {/* CAJERO VIEW: Turno activo del Cajero */}
      {isCajero && openRegister ? (
        <div className="card card-body border-t-4 border-t-red-600 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                <Unlock size={20} />
              </div>
              <div>
                <p className="font-extrabold text-gray-900 text-base">Caja Abierta — Tu Turno Actual</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock size={12} /> Apertura: {formatDateTime(openRegister.opened_at)}
                </p>
              </div>
            </div>
            <span className="badge badge-green font-bold px-3 py-1">🟢 ABIERTA</span>
          </div>

          {/* Turno metrics calculation breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider block mb-1">Fondo Inicial</span>
              <p className="text-xl font-extrabold text-gray-900">{formatCurrency(openRegister.opening_amount, 'L')}</p>
            </div>

            <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-100">
              <span className="text-xs text-emerald-800 font-bold uppercase tracking-wider block mb-1">+ Ventas Efectivo</span>
              <p className="text-xl font-extrabold text-emerald-700">{formatCurrency(summary?.cash_sales || 0, 'L')}</p>
            </div>

            <div className="bg-red-50/60 rounded-xl p-3.5 border border-red-100">
              <span className="text-xs text-red-800 font-bold uppercase tracking-wider block mb-1">- Retiros / Envíos</span>
              <p className="text-xl font-extrabold text-red-600">{formatCurrency(summary?.total_transfers || 0, 'L')}</p>
            </div>

            <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200">
              <span className="text-xs text-amber-900 font-bold uppercase tracking-wider block mb-1">= Efectivo Esperado</span>
              <p className="text-xl font-extrabold text-amber-900">{formatCurrency(expectedCash, 'L')}</p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Ventas Totales (Todas):</span>
              <span className="font-bold text-gray-900">{formatCurrency(summary?.total_amount || 0, 'L')}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Ventas Tarjeta:</span>
              <span className="font-bold text-blue-600">{formatCurrency(summary?.card_sales || 0, 'L')}</span>
            </div>
            <div className="flex justify-between p-2.5 bg-gray-50 rounded-lg">
              <span className="text-gray-600 font-medium">Ventas Transferencia:</span>
              <span className="font-bold text-purple-600">{formatCurrency(summary?.transfer_sales || 0, 'L')}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center gap-3">
            <Link to="/envios" className="btn btn-secondary text-xs font-bold">
              <Banknote size={14} className="text-red-600" /> Ver / Registrar Envíos de Efectivo
            </Link>
            <button onClick={() => setShowCloseModal(true)} className="btn btn-danger font-bold text-xs">
              <Lock size={14} /> Cerrar Mi Caja
            </button>
          </div>
        </div>
      ) : isCajero ? (
        <div className="card card-body text-center py-12">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3 text-red-600">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 font-display">No tienes un turno de caja abierto</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Apertura tu turno de caja indicando el fondo inicial para comenzar a cobrar ventas en {activeBranch?.name}.
          </p>
          <button onClick={() => setShowOpenModal(true)} className="btn btn-primary font-bold mx-auto mt-5 px-6">
            <Unlock size={18} /> Abrir Caja
          </button>
        </div>
      ) : null}

      {/* ADMIN & SUPER ADMIN VIEW: Cajas / Turnos Abiertos de la Sucursal */}
      {(isAdmin || isSuperAdmin) && (
        <div className="space-y-4">
          <div className="card">
            <div className="card-header bg-red-50/50">
              <h2 className="font-extrabold text-gray-900 font-display flex items-center gap-2">
                <Unlock size={18} className="text-emerald-600" /> Cajas Abiertas en {activeBranch?.name || 'la Sucursal'}
              </h2>
            </div>
            <div className="table-wrapper rounded-none border-0">
              <table>
                <thead>
                  <tr>
                    <th>Cajero</th>
                    <th>Apertura</th>
                    <th>Fondo Inicial</th>
                    <th>Ventas Efectivo</th>
                    <th>Envíos / Retiros</th>
                    <th>Efectivo Esperado</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {branchOpenRegisters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-400">
                        No hay cajas ni turnos abiertos actualmente en esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    branchOpenRegisters.map(reg => (
                      <tr key={reg.id}>
                        <td className="font-bold text-gray-900">{reg.cashier_name}</td>
                        <td className="text-xs">{formatDateTime(reg.opened_at)}</td>
                        <td>{formatCurrency(reg.opening_amount, 'L')}</td>
                        <td className="text-emerald-700 font-bold">{formatCurrency(reg.cash_amount || 0, 'L')}</td>
                        <td className="text-red-600 font-bold">{formatCurrency(reg.total_transfers || 0, 'L')}</td>
                        <td className="font-extrabold text-gray-900">
                          {formatCurrency(reg.current_expected_cash ?? ((reg.opening_amount || 0) + (reg.cash_amount || 0) - (reg.total_transfers || 0)), 'L')}
                        </td>
                        <td>
                          <span className="badge badge-green font-bold">🟢 Abierta</span>
                        </td>
                        <td>
                          <button
                            onClick={() => inspectRegister(reg)}
                            className="btn btn-ghost btn-sm p-1.5 text-red-600 hover:bg-red-50"
                            title="Supervisar / Ver Detalle"
                          >
                            <Eye size={14} /> Supervisar
                          </button>
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

      {/* HISTORIAL Y CIERRES DE CAJA */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-gray-900 font-display">Historial de Turnos y Cierres de Caja</h2>
        </div>
        <div className="table-wrapper rounded-none border-0">
          <table>
            <thead>
              <tr>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Cajero</th>
                <th>Fondo Inicial</th>
                <th>Ventas Totales</th>
                <th>Envíos</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Diferencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {registersHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-gray-400">
                    No se han registrado cierres en esta sucursal.
                  </td>
                </tr>
              ) : (
                registersHistory.map(r => (
                  <tr key={r.id}>
                    <td className="text-xs">{formatDateTime(r.opened_at)}</td>
                    <td className="text-xs">{r.closed_at ? formatDateTime(r.closed_at) : '—'}</td>
                    <td className="text-xs font-semibold">{r.cashier_name}</td>
                    <td>{formatCurrency(r.opening_amount, 'L')}</td>
                    <td className="font-bold">{formatCurrency(r.total_amount || 0, 'L')}</td>
                    <td className="text-red-600 font-bold">{formatCurrency(r.total_transfers || 0, 'L')}</td>
                    <td>{formatCurrency(r.expected_cash || 0, 'L')}</td>
                    <td>{r.closing_amount !== null && r.closing_amount !== undefined ? formatCurrency(r.closing_amount, 'L') : '—'}</td>
                    <td className={
                      r.difference !== undefined && r.difference !== null
                        ? Math.abs(Number(r.difference)) < 0.01
                          ? 'text-emerald-600 font-bold'
                          : Number(r.difference) < 0
                          ? 'text-red-600 font-bold'
                          : 'text-amber-600 font-bold'
                        : ''
                    }>
                      {r.difference !== undefined && r.difference !== null
                        ? `${Number(r.difference) > 0 ? '+' : ''}${formatCurrency(r.difference, 'L')}`
                        : '—'}
                    </td>
                    <td>
                      <span className={`badge ${r.status === 'open' ? 'badge-green' : 'badge-gray'}`}>
                        {r.status === 'open' ? 'Abierta' : 'Cerrada'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Apertura de Caja */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Aperturar Turno de Caja"
        size="sm"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowOpenModal(false)} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={handleOpen} disabled={actionLoading} className="btn btn-primary flex-1 font-bold">
              {actionLoading ? 'Abriendo...' : 'Aperturar Caja'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-xs text-red-800 space-y-1">
            <p className="font-bold">Sucursal: {activeBranch?.name}</p>
            <p>Cajero: {profile?.full_name}</p>
          </div>

          <div className="form-group">
            <label className="label">Monto inicial en caja (L) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input font-extrabold text-lg text-red-600"
              placeholder="1000.00"
              value={openingAmount}
              onChange={e => setOpeningAmount(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Modal Cierre de Caja */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Cierre y Arqueo de Caja"
        size="md"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowCloseModal(false)} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={handleClose} disabled={actionLoading} className="btn btn-danger flex-1 font-bold">
              {actionLoading ? 'Cerrando...' : 'Confirmar Cierre'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Summary breakdown */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-gray-600">Fondo Inicial:</span>
              <span className="font-bold">{formatCurrency(openRegister?.opening_amount || 0, 'L')}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-semibold">
              <span>(+) Ventas en Efectivo:</span>
              <span>{formatCurrency(summary?.cash_sales || 0, 'L')}</span>
            </div>
            <div className="flex justify-between text-red-600 font-semibold">
              <span>(-) Retiros / Envíos de Efectivo:</span>
              <span>-{formatCurrency(summary?.total_transfers || 0, 'L')}</span>
            </div>
            <div className="flex justify-between font-extrabold text-amber-900 border-t border-dashed border-gray-300 pt-1 text-sm">
              <span>(=) Efectivo Esperado en Caja:</span>
              <span>{formatCurrency(expectedCash, 'L')}</span>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Efectivo Contado Físicamente en Caja (L) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input font-extrabold text-lg text-gray-900"
              placeholder="0.00"
              value={closingAmount}
              onChange={e => setClosingAmount(e.target.value)}
            />

            {closingAmount && (
              <div className={`mt-2 p-2.5 rounded-xl text-xs font-bold flex items-center justify-between ${
                Math.abs(diff) < 0.01
                  ? 'bg-emerald-100 text-emerald-800'
                  : diff < 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-900'
              }`}>
                <span>Diferencia de Arqueo:</span>
                <span>{diff > 0 ? '+' : ''}{formatCurrency(diff, 'L')}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="label">Observaciones / Justificación de Cierre</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Agrega cualquier observación relevante sobre este cierre..."
              value={observations}
              onChange={e => setObservations(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Modal Supervisión para Admins */}
      <Modal
        isOpen={!!showDetailModal}
        onClose={() => setShowDetailModal(null)}
        title={`Supervisión de Caja — ${showDetailModal?.cashier_name}`}
        size="md"
        footer={
          <button onClick={() => setShowDetailModal(null)} className="btn btn-secondary w-full">
            Cerrar Supervisión
          </button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
            <p className="font-bold text-gray-900 text-sm">{showDetailModal?.cashier_name}</p>
            <p className="text-gray-600">Apertura: {showDetailModal?.opened_at ? formatDateTime(showDetailModal.opened_at) : '—'}</p>
            <p className="text-gray-600">Sucursal: {showDetailModal?.branch_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <span className="text-gray-500 font-bold block mb-1">Fondo Inicial</span>
              <span className="text-base font-extrabold text-gray-900">{formatCurrency(showDetailModal?.opening_amount || 0, 'L')}</span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <span className="text-emerald-800 font-bold block mb-1">Ventas Efectivo</span>
              <span className="text-base font-extrabold text-emerald-700">{formatCurrency(detailSummary?.cash_sales || 0, 'L')}</span>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <span className="text-red-800 font-bold block mb-1">Envíos de Efectivo</span>
              <span className="text-base font-extrabold text-red-600">{formatCurrency(detailSummary?.total_transfers || 0, 'L')}</span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <span className="text-amber-900 font-bold block mb-1">Efectivo Esperado</span>
              <span className="text-base font-extrabold text-amber-900">{formatCurrency(detailSummary?.expected_cash || 0, 'L')}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
