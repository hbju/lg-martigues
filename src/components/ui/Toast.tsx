import { useEffect, useState } from 'react'
import type { Notification } from '../../types/supabase'

interface ToastProps {
    notification: Notification
    onDismiss: () => void
    onTap?: () => void
}

const typeIcons: Record<string, string> = {
    role_assigned: '🎭',
    vote_open: '🗳️',
    vote_result: '📊',
    eliminated: '💀',
    murder_window: '🐺',
    murder_result: '🔪',
    infected: '🦠',
    shield_gained: '🛡️',
    clairvoyance_gained: '🔮',
    clairvoyance_result: '👁️',
    generic: '📢',
}

export function Toast({ notification, onDismiss, onTap }: ToastProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // animate in
        requestAnimationFrame(() => setIsVisible(true))

        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(onDismiss, 300) // wait for exit animation
        }, 5000)

        return () => clearTimeout(timer)
    }, [onDismiss])

    return (
        <div
            onClick={onTap}
            className={`fixed top-4 left-4 right-4 z-50 cursor-pointer transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
                }`}
        >
            <div className="bg-night-800/95 border border-candle-500/30 rounded-xl p-4 backdrop-blur-sm shadow-lg shadow-black/30 max-w-md mx-auto">
                <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{typeIcons[notification.type] ?? '📢'}</span>
                    <div className="flex-1 min-w-0">
                        <p className="font-cinzel text-parchment-100 text-sm font-semibold tracking-wide">
                            {notification.title}
                        </p>
                        <p className="font-crimson text-moon-400 text-sm mt-0.5 truncate">
                            {notification.message}
                        </p>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsVisible(false); setTimeout(onDismiss, 300) }}
                        className="text-moon-400/50 hover:text-parchment-200 transition-colors text-lg leading-none"
                    >
                        ×
                    </button>
                </div>
            </div>
        </div>
    )
}
