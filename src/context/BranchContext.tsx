import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Branch } from '../types'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

interface BranchContextType {
  branches: Branch[]
  activeBranch: Branch | null
  setActiveBranch: (branch: Branch) => void
  loadingBranches: boolean
  refreshBranches: () => Promise<void>
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export function BranchProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)

  const fetchBranches = async () => {
    if (!profile) return
    setLoadingBranches(true)
    try {
      let branchIds: string[] = []

      if (profile.role !== 'SUPER_ADMIN') {
        const { data: ub } = await supabase
          .from('user_branches')
          .select('branch_id')
          .eq('user_id', profile.id)
        branchIds = (ub || []).map((r: { branch_id: string }) => r.branch_id)
        if (branchIds.length === 0) {
          setBranches([])
          setActiveBranchState(null)
          setLoadingBranches(false)
          return
        }
      }

      let query = supabase.from('branches').select('*').eq('status', 'active').order('name')
      if (profile.role !== 'SUPER_ADMIN') {
        query = query.in('id', branchIds)
      }

      const { data, error } = await query
      if (error) throw error
      const list = (data || []) as Branch[]
      setBranches(list)

      // Si solo tiene 1 sucursal, la asigna automáticamente
      if (profile.role !== 'SUPER_ADMIN' && list.length === 1) {
        setActiveBranchState(list[0])
        localStorage.setItem('activeBranchId', list[0].id)
      } else {
        const stored = localStorage.getItem('activeBranchId')
        const found = stored ? list.find(b => b.id === stored) : null
        setActiveBranchState(found || list[0] || null)
      }
    } catch (err) {
      console.error('Error fetching branches:', err)
    } finally {
      setLoadingBranches(false)
    }
  }

  useEffect(() => { fetchBranches() }, [profile?.id])

  const setActiveBranch = (branch: Branch) => {
    setActiveBranchState(branch)
    localStorage.setItem('activeBranchId', branch.id)
  }

  return (
    <BranchContext.Provider value={{
      branches,
      activeBranch,
      setActiveBranch,
      loadingBranches,
      refreshBranches: fetchBranches
    }}>
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (!context) throw new Error('useBranch must be used within BranchProvider')
  return context
}
