import { useEffect, useState, ChangeEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { reportsService } from '../services/reports.service'
import { usersService } from '../services/users.service'
import { Settings as SettingsIcon, Save, User as UserIcon, Upload, Camera, CheckCircle } from 'lucide-react'
import { PageLoader } from '../components/ui/EmptyState'
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
  const { profile, refreshProfile } = useAuth()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile editing state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  const load = async () => {
    setLoading(true)
    try {
      const data = await reportsService.getSettings()
      const parsed: Record<string, string> = {}
      Object.entries(data).forEach(([k, v]) => {
        parsed[k] = typeof v === 'string' ? v.replace(/^"|"$/g, '') : String(v)
      })
      setSettings(parsed)
    } catch {
      toast.error('Error cargando configuración')
    } finally {
      setLoading(false)
    }
  }

  const saveBusinessSettings = async () => {
    if (!profile) return
    setSaving(true)
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
      setSaving(false)
    }
  }

  // Handle local image file upload
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
      toast.success('Imagen cargada. Haz clic en "Guardar Perfil" para aplicar.')
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

  if (loading) return <PageLoader />

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
        <SettingsIcon size={24} className="text-red-600" /> Configuración
      </h1>

      {/* ── CARD: MI PERFIL Y FOTO DE PERFIL ────────────────────────────── */}
      <div className="card border-t-4 border-t-red-600 card-body space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
          <UserIcon size={20} className="text-red-600" />
          <h2 className="font-bold text-gray-900 font-display text-lg">Mi Perfil y Foto de Perfil</h2>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-5 pt-2">
          {/* Avatar preview */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-red-500 shadow-md bg-red-50 flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className="text-3xl font-extrabold text-red-600">
                  {fullName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>

            {/* Floating button */}
            <label className="absolute bottom-0 right-0 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-md cursor-pointer transition-transform hover:scale-110">
              <Camera size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            </label>
          </div>

          {/* Form inputs */}
          <div className="flex-1 space-y-3 w-full">
            <div className="form-group">
              <label className="label">Nombre completo</label>
              <input
                type="text"
                className="input font-medium"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="form-group">
              <label className="label">Teléfono</label>
              <input
                type="text"
                className="input font-medium"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+504 9999-9999"
              />
            </div>

            <div className="form-group">
              <label className="label flex items-center justify-between">
                <span>Foto de perfil (URL o subir archivo)</span>
                <label className="text-xs text-red-600 hover:underline cursor-pointer flex items-center gap-1 font-semibold">
                  <Upload size={12} /> Subir desde dispositivo
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                </label>
              </label>
              <input
                type="text"
                className="input text-xs font-mono"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://... o sube una foto arriba"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={saveUserProfile}
            disabled={savingProfile}
            className="btn btn-primary font-bold"
          >
            {savingProfile ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle size={16} />
            )}
            {savingProfile ? 'Guardando...' : 'Guardar Mi Perfil'}
          </button>
        </div>
      </div>

      {/* ── CARD: INFORMACIÓN DEL NEGOCIO ───────────────────────────────── */}
      <div className="card card-body space-y-4">
        <h2 className="font-bold text-gray-900 font-display border-b border-gray-100 pb-2">Información del Negocio</h2>
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
        <button onClick={saveBusinessSettings} disabled={saving} className="btn btn-secondary mt-2">
          {saving ? 'Guardando...' : <><Save size={16} /> Guardar Configuración del Negocio</>}
        </button>
      </div>

      {/* ── CARD: VISTA PREVIA DEL TICKET ──────────────────────────────── */}
      <div className="card card-body">
        <h2 className="font-bold text-gray-900 font-display mb-3">Vista previa del Ticket</h2>
        <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center font-mono text-xs max-w-xs mx-auto space-y-1 bg-gray-50">
          <p className="text-base font-bold text-gray-900">{settings.ticket_header || 'POLLO CRISPY'}</p>
          <p className="text-gray-500">{settings.business_address || 'Dirección'}</p>
          <p className="text-gray-500">{settings.business_phone || 'Teléfono'}</p>
          <div className="border-t border-dashed border-gray-300 my-2" />
          <p>Producto........................ {settings.currency_symbol || 'L'} 45.00</p>
          <div className="border-t border-dashed border-gray-300 my-2" />
          <p className="font-bold text-gray-900">TOTAL: {settings.currency_symbol || 'L'} 45.00</p>
          <div className="border-t border-dashed border-gray-300 my-2" />
          <p className="text-gray-500">{settings.ticket_footer || '¡Gracias por su compra!'}</p>
        </div>
      </div>
    </div>
  )
}
