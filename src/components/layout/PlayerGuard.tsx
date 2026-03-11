import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

export function PlayerGuard({ children }: { children: React.ReactNode }) {
    const { player, isGM, isLoading } = useAuthStore()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-village-night flex items-center justify-center">
                <div className="animate-candle text-candle-400 font-cinzel text-lg">Chargement...</div>
            </div>
        )
    }

    if (isGM) {
        return <Navigate to="/gm" replace />
    }

    if (!player) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}
