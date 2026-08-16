import { useEffect, useState } from 'react'
import { branchesService } from '../services/branches.service'
import { Branch } from '../types'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Edit2, Store, MapPin, Phone, ToggleRight, ToggleLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY: Partial<Branch> = { name: '', code: '', address: '', phone: '', city: '', department: '', status: 'active' }

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Branch>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<Branch | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { setBranches(await branchesService.getAll()) }
    catch { toast.error('Error cargando sucursales') }
    finally { setLoading(false) }
  }

  const save = async () => {
    if (!editing.name?.trim() || !editing.code?.trim()) return toast.error('Nombre y código son requeridos')
    setSaving(true)
    try {
      if (editing.id) {
        await branchesService.update(editing.id, editing)
        toast.success('Sucursal actualizada')
      } else {
        await branchesService.create(editing as Omit<Branch, 'id' | 'created_at' | 'updated_at'>)
        toast.success('Sucursal creada')
      }
      setModal(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando')
    } finally { setSaving(false) }
  }

  const toggle = async (b: Branch) => {
    try {
      await branchesService.toggleStatus(b.id, b.status === 'active' ? 'inactive' : 'active')
      toast.success('Estado actualizado')
      load()
    } catch { toast.error('Error') }
    finally { setToggleTarget(null) }
  }

  const set = (k: string, v: string) => setEditing(p => ({ ...p, [k]: v }))

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Store size={22} className="text-orange-500" /> Sucursales
        </h1>
        <button onClick={() => { setEditing(EMPTY); setModal(true) }} className="btn btn-primary">
          <Plus size={16} /> Nueva Sucursal
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map(b => (
          <div key={b.id} className={`card p-5 flex flex-col gap-3 ${b.status === 'inactive' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Store size={22} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{b.name}</p>
                  <span className="text-xs font-mono bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-bold">{b.code}</span>
                </div>
              </div>
              <span className={`badge ${b.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                {b.status === 'active' ? 'Activa' : 'Inactiva'}
              </span>
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              {b.address && <div className="flex items-center gap-2"><MapPin size={13} className="text-gray-400" />{b.address}</div>}
              {b.phone && <div className="flex items-center gap-2"><Phone size={13} className="text-gray-400" />{b.phone}</div>}
              {(b.city || b.department) && (
                <div className="flex items-center gap-2">
                  <span>📍</span>{[b.city, b.department].filter(Boolean).join(', ')}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1 border-t border-gray-50">
              <button onClick={() => { setEditing({ ...b }); setModal(true) }} className="btn btn-secondary btn-sm flex-1">
                <Edit2 size={13} /> Editar
              </button>
              <button onClick={() => setToggleTarget(b)}
                className={`btn btn-sm px-3 ${b.status === 'active' ? 'btn-ghost text-red-400 hover:bg-red-50' : 'btn-ghost text-green-500 hover:bg-green-50'}`}>
                {b.status === 'active' ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing?.id ? 'Editar Sucursal' : 'Nueva Sucursal'} size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setModal(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'name', label: 'Nombre *', col: 2, placeholder: 'Ej: Sucursal Centro' },
            { key: 'code', label: 'Código *', col: 1, placeholder: 'Ej: SUC04' },
            { key: 'phone', label: 'Teléfono', col: 1, placeholder: '9999-9999' },
            { key: 'address', label: 'Dirección', col: 2, placeholder: 'Dirección completa' },
            { key: 'city', label: 'Ciudad', col: 1, placeholder: 'Choluteca' },
            { key: 'department', label: 'Departamento', col: 1, placeholder: 'Choluteca' },
          ].map(f => (
            <div key={f.key} className={`form-group ${f.col === 2 ? 'col-span-2' : ''}`}>
              <label className="label">{f.label}</label>
              <input className="input" placeholder={f.placeholder}
                value={(editing as Record<string, string>)[f.key] || ''}
                onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggleTarget && toggle(toggleTarget)}
        title={toggleTarget?.status === 'active' ? 'Desactivar sucursal' : 'Activar sucursal'}
        message={`¿${toggleTarget?.status === 'active' ? 'Desactivar' : 'Activar'} la sucursal "${toggleTarget?.name}"?`}
        variant={toggleTarget?.status === 'active' ? 'warning' : 'default'}
        confirmLabel={toggleTarget?.status === 'active' ? 'Desactivar' : 'Activar'}
      />
    </div>
  )
}
