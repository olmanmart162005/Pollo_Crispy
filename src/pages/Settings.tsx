import { useEffect, useState, ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useBranch } from '../context/BranchContext'
import { usePermissions } from '../hooks/usePermissions'
import { reportsService } from '../services/reports.service'
import { usersService } from '../services/users.service'
import { supabase } from '../lib/supabase'
import { roleLabel } from '../utils'
import {
  Settings as SettingsIcon,
  Save,
  User as UserIcon,
  Upload,
  Camera,
  CheckCircle,
  Shield,
  Store,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  X,
  MapPin,
  Mail,
  Fingerprint,
  Trash2,
} from 'lucide-react'
import { PageLoader } from '../components/ui/EmptyState'
import { passkeyService, UserPasskey } from '../services/passkey.service'
import toast from 'react-hot-toast'

const SETTINGS_FIELDS = [
  { key: 'business_name', label: 'Nombre del negocio', type: 'text' },
  { key: 'business_phone', label: 'Teléfono', type: 'text' },
  { key: 'business_address', label: 'Dirección', type: 'text' },
  { key: 'currency_symbol', label: 'Símbolo de moneda', type: 'text' },
  { key: 'currency_code', label: 'Código de moneda', type: 'text' },
  { key: 'tax_rate', label: 'Tasa de impuesto (%)', type: 'number' },
  { key: 'ticket_header', label: 'Encabezado del ticket', type: 'text' },
  { key: 'ticket_footer', label: 'Pie de ticket', type: 'text' },
]

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth()
  const { branches, activeBranch } = useBranch()
  const { isSuperAdmin, isAdmin } = usePermissions()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = searchParams.get('tab') || 'perfil'
  const [activeTab, setActiveTab] = useState<'perfil' | 'seguridad' | 'negocio'>(
    initialTab === 'seguridad' || initialTab === 'negocio' ? initialTab : 'perfil'
  )

  // Sync tab with URL
  const handleTabChange = (tab: 'perfil' | 'seguridad' | 'negocio') => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Business settings state
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loadingBusiness, setLoadingBusiness] = useState(false)
  const [savingBusiness, setSavingBusiness] = useState(false)

  // Profile editing state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarError, setAvatarError] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password change state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // Passkey / Biometría state
  const [passkeys, setPasskeys] = useState<UserPasskey[]>([])
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [registeringPasskey, setRegisteringPasskey] = useState(false)
  const [revokingPasskey, setRevokingPasskey] = useState(false)

  const hasMinLength = newPassword.length >= 6
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isPasswordValid = hasMinLength && passwordsMatch

  useEffect(() => {
    if (user?.id) {
      passkeyService.isSupported().then(setPasskeySupported)
      loadUserPasskeys()
    }
  }, [user?.id])

  const loadUserPasskeys = async () => {
    if (user?.id) {
      const list = await passkeyService.getUserPasskeys(user.id)
      setPasskeys(list)
    }
  }

  const handleRegisterPasskey = async () => {
    if (!user || !user.email) return
    setRegisteringPasskey(true)
    try {
      const res = await passkeyService.registerPasskey(user.id, user.email)
      toast.success(res.message)
      await loadUserPasskeys()
    } catch (err: any) {
      toast.error(err.message || 'Error al activar acceso por huella.')
    } finally {
      setRegisteringPasskey(false)
    }
  }

  const handleRevokePasskey = async () => {
    if (!user) return
    if (!window.confirm('¿Deseas desactivar el acceso por huella / Passkey de tu cuenta?')) return
    setRevokingPasskey(true)
    try {
      await passkeyService.revokePasskey(user.id)
      toast.success('Acceso por huella desactivado correctamente.')
      await loadUserPasskeys()
    } catch (err: any) {
      toast.error(err.message || 'Error al desactivar el acceso por huella.')
    } finally {
      setRevokingPasskey(false)
    }
  }

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setAvatarUrl(profile.avatar_url || '')
      setAvatarError(false)
    }
  }, [profile])

  useEffect(() => {
    if (isAdmin && activeTab === 'negocio') {
      loadBusinessSettings()
    }
  }, [isAdmin, activeTab])

  const loadBusinessSettings = async () => {
    setLoadingBusiness(true)
    try {
      const data = await reportsService.getSettings()
      const parsed: Record<string, string> = {}
      Object.entries(data).forEach(([k, v]) => {
        parsed[k] = typeof v === 'string' ? v.replace(/^"|"$/g, '') : String(v)
      })
      setSettings(parsed)
    } catch {
      toast.error('Error cargando configuración del negocio')
    } finally {
      setLoadingBusiness(false)
    }
  }

  const saveBusinessSettings = async () => {
    if (!profile) return
    setSavingBusiness(true)
    try {
      for (const f of SETTINGS_FIELDS) {
        if (settings[f.key] !== undefined) {
          const val = f.type === 'number' ? Number(settings[f.key]) : `"${settings[f.key]}"`
          await reportsService.updateSetting(f.key, val, profile.id)
        }
      }
      toast.success('Configuración del negocio guardada')
    } catch {
      toast.error('Error guardando configuración')
    } finally {
      setSavingBusiness(false)
    }
  }

  const handleImageFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 3MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarUrl(reader.result as string)
      toast.success('Imagen cargada. Haz clic en "Guardar Mi Perfil" para aplicar.')
    }
    reader.readAsDataURL(file)
  }

  const saveUserProfile = async () => {
    if (!profile) return
    if (!fullName.trim()) {
      toast.error('El nombre completo es requerido')
      return
    }
    setSavingProfile(true)
    try {
      await usersService.updateProfile(profile.id, {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      })
      await refreshProfile()
      toast.success('¡Perfil y foto guardados correctamente!')
    } catch (err) {
      console.error(err)
      toast.error('Error guardando perfil')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) {
      toast.error('Por favor completa todos los campos de contraseña')
      return
    }
    if (!isPasswordValid) {
      toast.error('Por favor cumple los requisitos de contraseña')
      return
    }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
      toast.success('Contraseña actualizada correctamente')
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.'
      toast.error(msg)
    } finally {
      setChangingPassword(false)
    }
  }

  const role = profile?.role || 'CAJERO'

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in pb-10">
      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            <SettingsIcon size={24} className="text-red-600" /> Configuración del Sistema
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Administra tu perfil personal, credenciales de seguridad y preferencias.
          </p>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => handleTabChange('perfil')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'perfil'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <UserIcon size={18} />
          <span>Mi Perfil</span>
        </button>

        <button
          onClick={() => handleTabChange('seguridad')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'seguridad'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <KeyRound size={18} />
          <span>Seguridad y Contraseña</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => handleTabChange('negocio')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'negocio'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Store size={18} />
            <span>Configuración del Negocio</span>
          </button>
        )}
      </div>

      {/* ── PESTAÑA 1: MI PERFIL ────────────────────────────────────────── */}
      {activeTab === 'perfil' && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-accent card-body space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UserIcon size={20} className="text-red-600" />
                <h2 className="font-bold text-gray-900 font-display text-lg">Información Personal</h2>
              </div>
              <span className="badge badge-gray text-xs">ID: {profile?.id?.slice(0, 8)}...</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar con selector interactivo */}
              <div className="relative group shrink-0">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-red-500 shadow-md bg-red-50 flex items-center justify-center">
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="text-4xl font-extrabold text-red-600">
                      {fullName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>

                <label
                  className="absolute bottom-0 right-0 bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-full shadow-md cursor-pointer transition-transform hover:scale-110"
                  title="Cambiar foto de perfil"
                >
                  <Camera size={16} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              </div>

              {/* Campos del perfil */}
              <div className="flex-1 space-y-4 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Nombre completo *</label>
                    <input
                      type="text"
                      className="input font-medium"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Tu nombre completo"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Teléfono</label>
                    <input
                      type="text"
                      className="input font-medium"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+504 9999-9999"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label flex items-center justify-between">
                    <span>Foto de perfil (URL directa o subir imagen)</span>
                    <label className="text-xs text-red-600 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                      <Upload size={12} /> Subir desde el equipo
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                    </label>
                  </label>
                  <input
                    type="text"
                    className="input text-xs font-mono"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    placeholder="https://... o sube una imagen con el botón"
                  />
                </div>

                {/* Rol y Sucursal asignada (Solo Lectura Informativa) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Correo de Acceso
                    </span>
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-red-600 shrink-0" />
                      <span className="font-bold text-gray-900 text-xs font-mono truncate">
                        {user?.email || profile?.email || 'Sin correo'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Rol Asignado
                    </span>
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-red-600 shrink-0" />
                      <span className="font-bold text-gray-900 text-sm">{roleLabel(role)}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                      Sucursal Activa
                    </span>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-red-600 shrink-0" />
                      <span className="font-bold text-gray-900 text-sm truncate">
                        {isSuperAdmin
                          ? activeBranch
                            ? activeBranch.name
                            : 'Todas las sucursales'
                          : activeBranch?.name || 'Sin sucursal asignada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={saveUserProfile}
                disabled={savingProfile}
                className="btn btn-primary font-bold px-6"
              >
                {savingProfile ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle size={16} /> Guardar Mi Perfil
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PESTAÑA 2: SEGURIDAD Y CONTRASEÑA ───────────────────────────── */}
      {activeTab === 'seguridad' && (
        <div className="space-y-6 animate-fade-in">
          <div className="card card-accent card-body space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <KeyRound size={20} className="text-red-600" />
              <h2 className="font-bold text-gray-900 font-display text-lg">Cambiar Mi Contraseña</h2>
            </div>

            <form onSubmit={handleChangeOwnPassword} className="space-y-4 max-w-lg">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Shield size={14} className="text-amber-700" /> Actualización protegida por Supabase Auth
                </p>
                <p className="text-amber-800">
                  Ingresa tu nueva contraseña y confírmala. Al guardar, tu sesión continuará activa y tu clave se actualizará de inmediato.
                </p>
              </div>

              {/* Nueva contraseña */}
              <div className="form-group">
                <label className="label">Nueva Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min. 6 caracteres"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={changingPassword}
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

              {/* Confirmar nueva contraseña */}
              <div className="form-group">
                <label className="label">Confirmar Nueva Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Repite la nueva contraseña"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled={changingPassword}
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

              {/* Checklist */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 text-xs">
                <p className="font-semibold text-gray-700 mb-1">Requisitos de contraseña:</p>
                <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {hasMinLength ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-gray-400" />}
                  <span>Mínimo 6 caracteres</span>
                </div>
                <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {passwordsMatch ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-gray-400" />}
                  <span>Las contraseñas coinciden</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isPasswordValid || changingPassword}
                  className="btn btn-primary font-bold px-6"
                >
                  {changingPassword ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={16} /> Actualizar Mi Contraseña
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── SECCIÓN: BIOMETRÍA Y PASSKEYS (WEBAUTHN) ── */}
          <div className="card card-body space-y-5 border border-red-100 bg-gradient-to-br from-red-50/40 via-white to-amber-50/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-red-600/20">
                  <Fingerprint size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 font-display text-base sm:text-lg">
                    Acceso con Huella Digital / Biometría
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-lg">
                    Accede al sistema sin escribir tu clave usando Windows Hello, Touch ID, Face ID o la huella registrada en tu teléfono.
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-start md:self-center">
                {passkeys.length > 0 ? (
                  <span className="badge badge-green font-bold text-xs flex items-center gap-1.5 px-3 py-1">
                    <CheckCircle size={14} /> Acceso biométrico activo
                  </span>
                ) : (
                  <span className="badge badge-gray font-semibold text-xs px-3 py-1">
                    Sin huella vinculada
                  </span>
                )}
              </div>
            </div>

            {passkeySupported ? (
              <div className="space-y-4">
                {passkeys.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                      Dispositivos con acceso biométrico activado:
                    </p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {passkeys.map(pk => (
                        <div
                          key={pk.id}
                          className="p-3.5 bg-white rounded-2xl border border-gray-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm hover:border-red-200 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
                              <Fingerprint size={20} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate text-sm">{pk.device_name}</p>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                Registrada el {new Date(pk.created_at).toLocaleDateString('es-HN', { day: '2-digit', month: 'long', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={handleRevokePasskey}
                            disabled={revokingPasskey}
                            className="btn btn-secondary text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 py-2 px-3.5 shrink-0 self-start sm:self-center font-semibold"
                          >
                            <Trash2 size={14} /> Desactivar acceso con huella
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRegisterPasskey}
                    disabled={registeringPasskey}
                    className="btn btn-yellow font-bold text-xs sm:text-sm px-6 py-3 shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2"
                  >
                    {registeringPasskey ? (
                      <div className="w-4 h-4 border-2 border-amber-900/30 border-t-amber-900 rounded-full animate-spin" />
                    ) : (
                      <Fingerprint size={18} />
                    )}
                    <span>
                      {registeringPasskey
                        ? 'Verificando con dispositivo...'
                        : 'Activar acceso con huella / Passkey'}
                    </span>
                  </button>

                  {passkeys.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRevokePasskey}
                      disabled={revokingPasskey}
                      className="btn btn-secondary font-semibold text-xs text-red-600 border-red-200 hover:bg-red-50 px-5 py-3 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      <span>{revokingPasskey ? 'Desactivando...' : 'Desactivar acceso'}</span>
                    </button>
                  )}
                </div>

                <div className="p-3.5 bg-white/90 rounded-2xl border border-gray-200/80 text-[11px] text-gray-600 space-y-1">
                  <p className="font-bold text-gray-800 flex items-center gap-1.5 text-xs">
                    <Shield size={14} className="text-emerald-600" /> Seguridad nativa del dispositivo:
                  </p>
                  <p className="leading-relaxed">
                    Tu biometría es procesada exclusivamente por tu sistema operativo (Windows Hello, iOS o Android) y <strong>NUNCA es almacenada ni enviada a nuestros servidores</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-gray-100 rounded-2xl text-xs text-gray-600">
                La autenticación biométrica WebAuthn no está disponible en este navegador o requiere conexión segura (HTTPS o localhost).
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PESTAÑA 3: NEGOCIO (Solo Super Admin y Admin) ───────────────── */}
      {isAdmin && activeTab === 'negocio' && (
        <div className="space-y-6 animate-fade-in">
          {loadingBusiness ? (
            <PageLoader />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulario de Configuración del Negocio */}
              <div className="lg:col-span-2 card card-accent card-body space-y-4">
                <h2 className="font-bold text-gray-900 font-display border-b border-gray-100 pb-2">
                  Información y Parámetros del Negocio
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SETTINGS_FIELDS.map(f => (
                    <div key={f.key} className="form-group">
                      <label className="label">{f.label}</label>
                      <input
                        type={f.type}
                        className="input"
                        value={settings[f.key] || ''}
                        onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="pt-3 flex justify-end">
                  <button
                    onClick={saveBusinessSettings}
                    disabled={savingBusiness}
                    className="btn btn-primary font-bold px-6"
                  >
                    {savingBusiness ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={16} /> Guardar Configuración
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Vista Previa del Ticket */}
              <div className="card card-body flex flex-col items-center justify-start">
                <h2 className="font-bold text-gray-900 font-display mb-3 text-center">
                  Vista Previa del Ticket
                </h2>
                <div className="w-full border border-dashed border-gray-300 rounded-xl p-4 text-center font-mono text-xs max-w-xs space-y-1 bg-gray-50 shadow-inner">
                  <p className="text-base font-bold text-gray-900">
                    {settings.ticket_header || 'POLLO CRISPY'}
                  </p>
                  <p className="text-gray-500">{settings.business_address || 'Dirección comercial'}</p>
                  <p className="text-gray-500">{settings.business_phone || 'Teléfono'}</p>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <p>1x Pollo Crispy Familiar... {settings.currency_symbol || 'L'} 190.00</p>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <p className="font-bold text-gray-900">
                    TOTAL: {settings.currency_symbol || 'L'} 190.00
                  </p>
                  <div className="border-t border-dashed border-gray-300 my-2" />
                  <p className="text-gray-500">{settings.ticket_footer || '¡Gracias por su compra!'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
