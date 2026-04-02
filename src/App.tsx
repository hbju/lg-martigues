import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { PlayerGuard } from './components/layout/PlayerGuard'
import { GMGuard } from './components/layout/GMGuard'
import { GhostGuard } from './components/layout/GhostGuard'
import { WerewolfGuard } from './components/layout/WerewolfGuard'
import { ToastContainer } from './components/layout/ToastContainer'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { ConnectionBanner } from './components/ui/ConnectionBanner'
import { LoginPage } from './features/auth/LoginPage'
import { LobbyPage } from './features/game/LobbyPage'
import { RoleRevealPage } from './features/game/RoleRevealPage'
import { HomePage } from './features/game/HomePage'
import { FinalRevealPage } from './features/game/FinalRevealPage'
import { RecapPage } from './features/game/RecapPage'
import { VotePage } from './features/voting/VotePage'
import { ContinuePollPage } from './features/voting/ContinuePollPage'
import { WerewolfPage } from './features/werewolf/WerewolfPage'
import { GMDashboardPage } from './features/gm/GMDashboardPage'
import { GMQRCodesPage } from './features/gm/GMQRCodesPage'
import { GMVotesPage } from './features/gm/GMVotesPage'
import { GMMurderPage } from './features/gm/GMMurderPage'
import { GMInfectionPage } from './features/gm/GMInfectionPage'
import { GMBroadcastPage } from './features/gm/GMBroadcastPage'
import { InventoryPage } from './features/powerups/InventoryPage'
import { ScanPage } from './features/powerups/ScanPage'
import { GMPowerUpsPage } from './features/gm/GMPowerUpsPage'
import { GMRewardQRPage } from './features/gm/GMRewardQRPage'
import { BeerPongPage } from './features/challenges/BeerPongPage'
import { MadScientistsPage } from './features/challenges/MadScientistsPage'
import { GMChallengesPage } from './features/gm/GMChallengesPage'
import { GMBeerPongPage } from './features/gm/GMBeerPongPage'
import { GMMadScientistsPage } from './features/gm/GMMadScientistsPage'
import { GMChecklistPage } from './features/gm/GMChecklistPage'
import { GMHealthPage } from './features/gm/GMHealthPage'
import { TVPage } from './features/tv/TVPage'

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
        path="/vote/continue"
        element={
          <PlayerGuard>
            <ContinuePollPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/reveal/final"
        element={
          <PlayerGuard>
            <FinalRevealPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/recap"
        element={
          <PlayerGuard>
            <RecapPage />
          </PlayerGuard>
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

      {/* Sprint 3 — Player routes */}
      <Route
        path="/inventory"
        element={
          <PlayerGuard>
            <InventoryPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/scan"
        element={
          <PlayerGuard>
            <ScanPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/challenges/beer-pong"
        element={
          <PlayerGuard>
            <BeerPongPage />
          </PlayerGuard>
        }
      />

      <Route
        path="/challenges/mad-scientists"
        element={
          <PlayerGuard>
            <MadScientistsPage />
          </PlayerGuard>
        }
      />

      {/* Sprint 3 — GM routes */}
      <Route
        path="/gm/power-ups"
        element={
          <GMGuard>
            <GMPowerUpsPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/reward-qr"
        element={
          <GMGuard>
            <GMRewardQRPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/challenges"
        element={
          <GMGuard>
            <GMChallengesPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/challenges/beer-pong"
        element={
          <GMGuard>
            <GMBeerPongPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/challenges/mad-scientists"
        element={
          <GMGuard>
            <GMMadScientistsPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/checklist"
        element={
          <GMGuard>
            <GMChecklistPage />
          </GMGuard>
        }
      />

      <Route
        path="/gm/health"
        element={
          <GMGuard>
            <GMHealthPage />
          </GMGuard>
        }
      />

      {/* TV — no auth required */}
      <Route path="/tv" element={<TVPage />} />

      <Route path="*" element={<Navigate to={player ? (isGM ? '/gm' : '/lobby') : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ConnectionBanner />
        <ToastContainer />
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
