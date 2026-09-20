import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { expensesService } from '../services/expenses.service'
import { cashService } from '../services/cash.service'
import {
  Expense,
  ExpenseCategory,
  ExpensePaymentMethod,
  ExpenseStatus,
  CashRegisterRecord,
} from '../types'
import { formatCurrency, formatDateTime, getToday, getMonthStart } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  FileText,
  ShieldCheck,
  Ban,
  User,
  HelpCircle,
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

export default function Expenses() {
  const { profile } = useAuth()
  const { branches, activeBranch, setActiveBranch } = useBranch()
  const { isSuperAdmin, isAdmin, isCajero } = usePermissions()

  // Branch filter
  const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranch?.id || '')

  // Data state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [activeRegister, setActiveRegister] = useState<CashRegisterRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters state
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMethod, setSelectedMethod] = useState<ExpensePaymentMethod | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<ExpenseStatus | 'all'>('all')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())

  // Modal: Registrar Gasto
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formBranchId, setFormBranchId] = useState<string>(activeBranch?.id || '')
  const [formCategoryId, setFormCategoryId] = useState<string>('')
  const [formCategoryName, setFormCategoryName] = useState<string>('Servicios')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formPaymentMethod, setFormPaymentMethod] = useState<ExpensePaymentMethod>('cash')
  const [formReceiptNumber, setFormReceiptNumber] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Modal: Anular Gasto
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [expenseToCancel, setExpenseToCancel] = useState<Expense | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Modal: Detalle de Gasto
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<Expense | null>(null)

  const effectiveBranchId = isSuperAdmin ? selectedBranchId : activeBranch?.id || ''

  useEffect(() => {
    if (!isSuperAdmin && activeBranch?.id) {
      setSelectedBranchId(activeBranch.id)
      setFormBranchId(activeBranch.id)
    }
  }, [activeBranch?.id, isSuperAdmin])

  useEffect(() => {
    loadInitialData()
  }, [effectiveBranchId, startDate, endDate, selectedCategory, selectedMethod, selectedStatus])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [cats, expList, reg] = await Promise.all([
        expensesService.getCategories(),
        expensesService.getExpenses({
          branchId: effectiveBranchId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
          paymentMethod: selectedMethod !== 'all' ? selectedMethod : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          createdBy: isCajero ? profile?.id : undefined, // Cajero solo ve sus propios gastos
        }),
        profile?.id ? cashService.getOpenRegister(profile.id, activeBranch?.id) : Promise.resolve(null),
      ])

      setCategories(cats)
      setExpenses(expList)
      setActiveRegister(reg)
      if (cats.length > 0 && !formCategoryName) {
        setFormCategoryId(cats[0].id)
        setFormCategoryName(cats[0].name)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error cargando gastos operativos')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const expList = await expensesService.getExpenses({
        branchId: effectiveBranchId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        categoryId: selectedCategory !== 'all' ? selectedCategory : undefined,
        paymentMethod: selectedMethod !== 'all' ? selectedMethod : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        createdBy: isCajero ? profile?.id : undefined,
      })
      setExpenses(expList)
      toast.success('Lista de gastos actualizada')
    } catch {
      toast.error('Error al actualizar datos')
    } finally {
      setRefreshing(false)
    }
  }

  // Filtered Expenses by search text
  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses
    const q = search.toLowerCase()
    return expenses.filter(
      e =>
        e.description.toLowerCase().includes(q) ||
        e.category_name.toLowerCase().includes(q) ||
        (e.receipt_number && e.receipt_number.toLowerCase().includes(q)) ||
        (e.created_by_name && e.created_by_name.toLowerCase().includes(q)) ||
        (e.branch_name && e.branch_name.toLowerCase().includes(q))
    )
  }, [expenses, search])

  // Summary KPIs
  const metrics = useMemo(() => {
    return expensesService.calculateMetrics(filteredExpenses)
  }, [filteredExpenses])

  const displayCategories = useMemo(() => {
    if (categories.length > 0) return categories
    return DEFAULT_EXPENSE_CATEGORIES.map((name, idx) => ({
      id: `cat-${idx + 1}`,
      name,
      is_active: true,
      created_at: '',
    }))
  }, [categories])

  const currentBranchName = useMemo(() => {
    if (isSuperAdmin && !selectedBranchId) return 'Todas las sucursales (Consolidado)'
    const b = branches.find(x => x.id === (isSuperAdmin ? selectedBranchId : activeBranch?.id))
    return b ? b.name : activeBranch?.name || 'Mi Sucursal'
  }, [branches, selectedBranchId, activeBranch, isSuperAdmin])

  // Open Create Modal
  const openCreateModal = () => {
    setFormBranchId(effectiveBranchId || activeBranch?.id || branches[0]?.id || '')
    const defaultCat = displayCategories[0]
    setFormCategoryName(defaultCat?.name || 'Servicios')
    setFormCategoryId(defaultCat?.id || '')
    setFormDescription('')
    setFormAmount('')
    setFormPaymentMethod('cash')
    setFormReceiptNumber('')
    setFormNotes('')
    setShowCreateModal(true)
  }

  // Handle Create Expense Submit
  const handleCreateExpense = async () => {
    if (!formBranchId) {
      toast.error('Selecciona una sucursal para el gasto')
      return
    }
    if (!formDescription.trim()) {
      toast.error('Ingresa una descripción del gasto')
      return
    }
    const amt = parseFloat(formAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Ingresa un monto válido mayor a L 0.00')
      return
    }

    setSubmitting(true)
    try {
      await expensesService.createExpense({
        branchId: formBranchId,
        categoryId: formCategoryId || undefined,
        categoryName: formCategoryName,
        description: formDescription.trim(),
        amount: amt,
        paymentMethod: formPaymentMethod,
        receiptNumber: formReceiptNumber.trim() || undefined,
        notes: formNotes.trim() || undefined,
        cashRegisterId: formPaymentMethod === 'cash' ? (activeRegister?.id || undefined) : undefined,
      })

      toast.success(
        formPaymentMethod === 'cash'
          ? `Gasto de ${formatCurrency(amt, 'L')} registrado. Descontado de caja.`
          : `Gasto de ${formatCurrency(amt, 'L')} registrado correctamente.`
      )
      setShowCreateModal(false)
      handleRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar gasto')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Authorize / Review Expense
  const handleAuthorize = async (exp: Expense) => {
    try {
      await expensesService.authorizeExpense(exp.id)
      toast.success('Gasto verificado y marcado como autorizado')
      handleRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al autorizar gasto')
    }
  }

  // Open Cancel Modal
  const openCancelModal = (exp: Expense) => {
    setExpenseToCancel(exp)
    setCancelReason('')
    setShowCancelModal(true)
  }

  // Handle Confirm Cancel
  const handleConfirmCancel = async () => {
    if (!expenseToCancel) return
    if (!cancelReason.trim()) {
      toast.error('Debes indicar el motivo de la anulación')
      return
    }

    setCancelling(true)
    try {
      await expensesService.cancelExpense(expenseToCancel.id, cancelReason)
      toast.success(
        expenseToCancel.payment_method === 'cash'
          ? 'Gasto anulado. El efectivo fue reintegrado a la caja.'
          : 'Gasto anulado correctamente.'
      )
      setShowCancelModal(false)
      setExpenseToCancel(null)
      setCancelReason('')
      handleRefresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al anular gasto')
    } finally {
      setCancelling(false)
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
          <h1 className="text-2xl font-black text-gray-900 font-display flex items-center gap-2.5">
            <span className="text-2xl">💰</span> Gastos Operativos
          </h1>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            <MapPin size={14} className="text-red-600" />
            Control de egresos y gastos de sucursal para: <strong>{currentBranchName}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openCreateModal}
            className="btn btn-primary font-bold text-xs shadow-md flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus size={16} /> Registrar Gasto
          </button>

          {(isAdmin || isSuperAdmin) && (
            <Link
              to="/gastos/reportes"
              className="btn btn-secondary font-bold text-xs shadow-sm flex items-center gap-1.5"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" /> Reportes de Gastos
            </Link>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-ghost btn-sm p-2 text-gray-500 hover:text-gray-800"
            title="Refrescar datos"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de Sucursal para Super Admin */}
      {isSuperAdmin && (
        <div className="p-3 bg-red-50/60 border border-red-100 rounded-2xl flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-red-600" />
            <span className="text-xs font-bold text-gray-800">Filtrar por Sucursal:</span>
          </div>
          <select
            className="select select-sm text-xs font-bold w-64 bg-white"
            value={selectedBranchId}
            onChange={e => {
              setSelectedBranchId(e.target.value)
              const found = branches.find(b => b.id === e.target.value)
              if (found) setActiveBranch(found)
            }}
          >
            <option value="">Todas las sucursales (Consolidado)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
          <span className="text-[11px] text-gray-500">
            Como Super Admin puedes auditar y registrar gastos de cualquier sucursal.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Gastos */}
        <div className="card p-4 border-l-4 border-l-red-600 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0 text-xl font-bold">
            <DollarSign size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Gastos</p>
            <p className="text-2xl font-black text-gray-900 font-display">
              {formatCurrency(metrics.totalExpenses, 'L')}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold">{metrics.count} gastos activos</p>
          </div>
        </div>

        {/* Efectivo (Salida de Caja) */}
        <div className="card p-4 border-l-4 border-l-amber-500 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Banknote size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Efectivo (Salida Caja)</p>
            <p className="text-2xl font-black text-amber-600 font-display">
              {formatCurrency(metrics.cashExpenses, 'L')}
            </p>
            <p className="text-[10px] text-amber-700 font-bold">Descontado del arqueo de caja</p>
          </div>
        </div>

        {/* Bancos / Tarjeta / Transferencia */}
        <div className="card p-4 border-l-4 border-l-blue-600 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <CreditCard size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tarjeta / Transferencia</p>
            <p className="text-2xl font-black text-blue-600 font-display">
              {formatCurrency(metrics.cardExpenses + metrics.transferExpenses + metrics.otherExpenses, 'L')}
            </p>
            <p className="text-[10px] text-gray-400 font-semibold">No afecta el efectivo en caja</p>
          </div>
        </div>

        {/* Info Turno Activo */}
        <div className="card p-4 border-l-4 border-l-emerald-600 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tu Caja Actual</p>
            <p className="text-sm font-black text-gray-900 font-display">
              {activeRegister ? (
                <span className="text-emerald-700">🟢 Turno Abierto</span>
              ) : (
                <span className="text-gray-400">Sin caja abierta</span>
              )}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {activeRegister ? `Apertura: ${formatCurrency(activeRegister.opening_amount, 'L')}` : 'Gastos en efectivo se asociarán a la sucursal'}
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por descripción, comprobante, usuario..."
            className="input pl-9 text-xs"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">Categoría:</span>
          <select
            className="select text-xs w-40"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="all">Todas</option>
            {displayCategories.map(c => (
              <option key={c.id || c.name} value={c.id || c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">Pago:</span>
          <select
            className="select text-xs w-36"
            value={selectedMethod}
            onChange={e => setSelectedMethod(e.target.value as any)}
          >
            <option value="all">Todos</option>
            <option value="cash">💵 Efectivo</option>
            <option value="card">💳 Tarjeta</option>
            <option value="transfer">🔄 Transferencia</option>
            <option value="other">📑 Otro</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">Estado:</span>
          <select
            className="select text-xs w-32"
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as any)}
          >
            <option value="all">Todos</option>
            <option value="active">🟢 Activos</option>
            <option value="cancelled">🔴 Anulados</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400" />
          <input
            type="date"
            className="input input-sm text-xs w-32"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="text-xs text-gray-400">-</span>
          <input
            type="date"
            className="input input-sm text-xs w-32"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card overflow-hidden">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                {(!effectiveBranchId || isSuperAdmin) && <th>Sucursal</th>}
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Método de Pago</th>
                <th>Registrado por</th>
                <th>Revisión</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    <DollarSign size={36} className="mx-auto mb-2 opacity-30 text-red-500" />
                    <p className="font-semibold text-sm">No se encontraron gastos en este período</p>
                    <button
                      onClick={openCreateModal}
                      className="btn btn-primary btn-sm mt-3 font-bold inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Registrar Primer Gasto
                    </button>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr
                    key={exp.id}
                    className={`hover:bg-gray-50/60 transition-colors text-xs ${
                      exp.status === 'cancelled' ? 'opacity-60 bg-red-50/20' : ''
                    }`}
                  >
                    <td className="whitespace-nowrap font-medium text-gray-600">
                      {formatDateTime(exp.created_at)}
                    </td>

                    {(!effectiveBranchId || isSuperAdmin) && (
                      <td>
                        <span className="badge badge-gray font-semibold">{exp.branch_name}</span>
                      </td>
                    )}

                    <td>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded-md font-bold text-[11px]">
                        {exp.category_name}
                      </span>
                    </td>

                    <td>
                      <div className="max-w-xs">
                        <p className="font-bold text-gray-900 truncate" title={exp.description}>
                          {exp.description}
                        </p>
                        {exp.receipt_number && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <FileText size={10} /> {exp.receipt_number}
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className="font-black text-sm text-gray-900 font-display">
                        {formatCurrency(exp.amount, 'L')}
                      </span>
                    </td>

                    <td>
                      {exp.payment_method === 'cash' && (
                        <span className="badge bg-amber-50 text-amber-700 border border-amber-200 font-bold inline-flex items-center gap-1">
                          <Banknote size={11} /> Efectivo
                        </span>
                      )}
                      {exp.payment_method === 'card' && (
                        <span className="badge bg-blue-50 text-blue-700 border border-blue-200 font-bold inline-flex items-center gap-1">
                          <CreditCard size={11} /> Tarjeta
                        </span>
                      )}
                      {exp.payment_method === 'transfer' && (
                        <span className="badge bg-purple-50 text-purple-700 border border-purple-200 font-bold inline-flex items-center gap-1">
                          <ArrowRightLeft size={11} /> Transfer.
                        </span>
                      )}
                      {exp.payment_method === 'other' && (
                        <span className="badge badge-gray font-bold">Otro</span>
                      )}
                    </td>

                    <td>
                      <div>
                        <p className="font-bold text-gray-900 flex items-center gap-1">
                          <User size={11} className="text-gray-400" />
                          {exp.created_by_name || 'Usuario'}
                        </p>
                        <p className="text-[10px] text-gray-400">{exp.created_by_role || 'Cajero'}</p>
                      </div>
                    </td>

                    <td>
                      {exp.authorized_by ? (
                        <span
                          className="badge badge-green font-bold inline-flex items-center gap-1 text-[10px]"
                          title={`Revisado por ${exp.authorized_by_name || 'Admin'}`}
                        >
                          <CheckCircle2 size={11} /> Revisado
                        </span>
                      ) : (
                        <span className="badge badge-amber font-bold inline-flex items-center gap-1 text-[10px]">
                          <HelpCircle size={11} /> Pendiente
                        </span>
                      )}
                    </td>

                    <td>
                      {exp.status === 'active' ? (
                        <span className="badge badge-green font-bold">Activo</span>
                      ) : (
                        <span
                          className="badge badge-red font-bold cursor-help"
                          title={`Motivo: ${exp.cancellation_reason || 'Sin motivo'}`}
                        >
                          Anulado
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="flex items-center gap-1">
                        {/* Botón Revisar (Solo Admin/SuperAdmin para autorizar) */}
                        {(isAdmin || isSuperAdmin) && !exp.authorized_by && exp.status === 'active' && (
                          <button
                            onClick={() => handleAuthorize(exp)}
                            className="btn btn-sm text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200"
                            title="Marcar como revisado / autorizado"
                          >
                            <ShieldCheck size={12} /> Revisar
                          </button>
                        )}

                        {/* Botón Anular (Solo Admin/SuperAdmin) */}
                        {(isAdmin || isSuperAdmin) && exp.status === 'active' && (
                          <button
                            onClick={() => openCancelModal(exp)}
                            className="btn btn-sm text-[11px] font-bold bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded-lg border border-red-200"
                            title="Anular gasto y reintegrar efectivo si aplica"
                          >
                            <Ban size={12} /> Anular
                          </button>
                        )}

                        {/* Ver Detalle */}
                        <button
                          onClick={() => setSelectedExpenseDetail(exp)}
                          className="btn btn-ghost btn-sm p-1 text-gray-500 hover:text-gray-800"
                          title="Ver detalle completo"
                        >
                          <FileText size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTRAR NUEVO GASTO */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Registrar Gasto Operativo"
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1 font-bold">
              Cancelar
            </button>
            <button
              onClick={handleCreateExpense}
              disabled={submitting}
              className="btn btn-primary flex-1 font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? 'Guardando...' : 'Confirmar Gasto'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Sucursal */}
          <div className="form-group">
            <label className="label">Sucursal del Gasto *</label>
            {isSuperAdmin ? (
              <select
                className="select font-bold text-xs"
                value={formBranchId}
                onChange={e => setFormBranchId(e.target.value)}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input bg-gray-50 font-bold text-xs"
                value={activeBranch?.name || currentBranchName}
                disabled
              />
            )}
          </div>

          {/* Categoría y Método de Pago */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Categoría *</label>
              <select
                className="select font-semibold text-xs"
                value={formCategoryName}
                onChange={e => {
                  const val = e.target.value
                  setFormCategoryName(val)
                  const c = displayCategories.find(x => x.name === val)
                  setFormCategoryId(c?.id || '')
                }}
              >
                {displayCategories.map(c => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Método de Pago *</label>
              <select
                className="select font-bold text-xs"
                value={formPaymentMethod}
                onChange={e => setFormPaymentMethod(e.target.value as ExpensePaymentMethod)}
              >
                <option value="cash">💵 Efectivo (Caja)</option>
                <option value="card">💳 Tarjeta</option>
                <option value="transfer">🔄 Transferencia</option>
                <option value="other">📑 Otro</option>
              </select>
            </div>
          </div>

          {/* Alerta si es efectivo */}
          {formPaymentMethod === 'cash' ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Afecta el Arqueo de Caja</p>
                <p className="text-[11px] text-amber-800">
                  Este monto saldrá del efectivo físico de la caja y se descontará del Efectivo Esperado al cerrar el turno.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center gap-2">
              <CreditCard size={15} className="text-blue-600 shrink-0" />
              <span>Gasto bancario/digital: No descuenta dinero de la caja registradora.</span>
            </div>
          )}

          {/* Monto */}
          <div className="form-group">
            <label className="label">Monto del Gasto (Lempiras) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-gray-500 text-sm">L</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                className="input pl-8 font-black text-lg text-gray-900"
                value={formAmount}
                onChange={e => setFormAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Descripción */}
          <div className="form-group">
            <label className="label">Descripción / Motivo del Gasto *</label>
            <input
              type="text"
              placeholder="Ej: Compra de 2 bolsas de hielo, Recarga de gas para freidora"
              className="input font-medium text-xs"
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
            />
          </div>

          {/* Factura / Comprobante Opcional */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Nº Factura / Recibo (Opcional)</label>
              <input
                type="text"
                placeholder="Ej: FAC-00214"
                className="input text-xs"
                value={formReceiptNumber}
                onChange={e => setFormReceiptNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="label">Observaciones (Opcional)</label>
              <input
                type="text"
                placeholder="Notas adicionales..."
                className="input text-xs"
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL: ANULAR GASTO */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Anular Gasto Operativo"
        size="sm"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowCancelModal(false)} className="btn btn-secondary flex-1 font-bold">
              Volver
            </button>
            <button
              onClick={handleConfirmCancel}
              disabled={cancelling}
              className="btn btn-danger flex-1 font-bold"
            >
              {cancelling ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
            <p className="font-bold text-sm">Gasto: {expenseToCancel?.description}</p>
            <p className="font-black text-red-700 text-base">
              {formatCurrency(expenseToCancel?.amount || 0, 'L')}
            </p>
            {expenseToCancel?.payment_method === 'cash' && (
              <p className="text-[11px] text-red-800 font-semibold">
                ⚠️ Como este gasto fue pagado en Efectivo, al anularse se reintegrará automáticamente al Efectivo Esperado de la caja.
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="label">Motivo de Anulación *</label>
            <textarea
              rows={3}
              className="input text-xs"
              placeholder="Ej: Gasto registrado por error, comprobante duplicado, etc."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* MODAL: DETALLE DE GASTO */}
      <Modal
        isOpen={!!selectedExpenseDetail}
        onClose={() => setSelectedExpenseDetail(null)}
        title="Detalle del Gasto Operativo"
        size="md"
        footer={
          <button onClick={() => setSelectedExpenseDetail(null)} className="btn btn-secondary w-full font-bold">
            Cerrar
          </button>
        }
      >
        {selectedExpenseDetail && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-gray-50 rounded-xl flex justify-between items-center">
              <div>
                <p className="text-gray-400 font-bold uppercase text-[10px]">Monto Total</p>
                <p className="text-2xl font-black text-gray-900 font-display">
                  {formatCurrency(selectedExpenseDetail.amount, 'L')}
                </p>
              </div>
              <div>
                <span
                  className={`badge ${
                    selectedExpenseDetail.status === 'active' ? 'badge-green' : 'badge-red'
                  } font-bold`}
                >
                  {selectedExpenseDetail.status === 'active' ? 'Activo' : 'Anulado'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-bold block">Sucursal:</span>
                <span className="font-black text-gray-900">{selectedExpenseDetail.branch_name}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-bold block">Categoría:</span>
                <span className="font-black text-gray-900">{selectedExpenseDetail.category_name}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-bold block">Método de Pago:</span>
                <span className="font-black text-gray-900 uppercase">{selectedExpenseDetail.payment_method}</span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-bold block">Fecha de Registro:</span>
                <span className="font-black text-gray-900">{formatDateTime(selectedExpenseDetail.created_at)}</span>
              </div>
            </div>

            <div className="p-2.5 bg-gray-50 rounded-xl">
              <span className="text-gray-400 font-bold block">Descripción:</span>
              <p className="font-semibold text-gray-900 mt-0.5">{selectedExpenseDetail.description}</p>
            </div>

            {selectedExpenseDetail.receipt_number && (
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-400 font-bold block">Comprobante / Factura:</span>
                <p className="font-bold text-gray-900 mt-0.5">{selectedExpenseDetail.receipt_number}</p>
              </div>
            )}

            <div className="p-2.5 bg-gray-50 rounded-xl">
              <span className="text-gray-400 font-bold block">Registrado por:</span>
              <p className="font-bold text-gray-900 mt-0.5">
                {selectedExpenseDetail.created_by_name} ({selectedExpenseDetail.created_by_role})
              </p>
            </div>

            {selectedExpenseDetail.authorized_by && (
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <span className="text-emerald-700 font-bold block">Revisado y Autorizado por:</span>
                <p className="font-bold text-emerald-900 mt-0.5">
                  {selectedExpenseDetail.authorized_by_name} ({formatDateTime(selectedExpenseDetail.authorized_at || '')})
                </p>
              </div>
            )}

            {selectedExpenseDetail.status === 'cancelled' && (
              <div className="p-2.5 bg-red-50 rounded-xl border border-red-200">
                <span className="text-red-700 font-bold block">Anulado por:</span>
                <p className="font-bold text-red-900 mt-0.5">
                  {selectedExpenseDetail.cancelled_by_name} — Motivo: {selectedExpenseDetail.cancellation_reason}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
