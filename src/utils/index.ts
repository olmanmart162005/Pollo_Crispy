export function formatCurrency(amount: number, symbol = 'L'): string {
  return `${symbol} ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-HN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('es-HN', {
    hour: '2-digit', minute: '2-digit', hour12: true
  })
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function getMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function getYearStart(): string {
  return `${new Date().getFullYear()}-01-01`
}

export function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff)).toISOString().split('T')[0]
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    other: 'Otro',
  }
  return labels[method] || method
}

export function saleStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: 'Completada',
    cancelled: 'Cancelada',
    voided: 'Anulada',
  }
  return labels[status] || status
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    CAJERO: 'Cajero',
  }
  return labels[role] || role
}

export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}
