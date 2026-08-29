import { useState } from 'react'
import { Eye, EyeOff, Lock, Check, X, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'
import toast from 'react-hot-toast'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const hasMinLength = newPassword.length >= 6
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isValid = hasMinLength && passwordsMatch

  const handleResetForm = () => {
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
  }

  const handleClose = () => {
    handleResetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPassword || !confirmPassword) {
      toast.error('Por favor completa todos los campos')
      return
    }

    if (!hasMinLength) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (!passwordsMatch) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      toast.success('Contraseña actualizada correctamente')
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.'
      toast.error(`Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Cambiar Mi Contraseña"
      size="md"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-secondary flex-1"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="btn btn-primary flex-1 font-bold"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck size={16} /> Actualizar Contraseña
              </>
            )}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 bg-red-50/70 border border-red-100 rounded-2xl flex items-start gap-3">
          <div className="p-2 bg-red-100 text-red-600 rounded-xl shrink-0">
            <Lock size={18} />
          </div>
          <div className="text-xs text-red-900 leading-relaxed">
            <p className="font-bold">Seguridad de la cuenta</p>
            <p className="text-red-700/90 mt-0.5">
              Ingresa una contraseña segura de al menos 6 caracteres para proteger tu acceso al sistema.
            </p>
          </div>
        </div>

        {/* Nueva Contraseña */}
        <div className="form-group">
          <label className="label">Nueva Contraseña *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Min. 6 caracteres"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirmar Contraseña */}
        <div className="form-group">
          <label className="label">Confirmar Nueva Contraseña *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input pr-10"
              placeholder="Repite la nueva contraseña"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Checklist de Requisitos */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs">
          <p className="font-semibold text-gray-700 mb-1">Requisitos de validación:</p>
          <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-600' : 'text-gray-500'}`}>
            {hasMinLength ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-gray-400" />}
            <span>Mínimo 6 caracteres</span>
          </div>
          <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-600' : 'text-gray-500'}`}>
            {passwordsMatch ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-gray-400" />}
            <span>Las contraseñas coinciden</span>
          </div>
        </div>
      </form>
    </Modal>
  )
}
