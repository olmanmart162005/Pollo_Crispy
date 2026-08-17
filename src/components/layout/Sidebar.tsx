import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Receipt, Archive,
  Package, Layers, MapPin, Users, BarChart3,
  ClipboardList, Settings, LogOut, X, ChevronRight,
  Store, Banknote
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useBranch } from '../../context/BranchContext'
import { usePermissions } from '../../hooks/usePermissions'
import toast from 'react-hot-toast'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
  roles?: string[]
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/pos', icon: <ShoppingCart size={18} />, label: 'Punto de Venta' },
  { to: '/ventas', icon: <Receipt size={18} />, label: 'Ventas' },
  { to: '/caja', icon: <Archive size={18} />, label: 'Caja' },
  { to: '/envios', icon: <Banknote size={18} />, label: 'Envíos de Efectivo' },
  { to: '/productos', icon: <Package size={18} />, label: 'Productos', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/combos', icon: <Layers size={18} />, label: 'Combos', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/categorias', icon: <ClipboardList size={18} />, label: 'Categorías', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/sucursales', icon: <Store size={18} />, label: 'Sucursales', roles: ['SUPER_ADMIN'] },
  { to: '/usuarios', icon: <Users size={18} />, label: 'Usuarios', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/reportes', icon: <BarChart3 size={18} />, label: 'Reportes', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/auditoria', icon: <ClipboardList size={18} />, label: 'Auditoría', roles: ['SUPER_ADMIN'] },
  { to: '/configuracion', icon: <Settings size={18} />, label: 'Configuración', roles: ['SUPER_ADMIN', 'ADMIN'] },
]

function BranchBadge() {
  const { profile } = useAuth()
  const { activeBranch } = useBranch()
  return (
    <div className="px-3 py-2 mb-2">
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
        <MapPin size={14} className="text-red-600 shrink-0" />
        <span className="text-xs font-semibold text-red-800 truncate">
          {profile?.role === 'SUPER_ADMIN'
            ? (activeBranch ? activeBranch.name : 'Todas las sucursales')
            : (activeBranch?.name || 'Mi sucursal')}
        </span>
      </div>
    </div>
  )
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const { role } = usePermissions()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  const visibleItems = navItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(role)
  })

  const roleLabel = role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'ADMIN' ? 'Administrador' : 'Cajero'
  const roleBadgeColor = role === 'SUPER_ADMIN'
    ? 'bg-purple-100 text-purple-700'
    : role === 'ADMIN' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img
            src="/LogoCrispyBueno.png"
            alt="Pollo Crispy"
            className="w-10 h-10 object-contain rounded-xl"
          />
          <div>
            <div className="text-sm font-bold text-gray-900 font-display leading-tight">Pollo Crispy</div>
            <div className="text-xs text-gray-400">Sistema de Ventas</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
        >
          <X size={16} />
        </button>
      </div>

      {/* Profile */}
      <div className="px-3 py-3 border-b border-gray-50">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-red-50/50 rounded-xl border border-red-100">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-8 h-8 rounded-full object-cover border border-red-400 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm"
            style={{ display: profile?.avatar_url ? 'none' : 'flex' }}
          >
            {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 truncate">{profile?.full_name || 'Usuario'}</div>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleBadgeColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>
      </div>

      <BranchBadge />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
            <ChevronRight size={14} className="ml-auto opacity-40" />
          </NavLink>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-gray-100">
        <button
          onClick={handleSignOut}
          className="sidebar-item sidebar-item-inactive w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-30">
        {sidebarContent}
      </aside>

      {/* Mobile */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full w-72 flex flex-col z-30 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>
    </>
  )
}
