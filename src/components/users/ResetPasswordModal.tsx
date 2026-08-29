import { useState } from 'react'
import { Eye, EyeOff, KeyRound, Check, X, ShieldAlert } from 'lucide-react'
import { Profile } from '../../types'
import { roleLabel } from '../../utils'
import { usersService } from '../../services/users.service'
import Modal from '../ui/Modal'
import toast from 'react-hot-toast'

interface ResetPasswordModalProps {
  user: Profile | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ResetPasswordModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmStep, setConfirmStep] = useState(false)

  if (!user) return null

  const hasMinLength = newPassword.length >= 6
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isValid = hasMinLength && passwordsMatch

  const handleResetForm = () => {
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setConfirmStep(false)
  }

  const handleClose = () => {
    handleResetForm()
    onClose()
  }

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      toast.error('Por favor cumple los requisitos de contraseña')
      return
    }
    setConfirmStep(true)
  }

  const handleExecuteReset = async () => {
    setLoading(true)
    try {
      await usersService.adminResetPassword(user.id, newPassword)
      toast.success(`Contraseña de "${user.full_name}" actualizada correctamente`)
      handleClose()
      if (onSuccess) onSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.'
      toast.error(msg)
      setConfirmStep(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Restablecer Contraseña de Usuario"
      size="md"
      footer={
        <div className="flex gap-2">
          {confirmStep ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmStep(false)}
                className="btn btn-secondary flex-1"
                disabled={loading}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={loading}
                className="btn btn-primary flex-1 font-bold bg-red-600 hover:bg-red-700"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <KeyRound size={16} /> Confirmar y Cambiar
                  </>
                )}
              </button>
            </>
          ) : (
            <>
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
                onClick={handleProceedToConfirm}
                disabled={!isValid || loading}
                className="btn btn-primary flex-1 font-bold"
              >
                Continuar
              </button>
            </>
          )}
        </div>
      }
    >
      {confirmStep ? (
        <div className="space-y-4 text-center py-2 animate-fade-in">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              ¿Establecer nueva contraseña para {user.full_name}?
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              La contraseña anterior dejará de funcionar inmediatamente y el usuario deberá utilizar la nueva clave para iniciar sesión.
            </p>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 text-left">
            <strong>Usuario:</strong> {user.full_name} ({roleLabel(user.role)})
          </div>
        </div>
      ) : (
        <form onSubmit={handleProceedToConfirm} className="space-y-4 animate-fade-in">
          {/* Tarjeta de información del usuario objetivo */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">
              {user.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500">{roleLabel(user.role)} {user.phone ? `• ${user.phone}` : ''}</p>
            </div>
          </div>

          {/* Nueva Contraseña */}
          <div className="form-group">
            <label className="label">Nueva Contraseña para el Usuario *</label>
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
            <label className="label">Confirmar Contraseña *</label>
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
            <p className="font-semibold text-gray-700 mb-1">Validaciones requeridas:</p>
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
      )}
    </Modal>
  )
}
