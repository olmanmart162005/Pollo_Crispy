import { useEffect, useState } from 'react'
import { Menu, Bell, ChevronDown, MapPin, Download, Smartphone, CheckCircle, Share, MoreVertical } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { usePermissions } from '../../hooks/usePermissions'
import Modal from '../ui/Modal'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { profile } = useAuth()
  const { branches, activeBranch, setActiveBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()
  const [showBranchMenu, setShowBranchMenu] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already running in standalone mode (installed app)
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    setIsStandalone(Boolean(isInStandaloneMode))

    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      setShowInstallModal(true)
    }
  }

  const canSwitchBranch = isSuperAdmin || branches.length > 1

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 gap-4 shrink-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <Menu size={20} />
        </button>

        {/* Branch selector */}
        <div className="relative">
          <button
            onClick={() => canSwitchBranch && setShowBranchMenu(!showBranchMenu)}
            disabled={!canSwitchBranch}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              canSwitchBranch
                ? 'text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer'
                : 'text-gray-600 bg-gray-50 border border-gray-100 cursor-default'
            }`}
          >
            <MapPin size={14} className="text-red-600" />
            <span className="max-w-40 truncate">
              {isSuperAdmin && !activeBranch ? 'Todas las sucursales' : activeBranch?.name || 'Sin sucursal'}
            </span>
            {canSwitchBranch && <ChevronDown size={14} className="text-gray-400" />}
          </button>

          {showBranchMenu && canSwitchBranch && branches.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 min-w-52 animate-slide-in">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => { setActiveBranch(branch); setShowBranchMenu(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-600 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                    activeBranch?.id === branch.id ? 'text-red-600 bg-red-50 font-medium' : 'text-gray-700'
                  }`}
                >
                  <MapPin size={13} />
                  {branch.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!isStandalone && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Instalar Pollo Crispy POS en tu dispositivo"
            >
              <Download size={14} />
              <span>Instalar App</span>
            </button>
          )}

          <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-9 h-9 rounded-full object-cover border-2 border-red-500 shadow-sm"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  if (e.currentTarget.nextElementSibling) {
                    (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div
              className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
              style={{ display: profile?.avatar_url ? 'none' : 'flex' }}
            >
              {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-gray-900 leading-tight">{profile?.full_name || 'Usuario'}</div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal Guía de Instalación PWA */}
      <Modal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        title="Instalar Pollo Crispy POS"
        size="md"
        footer={
          <button onClick={() => setShowInstallModal(false)} className="btn btn-primary w-full font-bold">
            Entendido
          </button>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
            <img src="/LogoCrispyBueno.png" alt="Pollo Crispy" className="w-12 h-12 object-contain" />
            <div>
              <p className="font-extrabold text-gray-900 text-sm">Pollo Crispy POS App</p>
              <p className="text-red-700 text-xs">Instala la aplicación nativa en tu teléfono o computadora.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <p className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                <MoreVertical size={14} className="text-red-600" /> En Chrome / Android / PC:
              </p>
              <ol className="list-decimal pl-4 text-gray-600 space-y-1">
                <li>Haz clic en el menú de <strong>3 puntos (⋮)</strong> en la esquina superior del navegador (o el ícono ⊕ en la barra de direcciones).</li>
                <li>Selecciona <strong>"Instalar Pollo Crispy POS"</strong> o <strong>"Añadir a la pantalla principal"</strong>.</li>
              </ol>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
              <p className="font-bold text-gray-900 flex items-center gap-1.5 text-xs">
                <Share size={14} className="text-red-600" /> En iPhone / iPad (Safari iOS):
              </p>
              <ol className="list-decimal pl-4 text-gray-600 space-y-1">
                <li>Toca el botón <strong>Compartir (⎋)</strong> en la barra inferior de Safari.</li>
                <li>Desplázate hacia abajo y presiona <strong>"Añadir a la pantalla de inicio"</strong>.</li>
              </ol>
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}
