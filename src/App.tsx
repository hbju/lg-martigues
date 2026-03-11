import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { PlayerGuard } from './components/layout/PlayerGuard'
import { GMGuard } from './components/layout/GMGuard'
import { LoginPage } from './features/auth/LoginPage'
import { LobbyPage } from './features/game/LobbyPage'
import { RoleRevealPage } from './features/game/RoleRevealPage'
import { HomePage } from './features/game/HomePage'
import { GMDashboardPage } from './features/gm/GMDashboardPage'
import { GMQRCodesPage } from './features/gm/GMQRCodesPage'

function AppRoutes() {
  const { restoreSession, player, isGM } = useAuthStore()

  useEffect(() => {
    restoreSession()
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/lobby"
        element={
          <PlayerGuard>
            <LobbyPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/reveal"
        element={
          <PlayerGuard>
            <RoleRevealPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/home"
        element={
          <PlayerGuard>
            <HomePage />
          </PlayerGuard>
        }
      />

      <Route
        path="/gm"
        element={
          <GMGuard>
            <GMDashboardPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/qr-codes"
        element={
          <GMGuard>
            <GMQRCodesPage />
          </GMGuard>
        }
      />

      <Route path="*" element={<Navigate to={player ? (isGM ? '/gm' : '/lobby') : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
