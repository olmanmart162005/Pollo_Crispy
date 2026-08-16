import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  variant = 'danger', loading = false
}: ConfirmDialogProps) {
  const colors = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    default: 'bg-orange-500 hover:bg-orange-600 text-white',
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="text-center py-2">
        <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
          variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-yellow-100' : 'bg-orange-100'
        }`}>
          <AlertTriangle size={28} className={
            variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-yellow-500' : 'text-orange-500'
          } />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2 font-display">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} className="btn btn-secondary flex-1">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`btn flex-1 ${colors[variant]}`}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
