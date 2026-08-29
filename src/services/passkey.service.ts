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
  if (/android/i.test(userAgent)) return 'Biometría Android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'Face ID / Touch ID (iOS)'
  if (/macintosh/i.test(userAgent)) return 'Touch ID (macOS)'
  return 'Autenticador de Dispositivo'
}

export const passkeyService = {
  // Comprobar compatibilidad del dispositivo/navegador con WebAuthn y autenticadores de plataforma
  async isSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) {
      return false
    }

    if (!window.isSecureContext) {
      // Localhost cuenta como contexto seguro en los navegadores
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
    } catch (err) {
      console.warn('Error comprobando autenticador de plataforma:', err)
      return true
    }
  },

  // Obtener passkeys registradas del usuario autenticado
  async getUserPasskeys(userId: string): Promise<UserPasskey[]> {
    try {
      const { data, error } = await supabase
        .from('user_passkeys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('No se encontraron passkeys o la tabla aún no se ha creado:', error.message)
        return []
      }
      return data || []
    } catch {
      return []
    }
  },

  // Registrar nueva Passkey en el dispositivo mediante WebAuthn
  async registerPasskey(userId: string, email: string): Promise<{ success: boolean; message: string }> {
    const supported = await this.isSupported()
    if (!supported) {
      throw new Error('Tu dispositivo o navegador no soporta la autenticación biométrica WebAuthn / Passkeys.')
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
        authenticatorAttachment: 'platform', // Windows Hello, Touch ID, Face ID, Android Biometrics
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
        throw new Error('No se recibió la credencial del dispositivo.')
      }

      const credentialIdStr = arrayBufferToBase64Url(credential.rawId)
      const deviceName = getDeviceName()

      // Guardar únicamente la metadata de la credencial criptográfica pública (NUNCA huellas ni claves privadas)
      const { error } = await supabase.from('user_passkeys').insert({
        user_id: userId,
        credential_id: credentialIdStr,
        device_name: deviceName,
      })

      if (error) {
        if (error.code === '23505') {
          return {
            success: fontSuccessCheck(true),
            message: 'Este dispositivo ya tiene una Passkey registrada en el sistema.',
          }
        }
        throw error
      }

      return {
        success: true,
        message: 'Acceso por huella / Passkey activado correctamente en este dispositivo.',
      }
    } catch (err: any) {
      console.error('Error registrando Passkey:', err)
      if (err.name === 'NotAllowedError') {
        throw new Error('Cancelaste la verificación de Windows Hello / biometría.')
      }
      throw new Error(err.message || 'Error al comunicarse con el lector biométrico del dispositivo.')
    }
  },

  // Autenticar mediante Passkey en el Login
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
        error: 'Tu dispositivo o navegador no soporta autenticación biométrica Passkey.',
      }
    }

    const challenge = window.crypto.getRandomValues(new Uint8Array(32))

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: 'required',
      rpId: window.location.hostname,
    }

    try {
      const assertion = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential

      if (!assertion || !assertion.rawId) {
        return {
          success: false,
          error: 'No se recibió la respuesta biométrica del dispositivo.',
        }
      }

      const credentialIdStr = arrayBufferToBase64Url(assertion.rawId)

      // Validar la credencial biométrica de forma segura en el servidor
      const { data, error } = await supabase.rpc('login_with_passkey', {
        p_credential_id: credentialIdStr,
      })

      if (error || !data) {
        console.error('Error procesando login_with_passkey:', error)
        return {
          success: false,
          error: error?.message || 'Credencial biométrica no encontrada o no válida.',
        }
      }

      if (!data.success) {
        return {
          success: false,
          error: data.error || 'No fue posible verificar tu identidad.',
        }
      }

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

  // Revocar / Desactivar la Passkey del usuario
  async revokePasskey(userId: string): Promise<void> {
    const { error } = await supabase.from('user_passkeys').delete().eq('user_id', userId)
    if (error) throw error
  },
}

function fontSuccessCheck(val: boolean) {
  return val
}
