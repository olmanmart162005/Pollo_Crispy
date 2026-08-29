import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import SplashScreen from '../ui/SplashScreen'

export default function ProtectedRoute() {
  const { user, profile, loading, initError, retryInit } = useAuth()

  if (loading) {
    return <SplashScreen error={initError} onRetry={retryInit} />
  }

  // Strict check: user must exist, profile must exist and must be active
  if (!user || !profile || !profile.is_active) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
