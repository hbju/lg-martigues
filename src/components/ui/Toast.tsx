import { useEffect, useState, type ReactNode } from 'react'
import type { Notification } from '../../types/supabase'
import { GiScales, GiVote, GiDeathSkull, GiWolfHead, GiBloodySword, GiBiohazard, GiCheckedShield, GiCrystalBall } from 'react-icons/gi'
import { RiBarChartBoxFill, RiEyeFill, RiMegaphoneFill } from 'react-icons/ri'

interface ToastProps {
    notification: Notification
    onDismiss: () => void
    onTap?: () => void
}

const typeIcons: Record<string, ReactNode> = {
    role_assigned: <GiScales />,
    vote_open: <GiVote />,
    vote_result: <RiBarChartBoxFill />,
    eliminated: <GiDeathSkull />,
    murder_window: <GiWolfHead />,
    murder_result: <GiBloodySword />,
    infected: <GiBiohazard />,
    shield_gained: <GiCheckedShield />,
    clairvoyance_gained: <GiCrystalBall />,
    clairvoyance_result: <RiEyeFill />,
    generic: <RiMegaphoneFill />,
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
                    <span className="flex justify-center text-xl flex-shrink-0">{typeIcons[notification.type] ?? <RiMegaphoneFill />}</span>
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
