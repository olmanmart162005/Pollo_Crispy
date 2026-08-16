import { useEffect, useState } from 'react'
import { productsService } from '../services/products.service'
import { Category } from '../types'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Plus, Edit2, ClipboardList, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'

const ICONS = ['🍗','🍱','🍟','🥤','🎂','🧂','🍔','🌮','🥩','🫕','🍕','🥗','🍰','☕','📦','⭐','🌶️','🧀']

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing: Partial<Category> | null }>({ open: false, editing: null })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { setCategories(await productsService.getCategories(true)) }
    catch { toast.error('Error cargando categorías') }
    finally { setLoading(false) }
  }

  const save = async () => {
    if (!modal.editing?.name?.trim()) return toast.error('El nombre es requerido')
    setSaving(true)
    try {
      if (modal.editing?.id) {
        await productsService.updateCategory(modal.editing.id, modal.editing)
        toast.success('Categoría actualizada')
      } else {
        await productsService.createCategory({ name: modal.editing.name, description: modal.editing.description, icon: modal.editing.icon || '📦', sort_order: modal.editing.sort_order || 0, is_active: true })
        toast.success('Categoría creada')
      }
      setModal({ open: false, editing: null })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando')
    } finally { setSaving(false) }
  }

  const toggle = async (c: Category) => {
    try {
      await productsService.updateCategory(c.id, { is_active: !c.is_active })
      toast.success(c.is_active ? 'Categoría desactivada' : 'Categoría activada')
      load()
    } catch { toast.error('Error') }
  }

  const setField = (k: string, v: unknown) => setModal(p => ({ ...p, editing: { ...p.editing, [k]: v } }))

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <ClipboardList size={22} className="text-orange-500" /> Categorías
        </h1>
        <button onClick={() => setModal({ open: true, editing: { icon: '📦', sort_order: 0, is_active: true } })} className="btn btn-primary">
          <Plus size={16} /> Nueva Categoría
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map(c => (
          <div key={c.id} className={`card p-4 flex items-center gap-3 transition-opacity ${!c.is_active ? 'opacity-60' : ''}`}>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl shrink-0">
              {c.icon || '📦'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{c.name}</p>
              {c.description && <p className="text-xs text-gray-500 truncate">{c.description}</p>}
              <span className={`badge mt-1 ${c.is_active ? 'badge-green' : 'badge-gray'}`}>
                {c.is_active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => setModal({ open: true, editing: { ...c } })} className="btn btn-ghost btn-sm p-1.5">
                <Edit2 size={14} />
              </button>
              <button onClick={() => toggle(c)} className={`btn btn-ghost btn-sm p-1.5 ${c.is_active ? 'text-green-500' : 'text-gray-400'}`}>
                {c.is_active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modal.open} onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? 'Editar Categoría' : 'Nueva Categoría'} size="sm"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setModal({ open: false, editing: null })} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nombre *</label>
            <input className="input" value={modal.editing?.name || ''} onChange={e => setField('name', e.target.value)} placeholder="Ej: Piezas de Pollo" />
          </div>
          <div className="form-group">
            <label className="label">Descripción</label>
            <input className="input" value={modal.editing?.description || ''} onChange={e => setField('description', e.target.value)} placeholder="Descripción opcional" />
          </div>
          <div className="form-group">
            <label className="label">Icono</label>
            <div className="grid grid-cols-9 gap-1 p-2 bg-gray-50 rounded-xl">
              {ICONS.map(icon => (
                <button key={icon} type="button"
                  onClick={() => setField('icon', icon)}
                  className={`h-9 rounded-lg text-xl flex items-center justify-center transition-all ${modal.editing?.icon === icon ? 'bg-orange-500 shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">Seleccionado: {modal.editing?.icon}</p>
          </div>
          <div className="form-group">
            <label className="label">Orden de visualización</label>
            <input type="number" min="0" className="input" value={modal.editing?.sort_order || 0} onChange={e => setField('sort_order', parseInt(e.target.value) || 0)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
