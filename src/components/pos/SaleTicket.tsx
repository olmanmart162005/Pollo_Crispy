import { useRef, useCallback } from 'react'
import { useReactToPrint } from 'react-to-print'
import { formatCurrency } from '../../utils'
import { CartItem, PaymentMethod } from '../../types'
import { Printer, ShoppingCart, CheckCircle } from 'lucide-react'

interface SaleTicketProps {
  sale: {
    saleId: string
    saleNumber: string
    total: number
    change: number
    items: CartItem[]
    paymentMethod: PaymentMethod
    amountReceived: number
    branchName: string
    cashierName: string
    customerName?: string
    discountAmount?: number
    subtotal?: number
  }
  onNewSale: () => void
  onClose: () => void
}

const paymentLabel: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
}

const PRINT_STYLES = `
  @page {
    size: 80mm auto;
    margin: 3mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: #000;
    background: #fff;
  }
  .print-wrapper {
    width: 100%;
    max-width: 74mm;
    margin: 0 auto;
    padding: 4px;
  }
`

export default function SaleTicket({ sale, onNewSale }: SaleTicketProps) {
  const ticketRef = useRef<HTMLDivElement>(null)
  const now = new Date()
  const subtotal = sale.subtotal ?? sale.items.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountAmount = sale.discountAmount ?? 0

  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    pageStyle: PRINT_STYLES,
    documentTitle: `Ticket-${sale.saleNumber}`,
  })

  const onPrint = useCallback(() => {
    handlePrint()
  }, [handlePrint])

  const fecha = now.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="flex items-center justify-center min-h-[80vh] animate-fade-in px-4 py-6">
      <div className="w-full max-w-sm">
        {/* Banner de Confirmación */}
        <div className="text-center mb-6 no-print">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mb-2.5 shadow-sm">
            <CheckCircle size={30} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 font-display">¡Venta Registrada!</h2>
          <p className="text-gray-500 text-xs mt-0.5">Ticket N° <span className="font-mono font-bold text-red-600">{sale.saleNumber}</span></p>
        </div>

        {/* Tarjeta Visual del Ticket */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xl">
          {/* Contenedor Imprimible */}
          <div ref={ticketRef} className="print-wrapper p-6 font-mono text-xs text-gray-900 bg-white">

            {/* ENCABEZADO Y LOGO */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400">
              <img
                src="/LogoCrispyBueno.png"
                alt="Pollo Crispy"
                className="w-20 h-20 object-contain mx-auto mb-1.5"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
              <h1 className="text-lg font-extrabold tracking-wider text-gray-900 uppercase">POLLO CRISPY</h1>
              <p className="text-[11px] text-gray-600 font-semibold">{sale.branchName}</p>
            </div>

            {/* INFORMACIÓN DE LA VENTA */}
            <div className="py-3 space-y-1 text-[11px] border-b border-dashed border-gray-400">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">N° Venta:</span>
                <span className="font-bold text-red-600 font-mono text-xs">{sale.saleNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Fecha:</span>
                <span className="font-medium text-gray-900">{fecha}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Hora:</span>
                <span className="font-medium text-gray-900">{hora}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Cajero:</span>
                <span className="font-medium text-gray-900">{sale.cashierName}</span>
              </div>
              {sale.customerName && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Cliente:</span>
                  <span className="font-medium text-gray-900">{sale.customerName}</span>
                </div>
              )}
            </div>

            {/* DETALLE DE PRODUCTOS */}
            <div className="py-3 border-b border-dashed border-gray-400">
              <div className="flex justify-between text-[11px] font-bold text-gray-900 border-b border-gray-800 pb-1 mb-2">
                <span>PRODUCTO</span>
                <span>TOTAL</span>
              </div>

              <div className="space-y-2">
                {sale.items.map((item, i) => (
                  <div key={i} className="text-[11px]">
                    <div className="font-bold text-gray-900">{item.name}</div>
                    <div className="flex justify-between text-gray-700 pl-2">
                      <span>{item.quantity} x {formatCurrency(item.price, 'L')}</span>
                      <span className="font-bold text-gray-900">{formatCurrency(item.price * item.quantity, 'L')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOTALES Y PAGO */}
            <div className="py-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center text-gray-700">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(subtotal, 'L')}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-red-600 font-medium">
                  <span>Descuento:</span>
                  <span>-{formatCurrency(discountAmount, 'L')}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm font-extrabold text-gray-900 border-t-2 border-gray-900 pt-1.5 mt-1">
                <span>TOTAL:</span>
                <span className="text-red-600 text-base">{formatCurrency(sale.total, 'L')}</span>
              </div>

              <div className="flex justify-between items-center pt-2 text-[11px] text-gray-800">
                <span>Método de Pago:</span>
                <span className="font-bold">{paymentLabel[sale.paymentMethod]}</span>
              </div>

              {sale.paymentMethod === 'cash' && sale.amountReceived > 0 && (
                <div className="flex justify-between items-center text-[11px] text-gray-800">
                  <span>Efectivo Recibido:</span>
                  <span className="font-semibold">{formatCurrency(sale.amountReceived, 'L')}</span>
                </div>
              )}

              {sale.paymentMethod === 'cash' && sale.change > 0 && (
                <div className="flex justify-between items-center text-[11px] text-emerald-700 font-bold">
                  <span>Cambio Devuelto:</span>
                  <span>{formatCurrency(sale.change, 'L')}</span>
                </div>
              )}
            </div>

            {/* PIE DE PÁGINA */}
            <div className="text-center pt-4 mt-1 border-t border-dashed border-gray-400">
              <p className="text-xs font-extrabold tracking-wide text-gray-900">¡GRACIAS POR SU COMPRA!</p>
              <p className="text-[10px] text-gray-500 mt-1">Pollo Crispy — Su sabor favorito</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{fecha} {hora}</p>
            </div>

          </div>
        </div>

        {/* Botones de Acción (no se imprimen) */}
        <div className="flex gap-3 mt-6 no-print">
          <button onClick={onPrint} className="btn btn-secondary flex-1 font-bold">
            <Printer size={16} />
            Imprimir Ticket
          </button>
          <button onClick={onNewSale} className="btn btn-primary flex-1 font-bold">
            <ShoppingCart size={16} />
            Nueva Venta
          </button>
        </div>
      </div>
    </div>
  )
}
