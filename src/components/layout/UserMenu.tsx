import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Settings, LogOut, ChevronDown, Shield, Store } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { roleLabel } from '../../utils'
import toast from 'react-hot-toast'

interface UserMenuProps {
  onOpenProfileModal?: () => void
}

export default function UserMenu({ onOpenProfileModal }: UserMenuProps) {
  const { profile, signOut } = useAuth()
  const { activeBranch } = useBranch()
  const [isOpen, setIsOpen] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setAvatarError(false)
  }, [profile?.avatar_url])

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    setIsOpen(false)
    await signOut()
    navigate('/login', { replace: true })
    toast.success('Sesión cerrada correctamente')
  }

  const handleNavigate = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  const role = profile?.role || 'CAJERO'
  const roleBadgeColor =
    role === 'SUPER_ADMIN'
      ? 'bg-purple-100 text-purple-700 border-purple-200'
      : role === 'ADMIN'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200'

  const userInitial = profile?.full_name?.charAt(0)?.toUpperCase() || 'U'

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-all duration-200 ${
          isOpen ? 'bg-red-50 ring-2 ring-red-500/20' : 'hover:bg-gray-50'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {profile?.avatar_url && !avatarError ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-9 h-9 rounded-full object-cover border-2 border-red-500 shadow-sm"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-9 h-9 bg-gradient-to-br from-red-600 to-red-700 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm border border-red-500">
              {userInitial}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
        </div>

        {/* User Name & Role (Desktop) */}
        <div className="hidden sm:block text-left min-w-0">
          <div className="text-sm font-bold text-gray-900 leading-tight truncate max-w-[130px]">
            {profile?.full_name || 'Usuario'}
          </div>
          <div className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
            <span>{roleLabel(role)}</span>
          </div>
        </div>

        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-red-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-scale-in origin-top-right">
          {/* Header section with user info */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-br from-red-50/60 to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-red-100 flex items-center justify-center text-red-700 font-extrabold text-base shrink-0 border border-red-200">
                {profile?.avatar_url && !avatarError ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  userInitial
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {profile?.full_name || 'Usuario'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleBadgeColor}`}
                  >
                    <Shield size={10} />
                    {roleLabel(role)}
                  </span>
                </div>
              </div>
            </div>

            {/* Branch indicator */}
            <div className="mt-2.5 pt-2 border-t border-gray-100/80 flex items-center gap-1.5 text-xs text-gray-600">
              <Store size={13} className="text-red-500 shrink-0" />
              <span className="font-semibold text-gray-700 truncate">
                {role === 'SUPER_ADMIN'
                  ? activeBranch
                    ? activeBranch.name
                    : 'Todas las sucursales'
                  : activeBranch?.name || 'Sin sucursal asignada'}
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="px-2 py-1.5 space-y-0.5 text-sm">
            <button
              onClick={() => {
                if (onOpenProfileModal) {
                  setIsOpen(false)
                  onOpenProfileModal()
                } else {
                  handleNavigate('/configuracion?tab=perfil')
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:text-red-600 hover:bg-red-50/80 font-medium transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
              <div>
                <span className="block leading-tight font-semibold">Mi Perfil</span>
                <span className="text-[11px] text-gray-400 font-normal">
                  Ver y editar mis datos
                </span>
              </div>
            </button>

            <button
              onClick={() => handleNavigate('/configuracion?tab=seguridad')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-700 hover:text-red-600 hover:bg-red-50/80 font-medium transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Settings size={16} />
              </div>
              <div>
                <span className="block leading-tight font-semibold">Configuración</span>
                <span className="text-[11px] text-gray-400 font-normal">
                  Seguridad y preferencias
                </span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-gray-100" />

          {/* Sign Out Button */}
          <div className="px-2 pt-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 font-semibold transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-red-100/70 text-red-600 flex items-center justify-center shrink-0">
                <LogOut size={16} />
              </div>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
