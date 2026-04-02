import { useState, type ReactNode } from 'react'
import { GiScales, GiWolfHead, GiGhost } from 'react-icons/gi'

interface EliminationOverlayProps {
    method: 'council' | 'werewolf'
    onDismiss: () => void
}

export function EliminationOverlay({ method, onDismiss }: EliminationOverlayProps) {
    const [stage, setStage] = useState<'announcement' | 'reminder'>('announcement')

    const messages: Record<string, { title: string; subtitle: string; icon: ReactNode }> = {
        council: {
            title: 'Éliminé par le Conseil',
            subtitle: 'Le village a voté contre toi.',
            icon: <GiScales />,
        },
        werewolf: {
            title: 'Tué dans la nuit',
            subtitle: 'Les loups-garous t\'ont choisi comme victime.',
            icon: <GiWolfHead />,
        },
    }

    const msg = messages[method]

    if (stage === 'reminder') {
        return (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-6 bg-night-950/95">
                <div className="text-center animate-fade-in-up">
                    <div className="text-5xl mb-4"><GiGhost /></div>
                    <p className="font-crimson text-moon-400 text-lg mb-2 italic">
                        Tu peux choisir de révéler ton rôle aux autres joueurs.
                    </p>
                    <p className="font-crimson text-moon-400/60 text-sm mb-8">
                        L'application ne révélera pas ton rôle automatiquement.
                    </p>
                    <button
                        onClick={onDismiss}
                        className="bg-gradient-to-b from-night-600 to-night-700 hover:from-night-500 hover:to-night-600 text-parchment-200 font-cinzel font-semibold py-3 px-10 rounded-lg transition-all border border-night-500"
                    >
                        Continuer en tant que Fantôme
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-6 bg-night-950/95">
            <div className="text-center animate-fade-in-up">
                <div className="text-6xl mb-6">{msg.icon}</div>
                <h1 className="font-cinzel text-3xl font-bold text-red-400 tracking-wide mb-3">
                    {msg.title}
                </h1>
                <p className="font-crimson text-moon-400 text-lg italic mb-8">
                    {msg.subtitle}
                </p>
                <button
                    onClick={() => setStage('reminder')}
                    className="bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 text-parchment-100 font-cinzel font-semibold py-3 px-10 rounded-lg transition-all shadow-lg shadow-blood-700/30"
                >
                    Continuer
                </button>
            </div>
        </div>
    )
}
