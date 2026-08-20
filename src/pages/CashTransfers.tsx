import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { cashTransfersService } from '../services/cashTransfers.service'
import { cashService } from '../services/cash.service'
import { branchesService } from '../services/branches.service'
import { CashTransfer, CashRegisterRecord, Branch } from '../types'
import { formatCurrency, formatDateTime, getToday } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Banknote, Plus, Search, CheckCircle, ArrowUpRight, DollarSign, Calendar, UserCheck, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CashTransfers() {
  const { profile } = useAuth()
  const { activeBranch, branches } = useBranch()
  const { isSuperAdmin } = usePermissions()

  const [transfers, setTransfers] = useState<CashTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [openRegister, setOpenRegister] = useState<CashRegisterRecord | null>(null)

  // Branch filter state (defaults to activeBranch.id)
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')

  // Filters
  const [startDate, setStartDate] = useState(getToday())
  const [endDate, setEndDate] = useState(getToday())
  const [search, setSearch] = useState('')

  // Create Modal state
  const [showModal, setShowModal] = useState(false)
  const [targetBranchId, setTargetBranchId] = useState<string>(activeBranch?.id || '')
  const [recipientName, setRecipientName] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('Retiro de efectivo / Depósito')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Sync selectedBranchId when activeBranch changes in top header
  useEffect(() => {
    if (activeBranch?.id) {
      setSelectedBranchId(activeBranch.id)
      setTargetBranchId(activeBranch.id)
    }
  }, [activeBranch?.id])

  useEffect(() => {
    loadData()
  }, [selectedBranchId, startDate, endDate])

  const loadData = async () => {
    setLoading(true)
    try {
      const branchIdToQuery = selectedBranchId || (activeBranch?.id || undefined)

      const [transfersData, openReg] = await Promise.all([
        cashTransfersService.getTransfers({
          branchId: branchIdToQuery,
          startDate,
          endDate,
        }),
        profile ? cashService.getOpenRegister(profile.id, branchIdToQuery) : Promise.resolve(null)
      ])

      setTransfers(transfersData)
      setOpenRegister(openReg)
    } catch (err) {
      console.error(err)
      toast.error('Error cargando envíos de efectivo')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setTargetBranchId(selectedBranchId || activeBranch?.id || (branches[0]?.id || ''))
    setShowModal(true)
  }

  const handleCreateTransfer = async () => {
    if (!profile) return toast.error('Sesión no encontrada')
    const postingBranchId = targetBranchId || activeBranch?.id
    if (!postingBranchId) return toast.error('Selecciona una sucursal para el envío')

    const numAmount = parseFloat(amount)

    if (!recipientName.trim()) {
      toast.error('Especifica la persona que recibe el efectivo')
      return
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Ingresa un monto válido mayor a L 0.00')
      return
    }

    setSubmitting(true)
    try {
      // Find open register for the target branch
      const reg = openRegister || (await cashService.getOpenRegister(profile.id, postingBranchId))

      await cashTransfersService.createTransfer({
        branchId: postingBranchId,
        cashRegisterId: reg?.id,
        senderId: profile.id,
        recipientName: recipientName.trim(),
        amount: numAmount,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      })

      const bName = branches.find(b => b.id === postingBranchId)?.name || activeBranch?.name || ''
      toast.success(`Envío de ${formatCurrency(numAmount, 'L')} registrado en ${bName}`)
      setShowModal(false)
      setRecipientName('')
      setAmount('')
      setNotes('')
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar envío')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredTransfers = transfers.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      const matchRecipient = t.recipient_name?.toLowerCase().includes(q)
      const matchSender = t.sender_name?.toLowerCase().includes(q)
      const matchReason = t.reason?.toLowerCase().includes(q)
      if (!matchRecipient && !matchSender && !matchReason) return false
    }
    return true
  })

  const totalTransferredToday = filteredTransfers.reduce((sum, t) => sum + (t.status === 'confirmed' ? Number(t.amount) : 0), 0)
  const currentBranchObj = branches.find(b => b.id === selectedBranchId) || activeBranch

  if (loading) return <PageLoader />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <Banknote size={26} className="text-red-600" /> Envíos / Retiros de Efectivo
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Registro de dinero retirado físicamente de caja en: <strong>{currentBranchObj?.name || 'Todas las sucursales'}</strong>
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="btn btn-primary font-bold shadow-md hover:shadow-lg"
        >
          <Plus size={18} /> Registrar Nuevo Envío
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 border-t-4 border-t-red-600 flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-600 rounded-xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Envíos (Período)</p>
            <p className="text-2xl font-extrabold text-red-600 font-display">{formatCurrency(totalTransferredToday, 'L')}</p>
          </div>
        </div>

        <div className="card p-4 border-t-4 border-t-amber-500 flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Retiros</p>
            <p className="text-2xl font-bold text-gray-900 font-display">{filteredTransfers.length} movimientos</p>
          </div>
        </div>

        <div className="card p-4 border-t-4 border-t-blue-500 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Turno Actual ({currentBranchObj?.name || 'Sucursal'})</p>
            <p className="text-sm font-bold text-gray-900 truncate">
              {openRegister ? `Caja de ${openRegister.cashier_name}` : 'Sin turno de caja abierto'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        {/* Branch Filter Selector */}
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-red-600" />
          <span className="text-xs font-bold text-gray-700">Sucursal:</span>
          <select
            className="select text-xs w-48 font-bold"
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
          >
            {isSuperAdmin && <option value="">Todas las sucursales</option>}
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-9 text-xs"
            placeholder="Buscar por recibido, enviado o motivo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-600">Desde:</span>
          <input
            type="date"
            className="input text-xs w-36"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Hasta:</span>
          <input
            type="date"
            className="input text-xs w-36"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Transfers table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Sucursal</th>
                <th>Enviado por</th>
                <th>Recibido por</th>
                <th>Motivo / Notas</th>
                <th>Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <Banknote size={40} className="mx-auto mb-2 opacity-20 text-red-500" />
                    <p className="text-sm font-medium">No se han registrado envíos de efectivo en {currentBranchObj?.name || 'las sucursales'}.</p>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map(transfer => (
                  <tr key={transfer.id}>
                    <td className="text-xs font-medium whitespace-nowrap">
                      {formatDateTime(transfer.created_at)}
                    </td>
                    <td className="text-xs font-bold text-gray-900">
                      <span className="badge badge-gray flex items-center gap-1 w-fit font-bold">
                        <MapPin size={10} className="text-red-600" />
                        {transfer.branch_name || currentBranchObj?.name}
                      </span>
                    </td>
                    <td className="text-xs font-semibold text-gray-700">
                      {transfer.sender_name || 'Cajero'}
                    </td>
                    <td className="text-xs font-bold text-gray-900">
                      {transfer.recipient_name}
                    </td>
                    <td className="text-xs text-gray-600 max-w-xs truncate">
                      <span className="font-semibold text-gray-800">{transfer.reason}</span>
                      {transfer.notes && <span className="text-gray-400 ml-1">({transfer.notes})</span>}
                    </td>
                    <td className="text-sm font-extrabold text-red-600 whitespace-nowrap">
                      {formatCurrency(transfer.amount, 'L')}
                    </td>
                    <td>
                      <span className="badge badge-green flex items-center gap-1 w-fit">
                        <CheckCircle size={10} /> Confirmado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Registrar Envío */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Registrar Envío / Retiro de Efectivo"
        size="md"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleCreateTransfer}
              disabled={submitting}
              className="btn btn-primary flex-1 font-bold"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              {submitting ? 'Registrando...' : 'Confirmar Envío'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-800 space-y-1">
            <p className="font-bold">⚠️ Nota Importante sobre Envíos de Efectivo:</p>
            <p>
              El dinero retirado se descontará del <strong>Efectivo Esperado en Caja</strong>, pero las ventas totales se mantendrán intactas.
            </p>
          </div>

          <div className="form-group">
            <label className="label">Sucursal del Envío *</label>
            <select
              className="select font-bold text-gray-900"
              value={targetBranchId}
              onChange={e => setTargetBranchId(e.target.value)}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Persona que recibe el dinero *</label>
            <input
              type="text"
              className="input font-bold"
              placeholder="Ej: Carlos Martínez / Gerencia"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Monto del Envío (L) *</label>
            <input
              type="number"
              step="0.01"
              className="input font-extrabold text-lg text-red-600"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="label">Motivo del Envío</label>
            <select
              className="select"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option value="Retiro de efectivo / Depósito">Retiro de efectivo / Depósito bancario</option>
              <option value="Entrega a Gerencia">Entrega a Gerencia</option>
              <option value="Pago a Proveedor">Pago a Proveedor</option>
              <option value="Pago de Servicios">Pago de Servicios / Gastos</option>
              <option value="Otro">Otro motivo</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Observaciones / Notas adicionales</label>
            <textarea
              className="textarea"
              rows={2}
              placeholder="Ej: Depósito parcial mediodía ticket #..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
