import { useAuth } from '../context/AuthContext'
import { UserRole } from '../types'

export function usePermissions() {
  const { profile } = useAuth()

  const role: UserRole = profile?.role || 'CAJERO'
  const permissions = profile?.permissions || {}

  const isSuperAdmin = role === 'SUPER_ADMIN'
  const isAdmin = role === 'ADMIN' || isSuperAdmin
  const isCajero = role === 'CAJERO'

  const can = (permission: string): boolean => {
    if (isSuperAdmin) return true
    if (isAdmin) {
      const adminDefaults: Record<string, boolean> = {
        'create_product': true,
        'edit_product': true,
        'create_combo': true,
        'edit_combo': true,
        'view_reports': true,
        'view_sales': true,
        'manage_cashiers': true,
        'view_audit': false,
        'apply_discount': true,
        'void_sale': true,
        'close_cash': true,
        'change_price': true,
        'create_branch': false,
        'manage_users': true,
      }
      return permissions[permission] ?? adminDefaults[permission] ?? false
    }
    const cajeroDefaults: Record<string, boolean> = {
      'create_sale': true,
      'view_own_sales': true,
      'open_cash': true,
      'close_cash': true,
      'apply_discount': false,
      'void_sale': false,
    }
    return permissions[permission] ?? cajeroDefaults[permission] ?? false
  }

  return { role, isSuperAdmin, isAdmin, isCajero, can, permissions }
}
