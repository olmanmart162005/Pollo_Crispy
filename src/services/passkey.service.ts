import { supabase } from '../lib/supabase'

export interface UserPasskey {
  id: string
  user_id: string
  credential_id: string
  device_name: string
  created_at: string
}

// Convertidores de ArrayBuffer a Base64URL y viceversa para WebAuthn
export function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = window.btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function getDeviceName(): string {
  const userAgent = navigator.userAgent || ''
  if (/windows/i.test(userAgent)) return 'Windows Hello (Huella / Rostro / PIN)'
  if (/android/i.test(userAgent)) return 'Huella / Biometría Android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'Face ID / Touch ID (iOS)'
  if (/macintosh/i.test(userAgent)) return 'Touch ID (macOS)'
  return 'Biometría de Dispositivo'
}

export const passkeyService = {
  // Comprobar si el navegador y el dispositivo soportan autenticación biométrica nativa
  async isSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) {
      return false
    }

    if (!window.isSecureContext) {
      const isLocalhost = Boolean(
        window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1' ||
          window.location.hostname === '[::1]'
      )
      if (!isLocalhost) return false
    }

    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        return available
      }
      return true
    } catch {
      return true
    }
  },

  // Saber si este dispositivo local tiene una huella registrada
  getLocalPasskeyId(): string | null {
    return localStorage.getItem('pollo_registered_passkey')
  },

  // Obtener passkeys registradas desde Supabase
  async getUserPasskeys(userId: string): Promise<UserPasskey[]> {
    try {
      const { data, error } = await supabase
        .from('user_passkeys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) return []
      return data || []
    } catch {
      return []
    }
  },

  // PASO 1: REGISTRO — Invocar el lector biométrico nativo (Windows Hello, Samsung Fingerprint, iPhone Face ID)
  async registerPasskey(userId: string, email: string): Promise<{ success: boolean; message: string }> {
    const supported = await this.isSupported()
    if (!supported) {
      throw new Error('Tu dispositivo no soporta la autenticación biométrica WebAuthn.')
    }

    const challenge = window.crypto.getRandomValues(new Uint8Array(32))
    const userIdBytes = new TextEncoder().encode(userId)

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'Pollo Crispy POS',
        id: window.location.hostname,
      },
      user: {
        id: userIdBytes,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' },  // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    }

    try {
      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential

      if (!credential || !credential.rawId) {
        throw new Error('No se completó la verificación biométrica.')
      }

      // Obtener el identificador Base64URL uniforme
      const credentialIdStr = credential.id || arrayBufferToBase64Url(credential.rawId)
      const deviceName = getDeviceName()

      // Guardar en la base de datos de Supabase
      const { error } = await supabase.from('user_passkeys').insert({
        user_id: userId,
        credential_id: credentialIdStr,
        device_name: deviceName,
      })

      if (error && error.code !== '23505') {
        throw error
      }

      // Guardar el identificador localmente
      localStorage.setItem('pollo_registered_passkey', credentialIdStr)

      return {
        success: true,
        message: 'Acceso biométrico activado correctamente en este dispositivo.',
      }
    } catch (err: any) {
      console.error('Error al registrar biometría:', err)
      if (err.name === 'NotAllowedError') {
        throw new Error('Cancelaste la autenticación biométrica en tu dispositivo.')
      }
      throw new Error(err.message || 'Error al comunicarse con el sensor biométrico del dispositivo.')
    }
  },

  // PASO 2: AUTENTICACIÓN — Iniciar sesión con la huella
  async authenticatePasskey(): Promise<{
    success: boolean
    user_id?: string
    email?: string
    full_name?: string
    role?: string
    error?: string
  }> {
    const supported = await this.isSupported()
    if (!supported) {
      return {
        success: false,
        error: 'Tu dispositivo no soporta autenticación biométrica.',
      }
    }

    const localCredId = this.getLocalPasskeyId()
    const challenge = window.crypto.getRandomValues(new Uint8Array(32))

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      rpId: window.location.hostname,
    }

    if (localCredId) {
      publicKeyOptions.allowCredentials = [
        {
          type: 'public-key',
          id: base64UrlToArrayBuffer(localCredId),
        },
      ]
    }

    try {
      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential

      if (!assertion || !assertion.rawId) {
        return {
          success: false,
          error: 'No se completó la lectura biométrica.',
        }
      }

      const credentialIdStr = assertion.id || arrayBufferToBase64Url(assertion.rawId)

      // Verificar en Supabase mediante la función RPC segura login_with_passkey
      const { data, error } = await supabase.rpc('login_with_passkey', {
        p_credential_id: credentialIdStr,
      })

      if (error) {
        console.error('Error llamando a login_with_passkey RPC:', error)
        if (
          error.code === '42883' ||
          error.message?.includes('Could not find the function') ||
          error.message?.includes('PGRST202') ||
          (error as any).status === 400 ||
          (error as any).status === 403
        ) {
          return {
            success: false,
            error: 'Debes ejecutar el nuevo script sql/12_passkeys.sql en el Editor SQL de tu proyecto Supabase para habilitar los permisos biométricos.',
          }
        }
        return {
          success: false,
          error: error.message || 'Error al validar la credencial biométrica en el servidor.',
        }
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'No fue posible verificar tu identidad.',
        }
      }

      // Guardar el id localmente
      localStorage.setItem('pollo_registered_passkey', credentialIdStr)

      return data
    } catch (err: any) {
      console.error('Error en autenticación biométrica:', err)
      if (err.name === 'NotAllowedError') {
        return {
          success: false,
          error: 'No fue posible autenticarte con este dispositivo.',
        }
      }
      return {
        success: false,
        error: err.message || 'Error al comunicarse con el lector biométrico.',
      }
    }
  },

  // Revocar / Desactivar el acceso biométrico del usuario
  async revokePasskey(userId: string): Promise<void> {
    localStorage.removeItem('pollo_registered_passkey')
    const { error } = await supabase.from('user_passkeys').delete().eq('user_id', userId)
    if (error) throw error
  },
}
