import { useEffect, useState } from 'react'
import { combosService } from '../services/combos.service'
import { productsService } from '../services/products.service'
import { Combo, Product } from '../types'
import { formatCurrency } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import { Plus, Edit2, Layers, X, Plus as PlusIcon, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface ComboItemInput { product_id: string; quantity: number; product_name?: string; price?: number }

export default function Combos() {
  const [combos, setCombos] = useState<Combo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Partial<Combo> | null>(null)
  const [items, setItems] = useState<ComboItemInput[]>([])
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([combosService.getCombos(true), productsService.getProducts(false)])
      setCombos(c); setProducts(p)
    } catch { toast.error('Error cargando combos') }
    finally { setLoading(false) }
  }

  const openCreate = () => { setEditing({ name: '', price: 0, status: 'active', is_featured: false, sort_order: 0 }); setItems([]); setModal(true) }
  const openEdit = async (c: Combo) => {
    setEditing({ ...c })
    const ci = await combosService.getComboItems(c.id)
    setItems(ci.map(i => ({ product_id: i.product_id, quantity: i.quantity, product_name: i.product_name, price: i.unit_price })))
    setModal(true)
  }

  const addItem = () => {
    if (products.length === 0) return
    const first = products[0]
    setItems(prev => [...prev, { product_id: first.id, quantity: 1, product_name: first.name, price: first.price }])
  }

  const updateItem = (idx: number, field: string, val: string | number) => {
    setItems(prev => {
      const updated = [...prev]
      if (field === 'product_id') {
        const p = products.find(pr => pr.id === val)
        updated[idx] = { ...updated[idx], product_id: val as string, product_name: p?.name, price: p?.price }
      } else {
        updated[idx] = { ...updated[idx], [field]: val }
      }
      return updated
    })
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!editing?.name?.trim()) return toast.error('El nombre es requerido')
    if (items.length === 0) return toast.error('Agrega al menos un producto al combo')
    setSaving(true)
    try {
      let comboId = editing?.id
      if (comboId) {
        await combosService.update(comboId, editing)
      } else {
        const created = await combosService.create(editing as Omit<Combo, 'id' | 'created_at' | 'items'>)
        comboId = created.id
      }
      await combosService.setItems(comboId!, items.map(i => ({ product_id: i.product_id, quantity: i.quantity })))
      toast.success(editing?.id ? 'Combo actualizado' : 'Combo creado')
      setModal(false)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando')
    } finally { setSaving(false) }
  }

  const toggle = async (c: Combo) => {
    try {
      await combosService.toggleStatus(c.id, c.status === 'active' ? 'inactive' : 'active')
      toast.success('Estado actualizado')
      load()
    } catch { toast.error('Error') }
  }

  const displayCombos = showAll ? combos : combos.filter(c => c.status === 'active')

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Layers size={22} className="text-orange-500" /> Combos
        </h1>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="rounded" />
            Ver inactivos
          </label>
          <button onClick={openCreate} className="btn btn-primary"><Plus size={16} /> Nuevo Combo</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayCombos.map(c => (
          <div key={c.id} className={`card p-4 flex flex-col gap-3 ${c.status === 'inactive' ? 'opacity-60' : ''}`}>
            <div className="h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center text-3xl">
              🍱
            </div>
            <div>
              <p className="font-bold text-gray-900">{c.name}</p>
              {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>}
              <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(c.price, 'L')}</p>
              {c.items && (c.items as { product_name?: string; quantity: number }[]).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(c.items as { product_name?: string; quantity: number }[]).slice(0, 3).map((item, i: number) => (
                    <span key={i} className="badge badge-orange text-xs">
                      {item.quantity}× {item.product_name?.split(' ').slice(0, 2).join(' ')}
                    </span>
                  ))}
                  {c.items.length > 3 && <span className="badge badge-gray text-xs">+{c.items.length - 3}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              <span className={`badge ${c.status === 'active' ? 'badge-green' : 'badge-gray'} flex-1 justify-center`}>
                {c.status === 'active' ? 'Activo' : 'Inactivo'}
              </span>
              <button onClick={() => openEdit(c)} className="btn btn-ghost btn-sm p-1.5"><Edit2 size={14} /></button>
              <button onClick={() => toggle(c)} className="btn btn-ghost btn-sm p-1.5">
                {c.status === 'active' ? <X size={14} className="text-red-400" /> : <PlusIcon size={14} className="text-green-500" />}
              </button>
            </div>
          </div>
        ))}
        {displayCombos.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            <Layers size={40} className="mx-auto mb-2 opacity-30" /><p>No hay combos</p>
          </div>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing?.id ? 'Editar Combo' : 'Nuevo Combo'} size="lg"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setModal(false)} className="btn btn-secondary flex-1">Cancelar</button>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group col-span-2">
              <label className="label">Nombre *</label>
              <input className="input" value={editing?.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="Nombre del combo" />
            </div>
            <div className="form-group">
              <label className="label">Precio *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">L</span>
                <input type="number" step="0.01" min="0" className="input pl-8"
                  value={editing?.price || ''} onChange={e => setEditing(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Orden</label>
              <input type="number" min="0" className="input" value={editing?.sort_order || 0}
                onChange={e => setEditing(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group col-span-2">
              <label className="label">Descripción</label>
              <textarea className="textarea" rows={2} value={editing?.description || ''}
                onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} placeholder="Descripción del combo..." />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Productos incluidos *</label>
              <button onClick={addItem} className="btn btn-primary btn-sm"><Plus size={12} /> Agregar</button>
            </div>
            {items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">Agrega productos al combo</p>
            )}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 rounded-xl p-2">
                  <select className="select flex-1 text-sm"
                    value={item.product_id}
                    onChange={e => updateItem(idx, 'product_id', e.target.value)}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price, 'L')}</option>)}
                  </select>
                  <input type="number" min="1" className="input w-20 text-center text-sm"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                  <button onClick={() => removeItem(idx)} className="btn btn-ghost btn-sm p-1.5 text-red-400 hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing?.is_featured || false}
                onChange={e => setEditing(p => ({ ...p, is_featured: e.target.checked }))} className="rounded" />
              Destacado
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={editing?.status === 'active'}
                onChange={e => setEditing(p => ({ ...p, status: e.target.checked ? 'active' : 'inactive' }))} className="rounded" />
              Activo
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
