import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import type { Player } from '../../types/supabase'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export function GMQRCodesPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchPlayers()
  }, [])

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('is_gm', false)
      .order('name')
      .returns<Player[]>()

    if (data) setPlayers(data)
    setIsLoading(false)
  }

  async function regenerateToken(playerId: string) {
    const newToken = crypto.randomUUID().slice(0, 12)
    await supabase
      .from('players')
      .update({ auth_token: newToken })
      .eq('id', playerId)

    fetchPlayers()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-village-night flex items-center justify-center">
        <div className="animate-candle text-candle-400 font-cinzel">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">QR Codes</h1>
          <button
            onClick={() => window.print()}
            className="bg-night-700 hover:bg-night-600 text-parchment-200 py-2 px-4 rounded-lg transition-colors print:hidden font-crimson border border-night-600"
          >
            🖨️ Imprimer
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3">
          {players.map((player) => {
            const loginUrl = `${APP_URL}/login?token=${encodeURIComponent(player.auth_token)}`
            return (
              <div
                key={player.id}
                className="bg-parchment-50 rounded-xl p-5 flex flex-col items-center gap-3 print:break-inside-avoid border-2 border-parchment-200"
              >
                <QRCodeSVG value={loginUrl} size={180} level="M" />
                <div className="h-px w-full bg-parchment-200" />
                <p className="text-night-950 font-cinzel font-bold text-lg tracking-wide">{player.name}</p>
                <p className="text-parchment-300 text-xs font-mono truncate max-w-full">
                  {player.auth_token}
                </p>
                <button
                  onClick={() => regenerateToken(player.id)}
                  className="text-blood-500 hover:text-blood-600 text-sm print:hidden transition-colors font-crimson"
                >
                  🔄 Régénérer
                </button>
              </div>
            )
          })}
        </div>

        {players.length === 0 && (
          <div className="text-center text-moon-400 mt-12 font-crimson">
            <p className="italic">Aucun joueur trouvé.</p>
            <p className="text-sm mt-1">Ajoute des joueurs depuis le dashboard MJ.</p>
          </div>
        )}
      </div>
    </div>
  )
}
