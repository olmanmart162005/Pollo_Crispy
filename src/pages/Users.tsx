import { useEffect, useState } from 'react'
import { usersService } from '../services/users.service'
import { branchesService } from '../services/branches.service'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { Profile, Branch, UserRole } from '../types'
import { roleLabel, formatDate } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Users as UsersIcon, Edit2, Search, UserCheck, UserX, UserPlus, Trash2 } from 'lucide-react'
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

  const [users, setUsers] = useState<Profile[]>([])
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

  // Delete Confirm
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [u, b] = await Promise.all([usersService.getAll(), branchesService.getAll()])
      setUsers(u); setBranches(b)
    } catch { toast.error('Error cargando usuarios') }
    finally { setLoading(false) }
  }

  const openCreateModal = (defaultRole: UserRole) => {
    const initialBranches = !isSuperAdmin && activeBranch ? [activeBranch.id] : []
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
    if (!newUser.password || newUser.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')

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
    setSaving(true)
    try {
      await usersService.updateProfile(editing.id, {
        full_name: editing.full_name,
        phone: editing.phone,
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
    } finally { setSaving(false) }
  }

  const toggleActive = async (u: Profile) => {
    if (u.id === profile?.id) return toast.error('No puedes desactivar tu propio usuario')
    try {
      await usersService.toggleActive(u.id, !u.is_active)
      toast.success(u.is_active ? 'Usuario desactivado' : 'Usuario activado')
      load()
    } catch { toast.error('Error al cambiar estado') }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await usersService.deleteUser(deleteTarget.id)
      toast.success(`Usuario ${deleteTarget.full_name} eliminado definitivamente`)
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error eliminando usuario')
    } finally {
      setDeleting(false)
    }
  }

  const toggleNewBranch = (branchId: string) => {
    setNewUser(prev => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter(b => b !== branchId)
        : [...prev.branchIds, branchId]
    }))
  }

  const toggleEditBranch = (branchId: string) => {
    setUserBranches(prev => prev.includes(branchId) ? prev.filter(b => b !== branchId) : [...prev, branchId])
  }

  const filtered = users.filter(u => {
    if (!isSuperAdmin && u.role === 'SUPER_ADMIN') return false
    if (roleFilter && u.role !== roleFilter) return false
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <UsersIcon size={22} className="text-orange-500" /> Administración de Usuarios
        </h1>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button onClick={() => openCreateModal('ADMIN')} className="btn btn-primary">
              <UserPlus size={16} /> + Nuevo Administrador
            </button>
          )}
          {isAdmin && (
            <button onClick={() => openCreateModal('CAJERO')} className="btn btn-secondary">
              <UserPlus size={16} /> + Nuevo Cajero
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="Buscar usuario por nombre..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-48" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Todos los roles</option>
          {isSuperAdmin && <option value="SUPER_ADMIN">Super Admin</option>}
          <option value="ADMIN">Administrador</option>
          <option value="CAJERO">Cajero</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr>
              <th>Usuario</th><th>Rol</th><th>Estado</th><th>Registrado</th><th>Acciones</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No se encontraron usuarios</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id} className={!u.is_active ? 'opacity-60 bg-gray-50' : ''}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {u.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                        {u.phone && <p className="text-xs text-gray-400">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{roleLabel(u.role)}</span></td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="text-xs">{formatDate(u.created_at)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="btn btn-ghost btn-sm p-1.5" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      {u.id !== profile?.id && (
                        <>
                          <button onClick={() => toggleActive(u)} title={u.is_active ? 'Desactivar' : 'Activar'}
                            className={`btn btn-ghost btn-sm p-1.5 ${u.is_active ? 'text-red-400 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}>
                            {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                          {isSuperAdmin && (
                            <button onClick={() => setDeleteTarget(u)} title="Eliminar definitivamente"
                              className="btn btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-100 hover:text-red-700">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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
            <button onClick={() => setCreateModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreateUser} disabled={creating} className="btn btn-primary flex-1">
              {creating ? 'Creando usuario...' : 'Crear Usuario'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nombre completo *</label>
            <input className="input" placeholder="Ej: Juan Carlos Muñoz"
              value={newUser.fullName} onChange={e => setNewUser(p => ({ ...p, fullName: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="label">Correo Electrónico *</label>
            <input type="email" className="input" placeholder="correo@ejemplo.com"
              value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="label">Contraseña Temporal *</label>
            <input type="text" className="input" placeholder="Min. 6 caracteres"
              value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="label">Teléfono</label>
            <input className="input" placeholder="9999-9999"
              value={newUser.phone} onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="label">Rol Asignado</label>
            {isSuperAdmin ? (
              <select className="select" value={newUser.role}
                onChange={e => setNewUser(p => ({ ...p, role: e.target.value as UserRole }))}>
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
                <div className="p-3 bg-orange-50 rounded-xl text-sm text-orange-800 font-medium">
                  Se asignará automáticamente a: <strong>{activeBranch.name}</strong>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                      <input type="checkbox" checked={newUser.branchIds.includes(b.id)}
                        onChange={() => toggleNewBranch(b.id)} className="rounded text-orange-500" />
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
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Editar Usuario" size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setEditModalOpen(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={handleSaveEdit} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="form-group">
              <label className="label">Nombre completo</label>
              <input className="input" value={editing.full_name} onChange={e => setEditing(p => ({ ...p!, full_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="label">Teléfono</label>
              <input className="input" value={editing.phone || ''} onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))} />
            </div>
            {isSuperAdmin && (
              <div className="form-group">
                <label className="label">Rol</label>
                <select className="select" value={editing.role} onChange={e => setEditing(p => ({ ...p!, role: e.target.value as Profile['role'] }))}>
                  <option value="CAJERO">Cajero</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
            )}
            {editing.role !== 'SUPER_ADMIN' && isSuperAdmin && (
              <div className="form-group">
                <label className="label">Sucursales asignadas</label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={userBranches.includes(b.id)}
                        onChange={() => toggleEditBranch(b.id)} className="rounded text-orange-500" />
                      <span className="font-medium">{b.name}</span>
                      <span className="text-xs text-gray-400 font-mono">({b.code})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="form-group">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                <input type="checkbox" checked={editing.is_active}
                  onChange={e => setEditing(p => ({ ...p!, is_active: e.target.checked }))} className="rounded" />
                Usuario activo
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        loading={deleting}
        title="Eliminar Administrador / Usuario"
        message={`¿Estás seguro de que deseas eliminar definitivamente a "${deleteTarget?.full_name}"? Esta acción eliminará su cuenta de acceso de forma permanente.`}
        variant="danger"
        confirmLabel="Eliminar Definitivamente"
      />
    </div>
  )
}
