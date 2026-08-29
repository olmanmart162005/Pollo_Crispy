import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { passkeyService } from '../services/passkey.service'
import { Eye, EyeOff, LogIn, KeyRound, Mail, ArrowLeft, Fingerprint } from 'lucide-react'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn, signInWithPasskey } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [passkeySupported, setPasskeySupported] = useState(false)

  // Recovery modal state
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [sendingRecovery, setSendingRecovery] = useState(false)

  useEffect(() => {
    passkeyService.isSupported().then(setPasskeySupported)
  }, [])

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

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true)
    try {
      await signInWithPasskey()
      navigate('/dashboard')
      toast.success('¡Autenticación biométrica exitosa!')
    } catch (err: any) {
      const msg = err?.message || 'No fue posible autenticarte con este dispositivo.'
      toast.error(msg, { duration: 5000 })
    } finally {
      setPasskeyLoading(false)
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
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-red-900 to-amber-950 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.15),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(220,38,38,0.2),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-600 rounded-2xl mx-auto flex items-center justify-center p-3 shadow-lg shadow-red-600/30 mb-4 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <img
                src="/LogoCrispyBueno.png"
                alt="Pollo Crispy Logo"
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
            <h1 className="text-2xl font-black text-gray-900 font-display tracking-tight">
              POLLO CRISPY
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">
              Sistema Punto de Venta POS
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="label" htmlFor="email">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="usuario@pollocrispy.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading || passkeyLoading}
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
                  disabled={loading || passkeyLoading}
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
              disabled={loading || passkeyLoading}
              className="btn btn-primary w-full btn-lg mt-2 font-bold shadow-md shadow-red-600/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Biometric Passkey Option */}
          {passkeySupported && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={loading || passkeyLoading}
                className="w-full py-3 px-4 rounded-2xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm active:scale-98"
              >
                {passkeyLoading ? (
                  <div className="w-4 h-4 border-2 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
                ) : (
                  <Fingerprint size={20} className="text-red-600 shrink-0" />
                )}
                <span>{passkeyLoading ? 'Verificando huella...' : 'Entrar con huella / Passkey'}</span>
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            ¿Problemas para acceder? Contacta al administrador.
          </p>
        </div>

        <p className="text-center text-white/60 text-xs mt-4">
          © {new Date().getFullYear()} Pollo Crispy — Todos los derechos reservados
        </p>
      </div>

      {/* Password recovery modal */}
      <Modal
        isOpen={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        title="Recuperar Contraseña"
        size="sm"
      >
        <form onSubmit={handleSendRecovery} className="space-y-4">
          <p className="text-xs text-gray-500">
            Ingresa tu correo electrónico registrado. Te enviaremos un enlace oficial de Supabase Auth para restablecer tu contraseña de forma segura.
          </p>

          <div className="form-group">
            <label className="label">Correo Electrónico *</label>
            <div className="relative">
              <input
                type="email"
                className="input pl-9"
                placeholder="tu-correo@ejemplo.com"
                value={recoveryEmail}
                onChange={e => setRecoveryEmail(e.target.value)}
                disabled={sendingRecovery}
                required
              />
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRecoveryModalOpen(false)}
              className="btn btn-secondary flex-1 text-xs"
              disabled={sendingRecovery}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sendingRecovery}
              className="btn btn-primary flex-1 text-xs font-bold"
            >
              {sendingRecovery ? 'Enviando...' : 'Enviar Enlace'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
