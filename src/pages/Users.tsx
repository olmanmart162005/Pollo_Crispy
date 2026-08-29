import { useEffect, useState } from 'react'
import { usersService, ProfileWithBranches } from '../services/users.service'
import { branchesService } from '../services/branches.service'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { Profile, Branch, UserRole } from '../types'
import { roleLabel, formatDate } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import ResetPasswordModal from '../components/users/ResetPasswordModal'
import {
  Users as UsersIcon,
  Edit2,
  Search,
  UserCheck,
  UserX,
  UserPlus,
  Trash2,
  MapPin,
  KeyRound,
  ShieldAlert,
  AlertTriangle,
  Mail,
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'badge-purple',
  ADMIN: 'badge-blue',
  CAJERO: 'badge-green',
}

interface NewUserForm {
  email: string
  password: string
  fullName: string
  phone: string
  role: UserRole
  branchIds: string[]
}

const INITIAL_FORM: NewUserForm = {
  email: '',
  password: '',
  fullName: '',
  phone: '',
  role: 'CAJERO',
  branchIds: [],
}

export default function Users() {
  const { profile } = useAuth()
  const { activeBranch } = useBranch()
  const { isSuperAdmin, isAdmin } = usePermissions()

  const [users, setUsers] = useState<ProfileWithBranches[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newUser, setNewUser] = useState<NewUserForm>(INITIAL_FORM)
  const [creating, setCreating] = useState(false)

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [userBranches, setUserBranches] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Admin Reset Password Modal
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)

  // Delete & History Check State
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [historyWarningTarget, setHistoryWarningTarget] = useState<{ user: Profile; message: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    load()
  }, [activeBranch?.id])

  const load = async () => {
    setLoading(true)
    try {
      const [u, b] = await Promise.all([usersService.getAll(), branchesService.getAll()])
      setUsers(u)
      setBranches(b)
    } catch {
      toast.error('Error cargando usuarios')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = (defaultRole: UserRole) => {
    const initialBranches = activeBranch ? [activeBranch.id] : []
    setNewUser({
      ...INITIAL_FORM,
      role: defaultRole,
      branchIds: initialBranches,
    })
    setCreateModalOpen(true)
  }

  const handleCreateUser = async () => {
    if (!newUser.fullName.trim()) return toast.error('El nombre completo es requerido')
    if (!newUser.email.trim()) return toast.error('El correo electrónico es requerido')
    if (!newUser.password || newUser.password.length < 6)
      return toast.error('La contraseña debe tener al menos 6 caracteres')

    if (newUser.role !== 'SUPER_ADMIN' && newUser.branchIds.length === 0) {
      return toast.error('Debes seleccionar al menos una sucursal')
    }

    setCreating(true)
    try {
      await usersService.createUser({
        email: newUser.email.trim(),
        password: newUser.password,
        fullName: newUser.fullName.trim(),
        phone: newUser.phone.trim(),
        role: newUser.role,
        branchIds: newUser.role === 'SUPER_ADMIN' ? [] : newUser.branchIds,
      })
      toast.success(`Usuario ${newUser.fullName} creado con éxito`)
      setCreateModalOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error creando usuario')
    } finally {
      setCreating(false)
    }
  }

  const openEdit = async (u: Profile) => {
    setEditing({ ...u })
    const ub = await usersService.getUserBranches(u.id)
    setUserBranches(ub)
    setEditModalOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!editing.full_name.trim()) return toast.error('El nombre completo es requerido')

    setSaving(true)
    try {
      await usersService.updateProfile(editing.id, {
        full_name: editing.full_name.trim(),
        phone: editing.phone?.trim() || undefined,
        role: editing.role,
        is_active: editing.is_active,
        permissions: editing.permissions,
      })
      if (editing.role !== 'SUPER_ADMIN') {
        await usersService.setUserBranches(editing.id, userBranches)
      }
      toast.success('Usuario actualizado correctamente')
      setEditModalOpen(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando usuario')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: Profile) => {
    if (u.id === profile?.id) return toast.error('No puedes desactivar tu propio usuario')
    try {
      await usersService.toggleActive(u.id, !u.is_active)
      toast.success(u.is_active ? 'Usuario desactivado correctamente' : 'Usuario activado correctamente')
      load()
    } catch {
      toast.error('Error al cambiar estado del usuario')
    }
  }

  const handleInitiateDelete = async (u: Profile) => {
    if (u.id === profile?.id) return toast.error('No puedes eliminar tu propio usuario')

    // Verificar si el usuario tiene registros históricos
    const { hasHistory, message } = await usersService.checkUserHistory(u.id)
    if (hasHistory) {
      setHistoryWarningTarget({
        user: u,
        message: message || 'Este usuario tiene registros de ventas o turnos de caja registrados.',
      })
    } else {
      setDeleteTarget(u)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await usersService.deleteUser(deleteTarget.id)
      toast.success('Usuario eliminado correctamente')
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No fue posible eliminar el usuario.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeactivateFromWarning = async () => {
    if (!historyWarningTarget) return
    try {
      await usersService.toggleActive(historyWarningTarget.user.id, false)
      toast.success('Acceso del usuario desactivado correctamente')
      setHistoryWarningTarget(null)
      load()
    } catch {
      toast.error('Error al desactivar usuario')
    }
  }

  const toggleNewBranch = (branchId: string) => {
    setNewUser(prev => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter(b => b !== branchId)
        : [...prev.branchIds, branchId],
    }))
  }

  const toggleEditBranch = (branchId: string) => {
    setUserBranches(prev =>
      prev.includes(branchId) ? prev.filter(b => b !== branchId) : [...prev, branchId]
    )
  }

  // Filtrado de ramas permitidas para Admin al editar/crear
  const allowedBranches = isSuperAdmin
    ? branches
    : branches.filter(b => b.id === activeBranch?.id)

  const canManageUserPassword = (target: Profile): boolean => {
    if (isSuperAdmin) return true
    if (isAdmin && target.role === 'CAJERO') return true
    return false
  }

  const filtered = users.filter(u => {
    if (!isSuperAdmin && u.role === 'SUPER_ADMIN') return false
    if (roleFilter && u.role !== roleFilter) return false
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false

    // STRICT BRANCH FILTERING FOR ACTIVE BRANCH
    if (activeBranch) {
      const belongsToBranch = u.branch_ids?.includes(activeBranch.id)
      const isSuper = u.role === 'SUPER_ADMIN'
      if (!belongsToBranch && !isSuper) return false
    }

    return true
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <UsersIcon size={22} className="text-red-600" /> Administración de Usuarios
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Mostrando usuarios de: <strong>{activeBranch?.name || 'Todas las sucursales'}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button onClick={() => openCreateModal('ADMIN')} className="btn btn-primary font-bold">
              <UserPlus size={16} /> + Nuevo Administrador
            </button>
          )}
          {isAdmin && (
            <button onClick={() => openCreateModal('CAJERO')} className="btn btn-secondary font-bold">
              <UserPlus size={16} /> + Nuevo Cajero
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-8"
            placeholder="Buscar usuario por nombre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select w-48"
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">Todos los roles</option>
          {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
          <option value="ADMIN">Administrador</option>
          <option value="CAJERO">Cajero</option>
        </select>
      </div>

      {/* Tabla de Usuarios */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Sucursal(es)</th>
                <th>Estado</th>
                <th>Registrado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No se encontraron usuarios asignados a {activeBranch?.name || 'esta consulta'}.
                  </td>
                </tr>
              ) : (
                filtered.map(u => (
                  <tr key={u.id} className={!u.is_active ? 'opacity-65 bg-gray-50/80' : ''}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                          {u.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{u.full_name}</p>
                          {u.email && <p className="text-xs text-gray-500 font-mono flex items-center gap-1"><Mail size={10} className="text-gray-400" />{u.email}</p>}
                          {u.phone && <p className="text-xs text-gray-400 font-mono">{u.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[u.role]}`}>{roleLabel(u.role)}</span>
                    </td>
                    <td className="text-xs">
                      {u.role === 'SUPER_ADMIN' ? (
                        <span className="badge badge-purple font-semibold">Todas</span>
                      ) : u.branch_ids && u.branch_ids.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.branch_ids.map(bid => {
                            const bObj = branches.find(b => b.id === bid)
                            return (
                              <span
                                key={bid}
                                className="badge badge-gray font-semibold flex items-center gap-1"
                              >
                                <MapPin size={10} className="text-red-500" />
                                {bObj?.name || 'Sucursal'}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Sin sucursal</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-xs">{formatDate(u.created_at)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {/* Editar */}
                        <button
                          onClick={() => openEdit(u)}
                          className="btn btn-ghost btn-sm p-1.5 text-gray-600 hover:text-red-600"
                          title="Editar usuario"
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Cambiar contraseña administrativa */}
                        {canManageUserPassword(u) && (
                          <button
                            onClick={() => setResetTarget(u)}
                            className="btn btn-ghost btn-sm p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Cambiar contraseña de este usuario"
                          >
                            <KeyRound size={15} />
                          </button>
                        )}

                        {/* Activar / Desactivar */}
                        {u.id !== profile?.id && (
                          <button
                            onClick={() => toggleActive(u)}
                            title={u.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                            className={`btn btn-ghost btn-sm p-1.5 ${
                              u.is_active
                                ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        )}

                        {/* Eliminar (Solo Super Admin) */}
                        {isSuperAdmin && u.id !== profile?.id && (
                          <button
                            onClick={() => handleInitiateDelete(u)}
                            title="Eliminar usuario"
                            className="btn btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700"
                          >
                            <Trash2 size={15} />
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

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={newUser.role === 'ADMIN' ? 'Nuevo Administrador' : 'Nuevo Cajero'}
        size="md"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateUser}
              disabled={creating}
              className="btn btn-primary flex-1 font-bold"
            >
              {creating ? 'Creando usuario...' : 'Crear Usuario'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nombre completo *</label>
            <input
              className="input"
              placeholder="Ej: Juan Carlos Muñoz"
              value={newUser.fullName}
              onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="label">Correo Electrónico *</label>
            <input
              type="email"
              className="input"
              placeholder="correo@ejemplo.com"
              value={newUser.email}
              onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="label">Contraseña de Acceso *</label>
            <input
              type="text"
              className="input font-mono"
              placeholder="Min. 6 caracteres"
              value={newUser.password}
              onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="label">Teléfono</label>
            <input
              className="input"
              placeholder="9999-9999"
              value={newUser.phone}
              onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="label">Rol Asignado</label>
            {isSuperAdmin ? (
              <select
                className="select font-semibold"
                value={newUser.role}
                onChange={e => setNewUser(p => ({ ...p, role: e.target.value as UserRole }))}
              >
                <option value="ADMIN">Administrador</option>
                <option value="CAJERO">Cajero</option>
              </select>
            ) : (
              <input className="input bg-gray-50 font-bold" value="CAJERO" disabled />
            )}
          </div>

          {/* Branch assignment */}
          {newUser.role !== 'SUPER_ADMIN' && (
            <div className="form-group">
              <label className="label">Sucursal(es) Asignada(s) *</label>
              {!isSuperAdmin && activeBranch ? (
                <div className="p-3 bg-red-50 rounded-xl text-sm text-red-900 font-medium border border-red-100 flex items-center gap-2">
                  <MapPin size={16} className="text-red-600" />
                  <span>
                    Se asignará automáticamente a: <strong>{activeBranch.name}</strong>
                  </span>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {branches.map(b => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={newUser.branchIds.includes(b.id)}
                        onChange={() => toggleNewBranch(b.id)}
                        className="rounded text-red-600"
                      />
                      <span>{b.name}</span>
                      <span className="text-xs text-gray-400 font-mono">({b.code})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Usuario"
        size="md"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setEditModalOpen(false)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="btn btn-primary flex-1 font-bold"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="form-group">
              <label className="label">Nombre completo *</label>
              <input
                className="input font-medium"
                value={editing.full_name}
                onChange={e => setEditing(p => ({ ...p!, full_name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="label">Correo Electrónico (Inicio de Sesión)</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium">
                <Mail size={16} className="text-red-500 shrink-0" />
                <span className="truncate">{editing.email || 'Correo no disponible'}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="label">Teléfono</label>
              <input
                className="input"
                value={editing.phone || ''}
                onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))}
                placeholder="+504 9999-9999"
              />
            </div>

            {/* Rol de usuario */}
            <div className="form-group">
              <label className="label">Rol del Usuario</label>
              {isSuperAdmin ? (
                <select
                  className="select font-semibold"
                  value={editing.role}
                  onChange={e =>
                    setEditing(p => ({ ...p!, role: e.target.value as Profile['role'] }))
                  }
                >
                  <option value="CAJERO">Cajero</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              ) : (
                <input
                  className="input bg-gray-50 font-bold"
                  value={roleLabel(editing.role)}
                  disabled
                />
              )}
            </div>

            {/* Sucursales asignadas */}
            {editing.role !== 'SUPER_ADMIN' && (
              <div className="form-group">
                <label className="label">Sucursales Asignadas</label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {allowedBranches.map(b => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={userBranches.includes(b.id)}
                        onChange={() => toggleEditBranch(b.id)}
                        className="rounded text-red-600"
                      />
                      <span>{b.name}</span>
                      <span className="text-xs text-gray-400 font-mono">({b.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Estado Activo */}
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))}
                  className="rounded text-red-600 w-4 h-4"
                />
                <span>Usuario Activo (Permitir acceso al sistema)</span>
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* RESET PASSWORD MODAL FOR ADMIN */}
      <ResetPasswordModal
        user={resetTarget}
        isOpen={!!resetTarget}
        onClose={() => setResetTarget(null)}
        onSuccess={load}
      />

      {/* HISTORICAL DATA WARNING MODAL */}
      <Modal
        isOpen={!!historyWarningTarget}
        onClose={() => setHistoryWarningTarget(null)}
        title="Usuario con Registros Históricos"
        size="md"
        footer={
          <div className="flex gap-2">
            <button
              onClick={() => setHistoryWarningTarget(null)}
              className="btn btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeactivateFromWarning}
              className="btn btn-primary flex-1 font-bold bg-amber-600 hover:bg-amber-700"
            >
              <UserX size={16} /> Desactivar Acceso
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-center py-2">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              No es posible eliminar a "{historyWarningTarget?.user.full_name}" físicamente
            </h3>
            <p className="text-xs text-gray-600 mt-2 leading-relaxed text-left bg-amber-50 p-3 rounded-xl border border-amber-200">
              {historyWarningTarget?.message} Para proteger la integridad del historial contable y financiero de Pollo Crispy, los usuarios con ventas o turnos registrados deben ser <strong>desactivados</strong> en lugar de eliminados.
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Al desactivar al usuario, se bloqueará de inmediato su acceso al sistema sin alterar el historial existente.
          </p>
        </div>
      </Modal>

      {/* DELETE CONFIRM DIALOG FOR USERS WITHOUT HISTORY */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        loading={deleting}
        title="Eliminar Usuario"
        message={`¿Está seguro de eliminar definitivamente al usuario "${deleteTarget?.full_name}"? Esta acción no se puede deshacer.`}
        variant="danger"
        confirmLabel="Eliminar Definitivamente"
      />
    </div>
  )
}
