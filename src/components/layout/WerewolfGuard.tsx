import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function WerewolfGuard({ children }: { children: React.ReactNode }) {
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

    if (player.role !== 'werewolf' || player.status !== 'alive') {
        return <Navigate to="/home" replace />
    }

    return <>{children}</>
}
