import { useEffect, useState } from 'react'
import { useNotificationStore } from '../../stores/notificationStore'
import { useAuthStore } from '../../stores/authStore'
import { Toast } from '../ui/Toast'
import type { Notification } from '../../types/supabase'

export function ToastContainer() {
    const { player } = useAuthStore()
    const { notifications } = useNotificationStore()
    const [toastQueue, setToastQueue] = useState<Notification[]>([])
    const [lastSeenId, setLastSeenId] = useState<string | null>(null)

    // Watch for new notifications and show toasts
    useEffect(() => {
        if (!player || notifications.length === 0) return

        const latest = notifications[0]
        if (latest && latest.id !== lastSeenId && !latest.read) {
            setLastSeenId(latest.id)
            setToastQueue(prev => [...prev, latest])
        }
    }, [notifications, player, lastSeenId])

    function dismissToast(id: string) {
        setToastQueue(prev => prev.filter(t => t.id !== id))
    }

    // Only show the most recent toast
    const currentToast = toastQueue[toastQueue.length - 1]

    if (!currentToast) return null

    return (
        <Toast
            key={currentToast.id}
            notification={currentToast}
            onDismiss={() => dismissToast(currentToast.id)}
        />
    )
}
