import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { salesService } from '../services/sales.service'
import { Sale, SaleItem } from '../types'
import { formatCurrency, formatDateTime } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import { ArrowLeft, Receipt, Printer } from 'lucide-react'

const PAYMENT_LABEL: Record<string, string> = { cash:'Efectivo', card:'Tarjeta', transfer:'Transferencia', other:'Otro' }
const STATUS_LABEL: Record<string, string> = { completed:'Completada', voided:'Anulada', cancelled:'Cancelada' }
const STATUS_BADGE: Record<string, string> = { completed:'badge-green', voided:'badge-red', cancelled:'badge-gray' }

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sale, setSale] = useState<(Sale & { items: SaleItem[] }) | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) salesService.getSaleById(id).then(setSale).catch(console.error).finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoader />
  if (!sale) return <div className="text-center py-20 text-gray-400">Venta no encontrada</div>

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm p-2">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <Receipt size={20} className="text-orange-500" />
          Venta {sale.sale_number}
        </h1>
        <span className={`badge ${STATUS_BADGE[sale.status]} ml-auto`}>{STATUS_LABEL[sale.status]}</span>
      </div>

      <div className="card card-body grid grid-cols-2 gap-4 text-sm">
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
            <p className="font-semibold text-gray-900 mt-0.5">{val}</p>
          </div>
        ))}
        {sale.status === 'voided' && (
          <>
            <div className="col-span-2"><p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Motivo Anulación</p>
              <p className="font-semibold text-red-600 mt-0.5">{sale.void_reason}</p></div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-header"><h2 className="font-bold text-gray-900 font-display">Detalle de Productos</h2></div>
        <div className="table-wrapper rounded-none border-0">
          <table>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              {sale.items?.map(item => (
                <tr key={item.id}>
                  <td><span className="mr-2">{item.item_type === 'combo' ? '🍱' : '🍗'}</span>{item.name}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td>{formatCurrency(item.unit_price, 'L')}</td>
                  <td className="font-bold">{formatCurrency(item.subtotal, 'L')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-body">
        <div className="space-y-2 max-w-xs ml-auto">
          <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span>{formatCurrency(sale.subtotal, 'L')}</span></div>
          {sale.discount_amount > 0 && (
            <div className="flex justify-between text-sm text-red-500"><span>Descuento</span><span>-{formatCurrency(sale.discount_amount, 'L')}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="text-orange-600">{formatCurrency(sale.total, 'L')}</span></div>
          {sale.payment_method === 'cash' && sale.amount_received && (
            <>
              <div className="flex justify-between text-sm"><span>Efectivo recibido</span><span>{formatCurrency(sale.amount_received, 'L')}</span></div>
              <div className="flex justify-between text-sm text-green-600"><span>Cambio</span><span>{formatCurrency(sale.change_given || 0, 'L')}</span></div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate(-1)} className="btn btn-secondary">Volver</button>
        <button onClick={() => window.print()} className="btn btn-ghost"><Printer size={16} />Imprimir</button>
      </div>
    </div>
  )
}
