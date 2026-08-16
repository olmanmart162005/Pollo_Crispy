import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { salesService } from '../services/sales.service'
import { Sale, SaleItem, PaymentMethod } from '../types'
import { formatCurrency, formatDateTime } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import SaleTicket from '../components/pos/SaleTicket'
import { ArrowLeft, Receipt, Printer } from 'lucide-react'

const PAYMENT_LABEL: Record<string, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', other: 'Otro' }
const STATUS_LABEL: Record<string, string> = { completed: 'Completada', voided: 'Anulada', cancelled: 'Cancelada' }
const STATUS_BADGE: Record<string, string> = { completed: 'badge-green', voided: 'badge-red', cancelled: 'badge-gray' }

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<(Sale & { items: SaleItem[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTicket, setShowTicket] = useState(false)

  useEffect(() => {
    if (id) {
      salesService.getSaleById(id)
        .then(setSale)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [id])

  if (loading) return <PageLoader />
  if (!sale) return <div className="text-center py-20 text-gray-400">Venta no encontrada</div>

  const ticketSaleData = {
    saleId: sale.id,
    saleNumber: sale.sale_number,
    total: Number(sale.total),
    change: Number(sale.change_given || 0),
    items: (sale.items || []).map(i => ({
      type: (i.item_type === 'combo' ? 'combo' : 'product') as 'product' | 'combo',
      id: i.product_id || i.combo_id || i.id,
      name: i.name,
      price: Number(i.unit_price),
      quantity: Number(i.quantity),
    })),
    paymentMethod: (sale.payment_method || 'cash') as PaymentMethod,
    amountReceived: Number(sale.amount_received || sale.total),
    branchName: sale.branch_name || 'Sucursal Principal',
    cashierName: sale.cashier_name || 'Cajero',
    customerName: sale.customer_name || undefined,
    discountAmount: Number(sale.discount_amount || 0),
    subtotal: Number(sale.subtotal || sale.total),
  }

  if (showTicket) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowTicket(false)}
          className="btn btn-secondary flex items-center gap-2 mb-2"
        >
          <ArrowLeft size={16} /> Volver a Detalle de Venta
        </button>
        <SaleTicket
          sale={ticketSaleData}
          onNewSale={() => setShowTicket(false)}
          onClose={() => setShowTicket(false)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm p-2">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Receipt size={22} className="text-red-600" />
          Venta {sale.sale_number}
        </h1>
        <span className={`badge ${STATUS_BADGE[sale.status]} ml-auto`}>{STATUS_LABEL[sale.status]}</span>
      </div>

      {/* General info */}
      <div className="card card-body grid grid-cols-2 gap-4 text-sm border-t-4 border-t-red-600">
        {[
          ['Número', sale.sale_number],
          ['Fecha y Hora', formatDateTime(sale.created_at)],
          ['Sucursal', sale.branch_name],
          ['Cajero', sale.cashier_name],
          ['Cliente', sale.customer_name || '—'],
          ['Método de Pago', PAYMENT_LABEL[sale.payment_method]],
        ].map(([label, val]) => (
          <div key={label}>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
            <p className="font-bold text-gray-900 mt-0.5">{val}</p>
          </div>
        ))}
        {sale.status === 'voided' && (
          <div className="col-span-2 bg-red-50 p-3 rounded-xl border border-red-100">
            <p className="text-xs text-red-600 uppercase tracking-wide font-bold">Motivo Anulación</p>
            <p className="font-semibold text-red-700 mt-0.5">{sale.void_reason || 'Sin motivo especificado'}</p>
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-bold text-gray-900 font-display">Detalle de Productos</h2>
        </div>
        <div className="table-wrapper rounded-none border-0">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th className="text-center">Cantidad</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map(item => (
                <tr key={item.id}>
                  <td className="font-medium">
                    <span className="mr-2">{item.item_type === 'combo' ? '🍱' : '🍗'}</span>
                    {item.name}
                  </td>
                  <td className="text-center font-bold">{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price, 'L')}</td>
                  <td className="font-bold text-red-600">{formatCurrency(item.subtotal, 'L')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals box */}
      <div className="card card-body">
        <div className="space-y-2 max-w-xs ml-auto">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatCurrency(sale.subtotal, 'L')}</span>
          </div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-red-600 font-medium">
              <span>Descuento</span>
              <span>-{formatCurrency(sale.discount_amount, 'L')}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-xl text-red-600 border-t border-dashed border-gray-200 pt-2">
            <span>TOTAL</span>
            <span>{formatCurrency(sale.total, 'L')}</span>
          </div>
          {sale.payment_method === 'cash' && sale.amount_received && (
            <>
              <div className="flex justify-between text-sm text-gray-700 pt-1">
                <span>Efectivo recibido</span>
                <span className="font-semibold">{formatCurrency(sale.amount_received, 'L')}</span>
              </div>
              <div className="flex justify-between text-sm text-emerald-700 font-bold">
                <span>Cambio</span>
                <span>{formatCurrency(sale.change_given || 0, 'L')}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="btn btn-secondary flex-1">
          Volver
        </button>
        <button
          onClick={() => setShowTicket(true)}
          className="btn btn-primary flex-1 font-bold shadow-md hover:shadow-lg"
        >
          <Printer size={18} />
          Imprimir Factura / Ticket
        </button>
      </div>
    </div>
  )
}
