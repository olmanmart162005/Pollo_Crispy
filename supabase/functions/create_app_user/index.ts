import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Definición estricta de Headers CORS para Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  // 1. Manejo OBLIGATORIO de PREFLIGHT (OPTIONS)
  // Debe ser lo PRIMERO que responda la función y siempre devolver HTTP 200 con headers CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    // 2. Verificar Header de Autorización
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se proporcionó token de autorización.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Client para verificar sesión del usuario que llama la función
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no autenticado o sesión expirada.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Verificar Rol del Usuario en profiles
    const { data: callerProfile, error: profileErr } = await supabaseUserClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileErr || !callerProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo verificar el perfil del usuario solicitante.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const callerRole = callerProfile.role

    if (callerRole === 'CAJERO') {
      return new Response(
        JSON.stringify({ success: false, error: 'Los cajeros no tienen permisos para crear usuarios.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Leer Body de la Petición
    const body = await req.json()
    const { email, password, full_name, phone, role, branch_ids } = body

    if (!email || !password || !full_name) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obligatorios incompletos (email, password o nombre).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (callerRole === 'ADMIN' && role !== 'CAJERO') {
      return new Response(
        JSON.stringify({ success: false, error: 'Los administradores solo pueden crear usuarios con rol CAJERO.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Cliente Administrativo (Service Role Key) en Entorno Servidor Protegido
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Crear Usuario en Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim(), role: role },
    })

    if (createError) {
      console.error('Error creando usuario en Auth:', createError)
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = newUser.user.id

    // Insertar/Actualizar Profile
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert({
      id: newUserId,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : null,
      role: role,
      is_active: true,
    })

    if (profErr) {
      console.error('Error creando profile, deshaciendo usuario auth:', profErr)
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return new Response(
        JSON.stringify({ success: false, error: `Error creando perfil: ${profErr.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insertar Sucursales Asignadas
    if (branch_ids && Array.isArray(branch_ids) && branch_ids.length > 0) {
      const branchesToInsert = branch_ids.map((bId: string) => ({
        user_id: newUserId,
        branch_id: bId,
      }))
      const { error: bErr } = await supabaseAdmin.from('user_branches').insert(branchesToInsert)
      if (bErr) {
        console.error('Error insertando user_branches:', bErr)
      }
    }

    // Registrar en Audit Log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'CREATE_USER',
      table_name: 'profiles',
      record_id: newUserId,
      new_data: { email, full_name, role, branch_ids },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuario creado correctamente',
        user: { id: newUserId, email: email, role: role }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error inesperado del servidor'
    console.error('Error inesperado:', err)
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
