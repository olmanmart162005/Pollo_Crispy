import React from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'

interface SplashScreenProps {
  error?: string | null
  onRetry?: () => void
}

export default function SplashScreen({ error, onRetry }: SplashScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-red-700 via-red-600 to-amber-600 p-6 select-none overflow-hidden">
      {/* Subtle Background Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Decorative Glow Elements */}
      <div className="absolute -top-24 -left-24 w-80 h-80 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-red-900/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-sm w-full text-center z-10 animate-fade-in">
        {/* Logo Container with Elevation */}
        <div className="relative mb-6">
          <div className="w-28 h-28 bg-white rounded-3xl p-3.5 shadow-2xl shadow-black/25 flex items-center justify-center transform transition-transform duration-500 hover:scale-105">
            <img
              src="/LogoCrispyBueno.png"
              alt="Pollo Crispy Logo"
              className="w-full h-full object-contain"
            />
          </div>
          {/* Subtle pulse ring */}
          <div className="absolute inset-0 rounded-3xl border-2 border-amber-300/40 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
        </div>

        {/* Brand Titles */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display drop-shadow-md">
          POLLO CRISPY
        </h1>
        <p className="text-amber-100/90 text-sm font-medium mt-1 tracking-wide">
          Sistema de Punto de Venta y Gestión
        </p>

        {/* Loader or Error Block */}
        <div className="mt-8 w-full flex flex-col items-center">
          {error ? (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white space-y-3 w-full shadow-lg animate-scale-in">
              <div className="flex items-center justify-center gap-2 text-amber-200 font-semibold text-sm">
                <AlertCircle size={18} />
                <span>Problema de conexión</span>
              </div>
              <p className="text-xs text-white/80">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="btn bg-white text-red-700 hover:bg-amber-50 font-bold w-full text-xs shadow-md"
                >
                  <RefreshCw size={14} /> Reintentar
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              {/* Modern horizontal progress bar with glowing indeterminate animation */}
              <div className="w-44 h-1.5 bg-black/20 rounded-full overflow-hidden relative">
                <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-amber-300 to-amber-100 rounded-full animate-[loading_1.4s_ease-in-out_infinite]" />
              </div>
              <span className="text-xs text-amber-100/80 font-medium animate-pulse">
                Iniciando sistema...
              </span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-12 text-[11px] text-white/50 font-medium">
          Pollo Crispy POS &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
