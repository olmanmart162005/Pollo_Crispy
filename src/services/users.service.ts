import { supabase } from '../lib/supabase'
import { Profile, UserRole } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const usersService = {
  async getAll(): Promise<Profile[]> {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name')
    if (error) throw error
    return (data || []) as Profile[]
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<void> {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id)
    if (error) throw error
  },

  async getUserBranches(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_branches').select('branch_id').eq('user_id', userId)
    if (error) return []
    return (data || []).map((r: { branch_id: string }) => r.branch_id)
  },

  async setUserBranches(userId: string, branchIds: string[]): Promise<void> {
    await supabase.from('user_branches').delete().eq('user_id', userId)
    if (branchIds.length > 0) {
      const { error } = await supabase.from('user_branches').insert(
        branchIds.map(bid => ({ user_id: userId, branch_id: bid }))
      )
      if (error) throw error
    }
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id)
    if (error) throw error
  },

  async createUser(params: {
    email: string
    password: string
    fullName: string
    phone?: string
    role: UserRole
    branchIds: string[]
  }): Promise<{ user_id: string; email: string; role: string }> {
    const cleanEmail = params.email.trim().toLowerCase()
    const cleanName = params.fullName.trim()

    // 1. Crear usuario llamando directamente a la API REST de Supabase Auth (Sin conflictos de GoTrueClient ni localStorage)
    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: cleanEmail,
        password: params.password,
        data: {
          full_name: cleanName,
          role: params.role,
        }
      })
    })

    const responseData = await res.json()

    let userId: string | null = null

    if (res.ok && (responseData.id || responseData.user?.id)) {
      userId = responseData.id || responseData.user?.id
    } else {
      // Si la API REST nativa devuelve algún detalle, intentar mediante la RPC asegurada
      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_app_user', {
        p_email: cleanEmail,
        p_password: params.password,
        p_full_name: cleanName,
        p_phone: (params.phone || '').trim(),
        p_role: params.role,
        p_branch_ids: params.branchIds,
      })

      if (rpcErr || !rpcData || rpcData.success === false) {
        const errorMsg = responseData.error_description || responseData.msg || rpcData?.error || rpcErr?.message || 'No se pudo crear el usuario.'
        throw new Error(errorMsg)
      }
      return rpcData
    }

    if (!userId) throw new Error('No se obtuvo el ID del usuario.')

    // 2. Insertar / Actualizar Perfil
    await supabase.from('profiles').upsert({
      id: userId,
      full_name: cleanName,
      phone: (params.phone || '').trim(),
      role: params.role,
      is_active: true,
    })

    // 3. Asignar Sucursales
    if (params.branchIds && params.branchIds.length > 0) {
      await this.setUserBranches(userId, params.branchIds)
    }

    // 4. Registro de Auditoría
    const { data: currentSession } = await supabase.auth.getSession()
    if (currentSession?.session?.user?.id) {
      await supabase.from('audit_logs').insert({
        user_id: currentSession.session.user.id,
        action: 'CREATE_USER',
        table_name: 'profiles',
        record_id: userId,
        new_data: { email: cleanEmail, full_name: cleanName, role: params.role, branches: params.branchIds },
      })
    }

    return { user_id: userId!, email: cleanEmail, role: params.role }
  },

  async deleteUser(userId: string): Promise<void> {
    const { data, error } = await supabase.rpc('delete_app_user', {
      p_target_user_id: userId,
    })
    if (error) throw error
    if (data && data.success === false) {
      throw new Error(data.error)
    }
  },
}
