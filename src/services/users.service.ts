import { supabase } from '../lib/supabase'
import { Profile, UserRole } from '../types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export type ProfileWithBranches = Profile & {
  branch_ids?: string[]
}

export const usersService = {
  async getAll(): Promise<ProfileWithBranches[]> {
    let profiles: Profile[] = []

    const { data: rpcProfiles, error: rpcErr } = await supabase.rpc('get_app_users_with_email')
    if (!rpcErr && rpcProfiles) {
      profiles = rpcProfiles as Profile[]
    } else {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      profiles = (data || []) as Profile[]
    }

    const { data: userBranches } = await supabase.from('user_branches').select('user_id, branch_id')

    const branchMap: Record<string, string[]> = {}
    if (userBranches) {
      userBranches.forEach((ub: { user_id: string; branch_id: string }) => {
        if (!branchMap[ub.user_id]) branchMap[ub.user_id] = []
        branchMap[ub.user_id].push(ub.branch_id)
      })
    }

    return profiles.map((p: Profile) => ({
      ...p,
      branch_ids: branchMap[p.id] || [],
    })) as ProfileWithBranches[]
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<void> {
    const { error } = await supabase.from('profiles').update(updates).eq('id', id)
    if (error) throw error

    // Log to audit if current session exists
    const { data: currentSession } = await supabase.auth.getSession()
    if (currentSession?.session?.user?.id) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: currentSession.session.user.id,
          action: 'UPDATE_PROFILE',
          table_name: 'profiles',
          record_id: id,
          new_data: updates,
        })
      } catch (logErr) {
        console.warn('Audit log error (ignored):', logErr)
      }
    }
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

    const { data: currentSession } = await supabase.auth.getSession()
    if (currentSession?.session?.user?.id) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: currentSession.session.user.id,
          action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
          table_name: 'profiles',
          record_id: id,
          new_data: { is_active: isActive },
        })
      } catch (logErr) {
        console.warn('Audit log error (ignored):', logErr)
      }
    }
  },

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    // Call secure backend RPC function
    const { data, error } = await supabase.rpc('admin_reset_user_password', {
      p_target_user_id: userId,
      p_new_password: newPassword,
    })

    if (error) {
      // Fallback: if script 11 was not yet executed, attempt reset_app_user_password
      const { data: fallbackData, error: fallbackErr } = await supabase.rpc('reset_app_user_password', {
        p_target_user_id: userId,
        p_new_password: newPassword,
      })

      if (fallbackErr) {
        throw new Error(fallbackErr.message || error.message || 'No se pudo restablecer la contraseña.')
      }

      if (fallbackData && fallbackData.success === false) {
        throw new Error(fallbackData.error || 'Error al restablecer la contraseña.')
      }

      return
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'No fue posible cambiar la contraseña.')
    }
  },

  async checkUserHistory(userId: string): Promise<{ hasHistory: boolean; message?: string }> {
    try {
      // Query sales count for this user
      const { count: salesCount } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('cashier_id', userId)

      // Query cash registers for this user
      const { count: registersCount } = await supabase
        .from('cash_registers')
        .select('*', { count: 'exact', head: true })
        .eq('cashier_id', userId)

      const hasHistory = (salesCount ?? 0) > 0 || (registersCount ?? 0) > 0

      return {
        hasHistory,
        message: hasHistory
          ? `Este usuario cuenta con ${salesCount || 0} ventas y ${registersCount || 0} turnos de caja en el historial.`
          : undefined,
      }
    } catch {
      // If direct count fails due to RLS, default to safe false/true
      return { hasHistory: false }
    }
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

    // 1. Crear usuario llamando directamente a la API REST de Supabase Auth
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
        },
      }),
    })

    const responseData = await res.json()

    let userId: string | null = null

    if (res.ok && (responseData.id || responseData.user?.id)) {
      userId = responseData.id || responseData.user?.id
    } else {
      // Intentar mediante la RPC asegurada
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
      try {
        await supabase.from('audit_logs').insert({
          user_id: currentSession.session.user.id,
          action: 'CREATE_USER',
          table_name: 'profiles',
          record_id: userId,
          new_data: { email: cleanEmail, full_name: cleanName, role: params.role, branches: params.branchIds },
        })
      } catch (logErr) {
        console.warn('Audit log error (ignored):', logErr)
      }
    }

    return { user_id: userId!, email: cleanEmail, role: params.role }
  },

  async deleteUser(userId: string): Promise<void> {
    const { data, error } = await supabase.rpc('delete_app_user', {
      p_target_user_id: userId,
    })
    if (error) throw error
    if (data && data.success === false) {
      throw new Error(data.error || 'No se pudo eliminar el usuario.')
    }
  },
}
