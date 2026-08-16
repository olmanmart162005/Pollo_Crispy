import { useEffect, useState } from 'react'
import { reportsService } from '../services/reports.service'
import { AuditLog } from '../types'
import { formatDateTime } from '../utils'
import { PageLoader } from '../components/ui/EmptyState'
import { ClipboardList, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const ACTION_BADGE: Record<string, string> = {
  VOID_SALE: 'badge-red',
  CREATE: 'badge-blue',
  UPDATE: 'badge-yellow',
  DELETE: 'badge-red',
  LOGIN: 'badge-green',
}

export default function Audit() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await reportsService.getAuditLogs({ limit: 200 })
      setLogs(data as AuditLog[])
    } catch { toast.error('Error cargando auditoría') }
    finally { setLoading(false) }
  }

  const filtered = logs.filter(l => {
    if (!search) return true
    return l.action.includes(search.toUpperCase()) ||
      (l.user_name || '').toLowerCase().includes(search.toLowerCase())
  })

  if (loading) return <PageLoader />

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
          <ClipboardList size={22} className="text-orange-500" /> Auditoría
        </h1>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-8" placeholder="Buscar acción o usuario..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Tabla</th><th>Sucursal</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">No hay registros de auditoría</td></tr>
              ) : filtered.map(log => (
                <tr key={log.id}>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="text-sm">{log.user_name || '—'}</td>
                  <td>
                    <span className={`badge ${ACTION_BADGE[log.action] || 'badge-gray'}`}>{log.action}</span>
                  </td>
                  <td className="text-xs font-mono text-gray-500">{log.table_name || '—'}</td>
                  <td className="text-xs">{log.branch_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
