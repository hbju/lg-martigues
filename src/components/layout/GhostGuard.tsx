import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { GiGhost } from 'react-icons/gi'

/**
 * Blocks ghost players from accessing vote/werewolf routes.
 * Redirects to /home with a message.
 */
export function GhostGuard({ children }: { children: React.ReactNode }) {
  const { player, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-village-night flex items-center justify-center">
        <div className="animate-candle text-candle-400 font-cinzel text-lg">Chargement...</div>
      </div>
    )
  }

  if (!player) {
    return <Navigate to="/login" replace />
  }

  if (player.status === 'ghost') {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6 ghost-mode">
        <div className="text-5xl mb-4 opacity-60"><GiGhost className="inline text-5xl" /></div>
        <p className="font-cinzel text-moon-400/60 text-xl text-center tracking-wide">
          Les morts observent, mais ne parlent pas.
        </p>
        <a href="/home" className="mt-6 font-crimson text-candle-400/60 hover:text-candle-400 transition-colors underline">
          Retour au village
        </a>
      </div>
    )
  }

  return <>{children}</>
}
