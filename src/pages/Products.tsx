import { useEffect, useState } from 'react'
import { productsService } from '../services/products.service'
import { Product, Category } from '../types'
import { formatCurrency } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Plus, Search, Edit2, ToggleLeft, ToggleRight, Package } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPTY_PRODUCT: Partial<Product> = {
  name: '', description: '', price: 0, category_id: '',
  status: 'active', is_featured: false, sort_order: 0
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  const [modal, setModal] = useState<{ open: boolean; editing: Partial<Product> | null }>({ open: false, editing: null })
  const [saving, setSaving] = useState(false)
  const [toggleConfirm, setToggleConfirm] = useState<Product | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([
        productsService.getProducts(true),
        productsService.getCategories(true),
      ])
      setProducts(p)
      setCategories(c)
    } catch { toast.error('Error cargando productos') }
    finally { setLoading(false) }
  }

  const openCreate = () => setModal({ open: true, editing: { ...EMPTY_PRODUCT } })
  const openEdit = (p: Product) => setModal({ open: true, editing: { ...p } })

  const save = async () => {
    const { name, price, category_id } = modal.editing || {}
    if (!name?.trim()) return toast.error('El nombre es requerido')
    if (!category_id) return toast.error('Selecciona una categoría')
    if (price === undefined || price < 0) return toast.error('Precio inválido')
    setSaving(true)
    try {
      if (modal.editing?.id) {
        await productsService.update(modal.editing.id, modal.editing)
        toast.success('Producto actualizado')
      } else {
        await productsService.create(modal.editing as Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category_name' | 'category_icon'>)
        toast.success('Producto creado')
      }
      setModal({ open: false, editing: null })
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando')
    } finally { setSaving(false) }
  }

  const toggleStatus = async (p: Product) => {
    try {
      await productsService.toggleStatus(p.id, p.status === 'active' ? 'inactive' : 'active')
      toast.success(p.status === 'active' ? 'Producto desactivado' : 'Producto activado')
      load()
    } catch { toast.error('Error cambiando estado') }
    finally { setToggleConfirm(null) }
  }

  const filtered = products.filter(p => {
    if (!showAll && p.status === 'inactive') return false
    if (catFilter && p.category_id !== catFilter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const setField = (key: string, val: unknown) =>
    setModal(prev => ({ ...prev, editing: { ...prev.editing, [key]: val } }))

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Package size={22} className="text-orange-500" /> Productos
        </h1>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={16} /> Nuevo Producto</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-8" placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select w-48" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
          Ver inactivos
        </label>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-2 opacity-30" />
            <p>No se encontraron productos</p>
          </div>
        ) : filtered.map(p => (
          <div key={p.id} className={`card p-4 flex flex-col gap-3 transition-opacity ${p.status === 'inactive' ? 'opacity-60' : ''}`}>
            <div className="h-20 bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl flex items-center justify-center text-3xl">
              {p.image_url
                ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover rounded-xl" />
                : (p.category_icon || '🍗')}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm line-clamp-2">{p.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{p.category_name}</p>
              <p className="text-lg font-bold text-orange-600 mt-1">{formatCurrency(p.price, 'L')}</p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              <span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'} flex-1 justify-center`}>
                {p.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
              <button onClick={() => openEdit(p)} className="btn btn-ghost btn-sm p-1.5"><Edit2 size={14} /></button>
              <button
                onClick={() => setToggleConfirm(p)}
                className={`btn btn-ghost btn-sm p-1.5 ${p.status === 'active' ? 'text-green-500' : 'text-gray-400'}`}
              >
                {p.status === 'active' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modal.open}
        onClose={() => setModal({ open: false, editing: null })}
        title={modal.editing?.id ? 'Editar Producto' : 'Nuevo Producto'}
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setModal({ open: false, editing: null })} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="label">Nombre *</label>
            <input className="input" value={modal.editing?.name || ''} onChange={e => setField('name', e.target.value)} placeholder="Nombre del producto" />
          </div>
          <div className="form-group">
            <label className="label">Categoría *</label>
            <select className="select" value={modal.editing?.category_id || ''} onChange={e => setField('category_id', e.target.value)}>
              <option value="">Seleccionar categoría</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Precio *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">L</span>
                <input type="number" step="0.01" min="0" className="input pl-8"
                  value={modal.editing?.price || ''} onChange={e => setField('price', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Orden</label>
              <input type="number" min="0" className="input" value={modal.editing?.sort_order || 0}
                onChange={e => setField('sort_order', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Descripción</label>
            <textarea className="textarea" rows={2} value={modal.editing?.description || ''}
              onChange={e => setField('description', e.target.value)} placeholder="Descripción opcional" />
          </div>
          <div className="form-group">
            <label className="label">URL de imagen</label>
            <input className="input" value={modal.editing?.image_url || ''} onChange={e => setField('image_url', e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={modal.editing?.is_featured || false}
                onChange={e => setField('is_featured', e.target.checked)} className="rounded" />
              Destacado
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={modal.editing?.status === 'active'}
                onChange={e => setField('status', e.target.checked ? 'active' : 'inactive')} className="rounded" />
              Activo
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!toggleConfirm}
        onClose={() => setToggleConfirm(null)}
        onConfirm={() => toggleConfirm && toggleStatus(toggleConfirm)}
        title={toggleConfirm?.status === 'active' ? 'Desactivar producto' : 'Activar producto'}
        message={`¿${toggleConfirm?.status === 'active' ? 'Desactivar' : 'Activar'} "${toggleConfirm?.name}"?`}
        variant={toggleConfirm?.status === 'active' ? 'warning' : 'default'}
        confirmLabel={toggleConfirm?.status === 'active' ? 'Desactivar' : 'Activar'}
      />
    </div>
  )
}
