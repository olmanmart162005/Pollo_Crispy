import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import { passkeyService } from '../services/passkey.service'

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signInWithPasskey: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  retryInit: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  // In-flight fetch cache to prevent duplicate concurrent network requests
  const pendingProfileFetch = useRef<Promise<Profile | null> | null>(null)
  const isInitialized = useRef(false)

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    if (pendingProfileFetch.current) {
      return pendingProfileFetch.current
    }

    pendingProfileFetch.current = (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (error) {
          console.error('Error fetching profile:', error)
          setProfile(null)
          return null
        }

        if (!data) {
          setProfile(null)
          return null
        }

        const prof = data as Profile
        setProfile(prof)
        setInitError(null)
        return prof
      } catch (err: unknown) {
        console.error('Failed to load profile:', err)
        setProfile(null)
        return null
      } finally {
        pendingProfileFetch.current = null
      }
    })()

    return pendingProfileFetch.current
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  const initAuth = async () => {
    setLoading(true)
    setInitError(null)
    const minSplashDuration = new Promise(resolve => setTimeout(resolve, 2000))
    try {
      const authTask = (async () => {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (currentSession?.user) {
          const p = await fetchProfile(currentSession.user.id)
          if (!p || !p.is_active) {
            await supabase.auth.signOut()
            localStorage.removeItem('pollo_passkey_session')
            setUser(null)
            setSession(null)
            setProfile(null)
            setInitError('Tu cuenta se encuentra desactivada. Contacta al administrador.')
            return
          }
          setSession(currentSession)
          setUser(currentSession.user)
          return
        }

        // Comprobar si existe una sesión previa por Passkey en el navegador
        const passkeyStorage = localStorage.getItem('pollo_passkey_session')
        if (passkeyStorage) {
          try {
            const parsed = JSON.parse(passkeyStorage)
            if (parsed.userId) {
              const p = await fetchProfile(parsed.userId)
              if (p && p.is_active) {
                const passkeyUser = {
                  id: parsed.userId,
                  email: parsed.email,
                  aud: 'authenticated',
                  role: 'authenticated',
                  app_metadata: {},
                  user_metadata: {},
                  created_at: new Date().toISOString(),
                } as User
                setUser(passkeyUser)
                setProfile(p)
                setSession({
                  access_token: 'passkey_token',
                  refresh_token: 'passkey_refresh',
                  expires_in: 3600,
                  token_type: 'bearer',
                  user: passkeyUser,
                })
                return
              }
            }
          } catch {
            localStorage.removeItem('pollo_passkey_session')
          }
        }

        setSession(null)
        setUser(null)
        setProfile(null)
      })()

      await Promise.all([authTask, minSplashDuration])
    } catch (err: unknown) {
      console.error('Auth initialization error:', err)
      setInitError(err instanceof Error ? err.message : 'Error al conectar con el servidor')
      await minSplashDuration
    } finally {
      isInitialized.current = true
      setLoading(false)
    }
  }

  useEffect(() => {
    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isInitialized.current && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
          return
        }

        if (newSession?.user) {
          const p = await fetchProfile(newSession.user.id)
          if (!p || !p.is_active) {
            await supabase.auth.signOut()
            localStorage.removeItem('pollo_passkey_session')
            setUser(null)
            setSession(null)
            setProfile(null)
          } else {
            setSession(newSession)
            setUser(newSession.user)
          }
        } else if (!localStorage.getItem('pollo_passkey_session')) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem('pollo_passkey_session')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error

    if (data.user) {
      const p = await fetchProfile(data.user.id)
      if (!p) {
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
        throw new Error('Tu cuenta se encuentra desactivada o no tiene perfil configurado. Contacta al administrador.')
      }
      if (!p.is_active) {
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
        throw new Error('Tu cuenta se encuentra desactivada. Contacta al administrador.')
      }
      setUser(data.user)
      setSession(data.session)
    }
  }

  const signInWithPasskey = async () => {
    const result = await passkeyService.authenticatePasskey()
    if (!result.success || !result.user_id) {
      throw new Error(result.error || 'No fue posible autenticarte con este dispositivo.')
    }

    const p = await fetchProfile(result.user_id)
    if (!p) {
      throw new Error('No se encontró el perfil de usuario asociado.')
    }
    if (!p.is_active) {
      throw new Error('Tu cuenta se encuentra desactivada. Contacta al administrador.')
    }

    const passkeyUser = {
      id: result.user_id,
      email: result.email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    } as User

    setUser(passkeyUser)
    setProfile(p)
    setSession({
      access_token: 'passkey_token_' + Date.now(),
      refresh_token: 'passkey_refresh_' + Date.now(),
      expires_in: 3600,
      token_type: 'bearer',
      user: passkeyUser,
    })

    localStorage.setItem('pollo_passkey_session', JSON.stringify({
      userId: result.user_id,
      email: result.email,
      timestamp: Date.now(),
    }))
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Sign out error:', err)
    } finally {
      localStorage.removeItem('pollo_passkey_session')
      localStorage.removeItem('activeBranchId')
      setProfile(null)
      setUser(null)
      setSession(null)
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        initError,
        signIn,
        signInWithPasskey,
        signOut,
        refreshProfile,
        retryInit: initAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
