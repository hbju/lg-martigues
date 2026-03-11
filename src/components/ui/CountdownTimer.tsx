import { useEffect, useState } from 'react'
import { differenceInSeconds } from 'date-fns'

interface CountdownTimerProps {
    endTime: Date
    onExpire?: () => void
}

export function CountdownTimer({ endTime, onExpire }: CountdownTimerProps) {
    const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, differenceInSeconds(endTime, new Date())))

    useEffect(() => {
        const tick = () => {
            const remaining = Math.max(0, differenceInSeconds(endTime, new Date()))
            setSecondsLeft(remaining)

            if (remaining <= 0) {
                onExpire?.()
                return
            }

            frameId = requestAnimationFrame(tick)
        }

        let frameId = requestAnimationFrame(tick)

        // Also use setInterval as a fallback for inactive tabs
        const interval = setInterval(() => {
            const remaining = Math.max(0, differenceInSeconds(endTime, new Date()))
            setSecondsLeft(remaining)
            if (remaining <= 0) {
                onExpire?.()
            }
        }, 1000)

        return () => {
            cancelAnimationFrame(frameId)
            clearInterval(interval)
        }
    }, [endTime, onExpire])

    const minutes = Math.floor(secondsLeft / 60)
    const seconds = secondsLeft % 60

    const isUrgent = secondsLeft <= 60
    const isCritical = secondsLeft <= 10

    return (
        <div
            className={`font-cinzel text-3xl font-bold tabular-nums transition-colors ${isCritical
                    ? 'text-red-500 animate-pulse'
                    : isUrgent
                        ? 'text-red-400'
                        : 'text-candle-400'
                }`}
        >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
    )
}
