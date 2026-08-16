import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { BranchProvider } from './context/BranchContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import MainLayout from './layouts/MainLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Sales from './pages/Sales'
import SaleDetail from './pages/SaleDetail'
import CashRegister from './pages/CashRegister'
import Products from './pages/Products'
import Categories from './pages/Categories'
import Combos from './pages/Combos'
import Branches from './pages/Branches'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Audit from './pages/Audit'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontFamily: 'Inter, sans-serif', fontSize: '14px', borderRadius: '10px' },
              success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/ventas" element={<Sales />} />
                <Route path="/ventas/:id" element={<SaleDetail />} />
                <Route path="/caja" element={<CashRegister />} />
                <Route path="/productos" element={<Products />} />
                <Route path="/categorias" element={<Categories />} />
                <Route path="/combos" element={<Combos />} />
                <Route path="/sucursales" element={<Branches />} />
                <Route path="/usuarios" element={<Users />} />
                <Route path="/reportes" element={<Reports />} />
                <Route path="/auditoria" element={<Audit />} />
                <Route path="/configuracion" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
