import { useConnectionStatus } from '../../hooks/useConnectionStatus'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export function ConnectionBanner() {
  const { status, lastOnline } = useConnectionStatus()

  if (status === 'online') return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] text-center py-2 px-4 text-sm font-crimson transition-all ${status === 'reconnecting'
        ? 'bg-yellow-900/90 text-yellow-200 animate-pulse'
        : 'bg-red-900/90 text-red-200'
        }`}
    >
      {status === 'reconnecting' ? (
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" /> Reconnexion en cours...</span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Hors ligne — Dernière mise à jour{' '}
          {formatDistanceToNow(lastOnline, { addSuffix: true, locale: fr })}
        </span>
      )}
    </div>
  )
}
