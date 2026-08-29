import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Eye, EyeOff, LogIn, KeyRound, Mail, ArrowLeft } from 'lucide-react'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Recovery modal state
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [sendingRecovery, setSendingRecovery] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Por favor completa todos los campos')
      return
    }
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
      toast.success('¡Bienvenido!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      if (msg.includes('Invalid login credentials')) {
        toast.error('Credenciales incorrectas. Verifica tu correo y contraseña.')
      } else if (msg.toLowerCase().includes('desactivada') || msg.toLowerCase().includes('perfil')) {
        toast.error(msg, { duration: 6000 })
      } else {
        toast.error(`Error al iniciar sesión: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSendRecovery = async (e: FormEvent) => {
    e.preventDefault()
    if (!recoveryEmail || !recoveryEmail.trim()) {
      toast.error('Por favor ingresa tu correo electrónico')
      return
    }
    setSendingRecovery(true)
    try {
      const redirectTo = `${window.location.origin}/configuracion?tab=seguridad`
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim().toLowerCase(), {
        redirectTo,
      })
      if (error) throw error
      toast.success('Enlace de recuperación enviado. Revisa tu correo.')
      setRecoveryModalOpen(false)
      setRecoveryEmail('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No fue posible enviar el enlace.'
      toast.error(msg)
    } finally {
      setSendingRecovery(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-orange-500 to-red-500 px-8 py-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-white rounded-2xl p-3 shadow-lg">
                <img
                  src="/LogoCrispyBueno.png"
                  alt="Pollo Crispy"
                  className="w-16 h-16 object-contain"
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white font-display">Pollo Crispy</h1>
            <p className="text-orange-100 text-sm mt-1">Sistema de Ventas y Administración</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 font-display">Iniciar Sesión</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="form-group">
                <label className="label" htmlFor="email">
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0" htmlFor="password">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(email)
                      setRecoveryModalOpen(true)
                    }}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full btn-lg mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-6">
              ¿Problemas para acceder? Contacta al administrador.
            </p>
          </div>
        </div>

        <p className="text-center text-white/60 text-xs mt-4">
          © {new Date().getFullYear()} Pollo Crispy — Todos los derechos reservados
        </p>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      <Modal
        isOpen={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        title="Recuperar Contraseña"
        size="md"
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRecoveryModalOpen(false)}
              className="btn btn-secondary flex-1"
              disabled={sendingRecovery}
            >
              <ArrowLeft size={16} /> Cancelar
            </button>
            <button
              type="button"
              onClick={handleSendRecovery}
              disabled={sendingRecovery || !recoveryEmail}
              className="btn btn-primary flex-1 font-bold"
            >
              {sendingRecovery ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Mail size={16} /> Enviar Enlace
                </>
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSendRecovery} className="space-y-4">
          <div className="p-3.5 bg-red-50 rounded-2xl border border-red-100 flex items-start gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl shrink-0">
              <KeyRound size={18} />
            </div>
            <div className="text-xs text-red-900 leading-relaxed">
              <p className="font-bold">Restablecimiento seguro de contraseña</p>
              <p className="text-red-700/90 mt-0.5">
                Ingresa tu correo electrónico registrado. Te enviaremos un enlace oficial de Supabase Auth para restablecer tu contraseña.
              </p>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Correo Electrónico Registrado *</label>
            <input
              type="email"
              className="input font-medium"
              placeholder="tu-correo@ejemplo.com"
              value={recoveryEmail}
              onChange={e => setRecoveryEmail(e.target.value)}
              disabled={sendingRecovery}
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
