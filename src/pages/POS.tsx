import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { productsService } from '../services/products.service'
import { combosService } from '../services/combos.service'
import { salesService } from '../services/sales.service'
import { cashService } from '../services/cash.service'
import { Product, Category, Combo, CartItem, PaymentMethod, DiscountType, CashRegisterRecord } from '../types'
import { formatCurrency } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import SaleTicket from '../components/pos/SaleTicket'
import {
  ShoppingCart, Plus, Minus, Trash2, Search,
  CreditCard, Banknote, Smartphone, MoreHorizontal,
  CheckCircle, AlertCircle, Package, X, Percent, Hash, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Efectivo', icon: <Banknote size={18} /> },
  { value: 'card', label: 'Tarjeta', icon: <CreditCard size={18} /> },
  { value: 'transfer', label: 'Transferencia', icon: <Smartphone size={18} /> },
  { value: 'other', label: 'Otro', icon: <MoreHorizontal size={18} /> },
]

function getProductImg(product: Product): string {
  if (product.image_url && product.image_url.startsWith('/assets/')) {
    return product.image_url
  }
  const n = product.name.toLowerCase()
  if (n.includes('asado')) {
    if (n.includes('pechuga') || n.includes('ala')) return '/assets/pierna-pechuga.jpg'
    if (n.includes('pierna') || n.includes('muslo')) return '/assets/pierna-pechuga.jpg'
    return '/assets/pollo-entero-asado.jpg'
  }
  if (n.includes('pechuga')) return '/assets/pechuga.jpg'
  if (n.includes('muslo')) return '/assets/muslo.jpg'
  if (n.includes('pierna')) return '/assets/pierna.jpg'
  if (n.includes('ala')) return '/assets/ala.jpg'
  if (n.includes('entero')) return '/assets/pollo-entero-frito.jpg'
  if (n.includes('medio')) return '/assets/Crispy2.jpg'
  if (n.includes('1 pieza') || n.includes('pieza')) return '/assets/Crispy1.jpg'
  if (n.includes('2 pieza')) return '/assets/Crispy2.jpg'
  if (n.includes('3 pieza') || n.includes('4 pieza') || n.includes('6 pieza') || n.includes('8 pieza') || n.includes('10 pieza')) return '/assets/Crispy3.jpg'
  if (n.includes('papa') || n.includes('yuca') || n.includes('ensalada')) return '/assets/papas.jpg'
  if (n.includes('pepsi') || n.includes('7up') || n.includes('mirinda') || n.includes('bebida') || n.includes('refresco')) return '/assets/refrescos.jpg'
  return product.image_url || '/assets/Crispy1.jpg'
}

function getComboImg(combo: Combo): string {
  if (combo.image_url && combo.image_url.startsWith('/assets/')) {
    return combo.image_url
  }
  const n = combo.name.toLowerCase()
  if (n.includes('chilakil') || n.includes('chilaquil')) return '/assets/Chilaquiles.jpg'
  if (n.includes('muslo') && n.includes('tajada')) return '/assets/muslo con tajadas.jpg'
  if (n.includes('pechuga') && n.includes('tajada')) return '/assets/pechuga con tajadas.jpg'
  if (n.includes('pierna') && n.includes('tajada')) return '/assets/pierna con tajadas.jpg'
  if (n.includes('ala') && n.includes('tajada')) return '/assets/alas con tajadas.jpg'
  if (n.includes('ala') && n.includes('papa')) return '/assets/alas con papas.jpg'
  if (n.includes('pareja')) return '/assets/combo-pareja.jpg'
  if (n.includes('medio')) return '/assets/Crispy3.jpg'
  if (n.includes('individual') || n.includes('1')) return '/assets/combo1.jpg'
  if (n.includes('2')) return '/assets/combo2.jpg'
  if (n.includes('3')) return '/assets/combo3.jpg'
  if (n.includes('familiar')) return '/assets/combo4.jpg'
  if (n.includes('tajada') || n.includes('papa')) return '/assets/papas.jpg'
  return combo.image_url || '/assets/combo1.jpg'
}

