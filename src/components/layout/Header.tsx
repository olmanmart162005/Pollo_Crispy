import { Menu, Bell, ChevronDown, MapPin } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useState } from 'react'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { profile } = useAuth()
  const { branches, activeBranch, setActiveBranch } = useBranch()
  const { isSuperAdmin } = usePermissions()
  const [showBranchMenu, setShowBranchMenu] = useState(false)

  const canSwitchBranch = isSuperAdmin || branches.length > 1

  return (
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
          <MapPin size={14} className="text-orange-500" />
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
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl ${
                  activeBranch?.id === branch.id ? 'text-orange-600 bg-orange-50 font-medium' : 'text-gray-700'
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
  )
}
