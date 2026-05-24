import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SpotEditorPage from './pages/SpotEditorPage'
import SessionsPage from './pages/SessionsPage'
import UsersPage from './pages/UsersPage'
import SystemPage from './pages/SystemPage'
import UserGuidePage from './pages/UserGuidePage'
import { ToastProvider } from './components/Toast'

export type AdminRole = 'admin' | 'operator'

function readStoredRole(): AdminRole | null {
  const r = localStorage.getItem('user_role')
  return r === 'admin' || r === 'operator' ? r : null
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [role, setRole] = useState<AdminRole | null>(readStoredRole())

  function handleLogin(t: string, r: AdminRole) {
    setToken(t)
    setRole(r)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user_role')
    setToken(null)
    setRole(null)
  }

  if (!token || !role) {
    return (
      <ToastProvider>
        <LoginPage onLogin={handleLogin} />
      </ToastProvider>
    )
  }

  const isAdmin = role === 'admin'

  return (
    <ToastProvider>
      <Routes>
        <Route element={<Layout onLogout={handleLogout} role={role} />}>
          <Route path="/" element={<DashboardPage />} />
          {isAdmin && <Route path="/park-alanlari" element={<SpotEditorPage />} />}
          {isAdmin && <Route path="/oturumlar" element={<SessionsPage />} />}
          {isAdmin && <Route path="/kullanicilar" element={<UsersPage />} />}
          <Route path="/sistem" element={<SystemPage onLogout={handleLogout} />} />
          <Route path="/kilavuz" element={<UserGuidePage />} />
          {/* Eski rotalar için yönlendirme */}
          <Route path="/fiyatlandirma" element={<Navigate to="/sistem#pricing" replace />} />
          <Route path="/ayarlar" element={<Navigate to="/sistem#general" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  )
}