export default function POS() {
  const { profile } = useAuth()
  const { activeBranch } = useBranch()
  const { can } = usePermissions()

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [combos, setCombos] = useState<Combo[]>([])
  const [openRegister, setOpenRegister] = useState<CashRegisterRecord | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showCombos, setShowCombos] = useState(false)
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [showMobileCartModal, setShowMobileCartModal] = useState(false)

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountReceived, setAmountReceived] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [notes, setNotes] = useState('')

  // Modals
  const [showPayModal, setShowPayModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<{
    saleId: string; saleNumber: string; total: number; change: number; items: CartItem[]
    paymentMethod: PaymentMethod; amountReceived: number; branchName: string; cashierName: string
    customerName?: string; discountAmount?: number; subtotal?: number
  } | null>(null)
  const [showTicket, setShowTicket] = useState(false)

  useEffect(() => { loadData() }, [activeBranch?.id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prods, cats, cbs] = await Promise.all([
        productsService.getProducts(false),
        productsService.getCategories(false),
        combosService.getCombos(false),
      ])
      setProducts(prods)
      setCategories(cats)
      setCombos(cbs)

      if (profile?.id) {
        const reg = await cashService.getOpenRegister(profile.id, activeBranch?.id)
        setOpenRegister(reg)
      }
    } catch (err) {
      console.error(err)
      toast.error('Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  // Filtered products
  const displayedProducts = useMemo(() => {
    let list = products
    if (search) {
      list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    } else if (activeCategory !== 'all') {
      list = list.filter(p => p.category_id === activeCategory)
    }
    return list
  }, [products, search, activeCategory])

  const displayedCombos = useMemo(() => {
    if (!search) return combos
    return combos.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  }, [combos, search])

  // Cart operations
  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === item.type)
      if (existing) {
        return prev.map(i => i.id === item.id && i.type === item.type
          ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { ...item, quantity: 1 }]
    })
    toast.success(`${item.name} agregado`, { duration: 1500, position: 'bottom-center' })
  }

  const updateQty = (id: string, type: string, delta: number) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.id === id && i.type === type) {
          const newQty = i.quantity + delta
          return newQty <= 0 ? null : { ...i, quantity: newQty }
        }
        return i
      }).filter(Boolean) as CartItem[]
    })
  }

  const removeFromCart = (id: string, type: string) => {
    setCart(prev => prev.filter(i => !(i.id === id && i.type === type)))
  }

  // Calculations
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const discountNum = parseFloat(discountValue) || 0
  const discountAmount = can('apply_discount') && discountNum > 0
    ? discountType === 'percentage'
      ? Math.round(subtotal * discountNum / 100 * 100) / 100
      : Math.min(discountNum, subtotal)
    : 0
  const total = subtotal - discountAmount
  const received = parseFloat(amountReceived) || 0
  const change = Math.max(0, received - total)
  const totalCartItemsCount = cart.reduce((s, i) => s + i.quantity, 0)

  const handlePay = async () => {
    if (cart.length === 0) return toast.error('El carrito está vacío')
    if (!activeBranch) return toast.error('Selecciona una sucursal')
    if (!profile) return
    if (paymentMethod === 'cash' && received < total) {
      return toast.error(`El efectivo recibido (${formatCurrency(received, 'L')}) es menor al total (${formatCurrency(total, 'L')})`)
    }

    setProcessing(true)
    try {
      const result = await salesService.registerSale({
        branchId: activeBranch.id,
        cashierId: profile.id,
        cashRegisterId: openRegister?.id,
        customerName: customerName || undefined,
        items: cart,
        paymentMethod,
        amountReceived: paymentMethod === 'cash' ? received : undefined,
        discountType: discountAmount > 0 ? discountType : undefined,
        discountValue: discountAmount > 0 ? discountNum : undefined,
        discountBy: discountAmount > 0 ? profile.id : undefined,
        notes: notes || undefined,
      })

      setCompletedSale({
        saleId: result.sale_id,
        saleNumber: result.sale_number,
        total: result.total,
        change: result.change_given || 0,
        items: [...cart],
        paymentMethod,
        amountReceived: received,
        branchName: activeBranch.name,
        cashierName: profile.full_name,
        customerName: customerName || undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        subtotal,
      })

      setShowPayModal(false)
      setShowMobileCartModal(false)
      setShowTicket(true)
      toast.success(`Venta ${result.sale_number} registrada`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la venta'
      toast.error(msg)
    } finally {
      setProcessing(false)
    }
  }

  const handleNewSale = () => {
    setCart([])
    setPaymentMethod('cash')
    setAmountReceived('')
    setDiscountValue('')
    setCustomerName('')
    setNotes('')
    setCompletedSale(null)
    setShowTicket(false)
    setShowMobileCartModal(false)
  }

  if (loading) return <PageLoader />

  if (!openRegister) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="card p-8 sm:p-10 text-center max-w-md w-full">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2 font-display">Caja no aperturada</h2>
          <p className="text-gray-500 mb-6 text-xs sm:text-sm">
            Para realizar ventas debes abrir tu turno de caja en <strong>{activeBranch?.name || 'la sucursal'}</strong>.
          </p>
          <a href="/caja" className="btn btn-primary btn-lg w-full font-bold">
            Ir a Abrir Caja
          </a>
        </div>
      </div>
    )
  }

  // Ticket view
  if (showTicket && completedSale) {
    return (
      <SaleTicket
        sale={completedSale}
        onNewSale={handleNewSale}
        onClose={() => setShowTicket(false)}
      />
    )
  }

  const CartItemsList = (
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
          <ShoppingCart size={40} className="mb-2 opacity-20 text-red-500" />
          <p className="text-sm">Agrega productos al carrito</p>
        </div>
      ) : (
        cart.map(item => (
          <div key={`${item.type}-${item.id}`}
            className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5 border border-gray-100">
            <div className="text-lg shrink-0">
              {item.type === 'combo' ? '🍱' : '🍗'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-red-600 font-extrabold">{formatCurrency(item.price * item.quantity, 'L')}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => updateQty(item.id, item.type, -1)}
                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600 font-bold"
              >
                <Minus size={12} />
              </button>
              <span className="w-6 text-center text-xs font-extrabold">{item.quantity}</span>
              <button
                onClick={() => updateQty(item.id, item.type, 1)}
                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 font-bold"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={() => removeFromCart(item.id, item.type)}
                className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600 ml-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const CartFooterSummary = (
    <>
      <div className="px-4 py-3 border-t border-gray-100 space-y-1.5 bg-gray-50/50">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Subtotal</span>
          <span className="font-semibold">{formatCurrency(subtotal, 'L')}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs text-red-500 font-semibold">
            <span>Descuento</span>
            <span>-{formatCurrency(discountAmount, 'L')}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-extrabold text-gray-900 pt-1 border-t border-dashed border-gray-200">
          <span>TOTAL</span>
          <span className="text-red-600 text-lg font-black">{formatCurrency(total, 'L')}</span>
        </div>
      </div>

      <div className="p-3 bg-white">
        <button
          onClick={() => setShowPayModal(true)}
          disabled={cart.length === 0}
          className="btn btn-primary btn-lg w-full font-bold text-sm shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <CheckCircle size={18} />
          Cobrar {cart.length > 0 && formatCurrency(total, 'L')}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-7rem)] pb-20 lg:pb-0">
      {/* LEFT: Products Grid Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 h-10 text-sm"
            placeholder="Buscar producto o combo..."
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveCategory('all') }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        {!search && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 shrink-0 no-scrollbar">
            <button
              onClick={() => { setShowCombos(false); setActiveCategory('all') }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                !showCombos && activeCategory === 'all'
                  ? 'bg-red-600 text-white shadow-md shadow-red-200 border-b-2 border-red-800'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setShowCombos(true)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                showCombos
                  ? 'bg-red-600 text-white shadow-md shadow-red-200 border-b-2 border-red-800'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
              }`}
            >
              🍱 Combos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setShowCombos(false); setActiveCategory(cat.id) }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  !showCombos && activeCategory === cat.id
                    ? 'bg-red-600 text-white shadow-md shadow-red-200 border-b-2 border-red-800'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products & Combos Responsive Grid */}
        <div className="flex-1 overflow-y-auto">
          {showCombos || (search && displayedCombos.length > 0) ? (
            <>
              {search && <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Combos</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 mb-4">
                {(search ? displayedCombos : combos).map(combo => {
                  const imgSrc = getComboImg(combo)
                  return (
                    <button
                      key={combo.id}
                      onClick={() => addToCart({ type: 'combo', id: combo.id, name: combo.name, price: combo.price })}
                      className="bg-white border-t-4 border-t-red-600 border border-gray-100 rounded-2xl overflow-hidden text-left hover:border-red-300 hover:shadow-xl transition-all duration-200 active:scale-95 group flex flex-col h-full"
                    >
                      <div className="w-full h-32 sm:h-44 md:h-52 bg-white p-2 sm:p-3 border-b border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        <img
                          src={imgSrc}
                          alt={combo.name}
                          className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                        <span
                          className="text-4xl sm:text-6xl absolute inset-0 flex items-center justify-center"
                          style={{ display: 'none' }}
                        >🍱</span>
                      </div>
                      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col bg-white">
                        <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight flex-1">{combo.name}</p>
                        <p className="text-base sm:text-lg font-black text-red-600 mt-1">{formatCurrency(combo.price, 'L')}</p>
                        <div className="flex items-center justify-center mt-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-1.5 sm:py-2 text-xs font-bold transition-all shadow-sm">
                          <Plus size={14} className="mr-1" /> Agregar
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}

          {(!showCombos || search) && (
            <>
              {search && displayedProducts.length > 0 && <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-wider">Productos</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4">
                {displayedProducts.map(product => {
                  const imgSrc = getProductImg(product)
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart({ type: 'product', id: product.id, name: product.name, price: product.price })}
                      className="bg-white border-t-4 border-t-red-600 border border-gray-100 rounded-2xl overflow-hidden text-left hover:border-red-300 hover:shadow-xl transition-all duration-200 active:scale-95 group flex flex-col h-full"
                    >
                      <div className="w-full h-32 sm:h-44 md:h-52 bg-white p-2 sm:p-3 border-b border-gray-100 flex items-center justify-center overflow-hidden shrink-0 relative">
                        <img
                          src={imgSrc}
                          alt={product.name}
                          className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            if (e.currentTarget.nextElementSibling) {
                              (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                        <span
                          className="text-4xl sm:text-6xl absolute inset-0 flex items-center justify-center"
                          style={{ display: 'none' }}
                        >{product.category_icon || '🍗'}</span>
                      </div>
                      <div className="p-2.5 sm:p-3.5 flex-1 flex flex-col bg-white">
                        <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight flex-1">{product.name}</p>
                        <p className="text-base sm:text-lg font-black text-red-600 mt-1">{formatCurrency(product.price, 'L')}</p>
                        <div className="flex items-center justify-center mt-2 bg-red-600 hover:bg-red-700 text-white rounded-xl py-1.5 sm:py-2 text-xs font-bold transition-all shadow-sm">
                          <Plus size={14} className="mr-1" /> Agregar
                        </div>
                      </div>
                    </button>
                  )
                })}
                {displayedProducts.length === 0 && !showCombos && (
                  <div className="col-span-full text-center py-12 text-gray-400">
                    <Package size={40} className="mx-auto mb-2 opacity-30 text-red-500" />
                    <p className="text-sm font-medium">No se encontraron productos en esta búsqueda</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT DESKTOP: Cart Sidebar (Visible on desktop lg:flex) */}
      <div className="hidden lg:flex w-80 xl:w-96 flex-col bg-white rounded-2xl border border-gray-100 shadow-sm shrink-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-red-50/50">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-red-600" />
            <span className="font-bold text-gray-900 font-display">Carrito</span>
            {cart.length > 0 && (
              <span className="bg-red-600 text-white text-xs font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                {totalCartItemsCount}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs font-bold text-red-600 hover:text-red-800">
              Vaciar
            </button>
          )}
        </div>

        {CartItemsList}
        {CartFooterSummary}
      </div>

      {/* FLOATING MOBILE BOTTOM BAR (Visible on mobile screens < lg) */}
      {cart.length > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-40 lg:hidden bg-red-600 text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between animate-slide-up border border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-extrabold text-white">
              {totalCartItemsCount}
            </div>
            <div>
              <p className="text-xs text-red-100 font-medium">Total a pagar</p>
              <p className="text-base font-black text-white">{formatCurrency(total, 'L')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileCartModal(true)}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-all"
            >
              Ver Carrito
            </button>
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1"
            >
              Cobrar <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* MOBILE CART MODAL / DRAWER */}
      <Modal
        isOpen={showMobileCartModal}
        onClose={() => setShowMobileCartModal(false)}
        title={`Carrito de Compras (${totalCartItemsCount} ítems)`}
        size="md"
        footer={
          <div className="flex gap-2">
            <button onClick={() => setShowMobileCartModal(false)} className="btn btn-secondary flex-1">
              Seguir agregando
            </button>
            <button
              onClick={() => { setShowMobileCartModal(false); setShowPayModal(true) }}
              disabled={cart.length === 0}
              className="btn btn-primary flex-1 font-bold"
            >
              Cobrar {formatCurrency(total, 'L')}
            </button>
          </div>
        }
      >
        <div className="h-72 flex flex-col">
          {CartItemsList}
          <div className="pt-3 border-t border-gray-100 font-extrabold text-base flex justify-between">
            <span>Total:</span>
            <span className="text-red-600">{formatCurrency(total, 'L')}</span>
          </div>
        </div>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title="Completar Venta"
        size="md"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setShowPayModal(false)} className="btn btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handlePay}
              disabled={processing || (paymentMethod === 'cash' && received < total)}
              className="btn btn-primary flex-1 font-bold"
            >
              {processing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : <CheckCircle size={16} />}
              {processing ? 'Procesando...' : 'Confirmar Venta'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-red-50/40 border border-red-100 rounded-xl p-3 space-y-1 text-xs">
            {cart.map(item => (
              <div key={`${item.type}-${item.id}`} className="flex justify-between">
                <span className="text-gray-700 font-medium">{item.quantity}× {item.name}</span>
                <span className="font-bold text-gray-900">{formatCurrency(item.price * item.quantity, 'L')}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-red-200 pt-1.5 mt-1.5">
              {discountAmount > 0 && (
                <div className="flex justify-between text-red-600 font-semibold mb-1">
                  <span>Descuento</span>
                  <span>-{formatCurrency(discountAmount, 'L')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-red-600 text-base">
                <span>Total a Cobrar</span>
                <span>{formatCurrency(total, 'L')}</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="label">Método de Pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(pm => (
                <button
                  key={pm.value}
                  onClick={() => setPaymentMethod(pm.value)}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    paymentMethod === pm.value
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {pm.icon} {pm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash input */}
          {paymentMethod === 'cash' && (
            <div>
              <label className="label">Efectivo Recibido (L)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">L</span>
                <input
                  type="number"
                  step="0.01"
                  className="input pl-8 font-extrabold text-base text-gray-900"
                  placeholder="0.00"
                  value={amountReceived}
                  onChange={e => setAmountReceived(e.target.value)}
                />
              </div>
              {received >= total && (
                <div className="mt-2 p-3 bg-emerald-50 rounded-xl flex justify-between text-xs font-bold text-emerald-800">
                  <span>Cambio a devolver:</span>
                  <span className="text-sm font-extrabold">{formatCurrency(change, 'L')}</span>
                </div>
              )}
              {received > 0 && received < total && (
                <p className="text-xs font-bold text-red-600 mt-1">
                  Faltan {formatCurrency(total - received, 'L')}
                </p>
              )}
            </div>
          )}

          {/* Discount */}
          {can('apply_discount') && (
            <div>
              <label className="label">Descuento (opcional)</label>
              <div className="flex gap-2">
                <div className="flex gap-1">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      discountType === 'percentage'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Percent size={12} />
                  </button>
                  <button
                    onClick={() => setDiscountType('fixed')}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                      discountType === 'fixed'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    <Hash size={12} />
                  </button>
                </div>
                <input
                  type="number"
                  className="input flex-1"
                  placeholder={discountType === 'percentage' ? '0-100%' : '0.00'}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  min="0"
                  max={discountType === 'percentage' ? 100 : undefined}
                />
              </div>
            </div>
          )}

          {/* Customer */}
          <div>
            <label className="label">Nombre del Cliente (opcional)</label>
            <input
              className="input text-xs"
              placeholder="Ej: Juan Pérez"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notas Adicionales (opcional)</label>
            <textarea
              className="textarea text-xs"
              rows={2}
              placeholder="Ej: Para llevar / Sin picante"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
