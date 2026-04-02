import { useState, type ReactNode } from 'react'
import { useNotificationStore } from '../../stores/notificationStore'
import { useAuthStore } from '../../stores/authStore'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { GiScales, GiVote, GiDeathSkull, GiWolfHead, GiBloodySword, GiBiohazard, GiCheckedShield, GiCrystalBall } from 'react-icons/gi'
import { RiBarChartBoxFill, RiEyeFill, RiMegaphoneFill, RiBellFill } from 'react-icons/ri'

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

interface NotificationBellProps {
    className?: string
}

export function NotificationBell({ className = '' }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { player } = useAuthStore()
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()

    return (
        <div className={`relative ${className}`}>
            {/* Bell button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative text-moon-400 hover:text-candle-400 transition-colors text-xl"
            >
                <RiBellFill />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-blood-500 text-parchment-50 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center font-cinzel">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Notification panel */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    {/* Panel */}
                    <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-night-800 border border-night-600 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-night-700">
                            <h3 className="font-cinzel text-parchment-100 text-sm font-semibold tracking-wider">
                                Notifications
                            </h3>
                            {unreadCount > 0 && player && (
                                <button
                                    onClick={() => markAllAsRead(player.id)}
                                    className="text-candle-400 text-xs hover:text-candle-500 transition-colors font-crimson"
                                >
                                    Tout marquer lu
                                </button>
                            )}
                        </div>

                        {/* List */}
                        <div className="overflow-y-auto max-h-80">
                            {notifications.length === 0 ? (
                                <p className="text-moon-400/50 text-sm text-center py-8 font-crimson italic">
                                    Aucune notification
                                </p>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        onClick={() => { if (!n.read) markAsRead(n.id) }}
                                        className={`p-3 border-b border-night-700/50 cursor-pointer transition-colors hover:bg-night-700/30 ${!n.read ? 'bg-night-700/20' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-base flex-shrink-0 mt-0.5">{typeIcons[n.type] ?? <RiMegaphoneFill />}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-cinzel text-parchment-100 text-xs font-semibold tracking-wide truncate">
                                                        {n.title}
                                                    </p>
                                                    {!n.read && (
                                                        <div className="w-2 h-2 rounded-full bg-candle-400 flex-shrink-0" />
                                                    )}
                                                </div>
                                                <p className="font-crimson text-moon-400 text-xs mt-0.5">{n.message}</p>
                                                <p className="font-crimson text-moon-400/50 text-xs mt-1">
                                                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
