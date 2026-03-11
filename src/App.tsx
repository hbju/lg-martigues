import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { PlayerGuard } from './components/layout/PlayerGuard'
import { GMGuard } from './components/layout/GMGuard'
import { GhostGuard } from './components/layout/GhostGuard'
import { WerewolfGuard } from './components/layout/WerewolfGuard'
import { ToastContainer } from './components/layout/ToastContainer'
import { LoginPage } from './features/auth/LoginPage'
import { LobbyPage } from './features/game/LobbyPage'
import { RoleRevealPage } from './features/game/RoleRevealPage'
import { HomePage } from './features/game/HomePage'
import { VotePage } from './features/voting/VotePage'
import { WerewolfPage } from './features/werewolf/WerewolfPage'
import { GMDashboardPage } from './features/gm/GMDashboardPage'
import { GMQRCodesPage } from './features/gm/GMQRCodesPage'
import { GMVotesPage } from './features/gm/GMVotesPage'
import { GMMurderPage } from './features/gm/GMMurderPage'
import { GMInfectionPage } from './features/gm/GMInfectionPage'
import { GMBroadcastPage } from './features/gm/GMBroadcastPage'

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
        path="/vote"
        element={
          <GhostGuard>
            <VotePage />
          </GhostGuard>
        }
      />

      <Route
        path="/werewolf"
        element={
          <WerewolfGuard>
            <WerewolfPage />
          </WerewolfGuard>
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

      <Route
        path="/gm/votes"
        element={
          <GMGuard>
            <GMVotesPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/murder"
        element={
          <GMGuard>
            <GMMurderPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/infection"
        element={
          <GMGuard>
            <GMInfectionPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/broadcast"
        element={
          <GMGuard>
            <GMBroadcastPage />
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
      <ToastContainer />
      <AppRoutes />
    </BrowserRouter>
  )
}
