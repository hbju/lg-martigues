import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { usePowerUpStore } from '../../stores/powerUpStore'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import { supabase } from '../../lib/supabase'
import { NotificationBell } from '../../components/ui/NotificationBell'
import type { PowerUp, Player } from '../../types/supabase'

const sourceLabels: Record<string, string> = {
  qr: 'Trouvé via QR',
  challenge: 'Gagné en challenge',
  meme: 'Mème gagnant',
  manual: 'Donné par le MJ',
}

export function InventoryPage() {
  const { player } = useAuthStore()
  const { powerUps, subscribe } = usePowerUpStore()
  const { players } = useRealtimePlayers()
  const navigate = useNavigate()
  const [showClairvoyanceModal, setShowClairvoyanceModal] = useState(false)
  const [selectedPowerUp, setSelectedPowerUp] = useState<PowerUp | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<Player | null>(null)
  const [isUsing, setIsUsing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!player) return
    const unsub = subscribe(player.id)
    return unsub
  }, [player?.id])

  console.log('Power-ups:', powerUps)
  const shields = powerUps.filter(p => p.type === 'shield')
  const clairvoyances = powerUps.filter(p => p.type === 'clairvoyance')
  const unusedShields = shields.filter(p => !p.used)
  const unusedClairvoyances = clairvoyances.filter(p => !p.used)
  const alivePlayers = players.filter(p => p.status === 'alive' && p.id !== player?.id)

  async function handleUseClairvoyance(powerUp: PowerUp) {
    setSelectedPowerUp(powerUp)
    setShowClairvoyanceModal(true)
    setSelectedTarget(null)
  }

  async function confirmClairvoyance() {
    if (!selectedPowerUp || !selectedTarget || !player) return
    setIsUsing(true)

    // Mark the power-up as used
    const { error } = await supabase
      .from('power_ups')
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_on: selectedTarget.id,
      })
      .eq('id', selectedPowerUp.id)

    if (error) {
      setMessage('Erreur lors de l\'utilisation.')
      setIsUsing(false)
      return
    }

    // Notify GM for confirmation
    await supabase.from('notifications').insert({
      player_id: player.id,
      type: 'power_up_used' as const,
      title: 'Clairvoyance utilisée',
      message: `En attente de confirmation du MJ pour révéler le rôle de ${selectedTarget.name}...`,
    })

    setMessage(`Demande envoyée au MJ pour révéler le rôle de ${selectedTarget.name}. Patiente...`)
    setIsUsing(false)
    setShowClairvoyanceModal(false)
    setSelectedPowerUp(null)
    setSelectedTarget(null)
  }

  if (!player) return null

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
              Inventaire
            </h1>
            <p className="font-crimson text-moon-400 text-sm italic">Tes objets magiques</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={() => navigate('/home')}
              className="text-moon-400 hover:text-parchment-200 transition-colors font-crimson text-sm"
            >
              ← Retour
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-candle-600/20 border border-candle-500/30 rounded-xl p-4 mb-6">
            <p className="font-crimson text-candle-400 text-sm">{message}</p>
            <button onClick={() => setMessage(null)} className="text-moon-400 text-xs mt-2 hover:text-parchment-200">
              Fermer
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-parchment-card rounded-xl p-4 text-center backdrop-blur-sm">
            <p className="text-3xl mb-1">🛡️</p>
            <p className="text-2xl font-bold text-candle-400 font-cinzel">{unusedShields.length}</p>
            <p className="font-crimson text-moon-400 text-sm">Boucliers</p>
          </div>
          <div className="bg-parchment-card rounded-xl p-4 text-center backdrop-blur-sm">
            <p className="text-3xl mb-1">🔮</p>
            <p className="text-2xl font-bold text-purple-400 font-cinzel">{unusedClairvoyances.length}</p>
            <p className="font-crimson text-moon-400 text-sm">Clairvoyances</p>
          </div>
        </div>

        {/* Shields section */}
        <div className="mb-6">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
            🛡️ Boucliers
          </h2>
          {shields.length === 0 ? (
            <p className="font-crimson text-moon-400/50 text-sm italic">Aucun bouclier. Scanne un QR ou gagne un challenge !</p>
          ) : (
            <div className="space-y-2">
              {shields.map(s => (
                <div key={s.id} className={`bg-parchment-card rounded-lg p-3 backdrop-blur-sm flex items-center justify-between ${s.used ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🛡️</span>
                    <div>
                      <p className="font-cinzel text-parchment-100 text-sm">Bouclier</p>
                      <p className="font-crimson text-moon-400/60 text-xs">{sourceLabels[s.source] ?? s.source}</p>
                    </div>
                  </div>
                  {s.used ? (
                    <span className="text-xs font-crimson text-moon-400/40 italic">Utilisé</span>
                  ) : (
                    <span className="text-xs font-crimson text-candle-400">Actif — Protection auto</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="font-crimson text-moon-400/40 text-xs mt-2 italic">
            Les boucliers sont activés automatiquement par le MJ si tu es ciblé.
          </p>
        </div>

        {/* Clairvoyance section */}
        <div className="mb-6">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
            🔮 Clairvoyances
          </h2>
          {clairvoyances.length === 0 ? (
            <p className="font-crimson text-moon-400/50 text-sm italic">Aucune clairvoyance. Scanne un QR ou gagne un challenge !</p>
          ) : (
            <div className="space-y-2">
              {clairvoyances.map(c => (
                <div key={c.id} className={`bg-parchment-card rounded-lg p-3 backdrop-blur-sm flex items-center justify-between ${c.used ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔮</span>
                    <div>
                      <p className="font-cinzel text-parchment-100 text-sm">Clairvoyance</p>
                      <p className="font-crimson text-moon-400/60 text-xs">{sourceLabels[c.source] ?? c.source}</p>
                      {c.used && c.metadata && (c.metadata as Record<string, string>).result && (
                        <p className={`font-crimson text-xs mt-0.5 font-semibold ${(c.metadata as Record<string, string>).result === 'werewolf' ? 'text-red-400' : 'text-candle-400'}`}>
                          Résultat : {(c.metadata as Record<string, string>).result === 'werewolf' ? '🐺 Loup-Garou' : '🏘️ Villageois'}
                        </p>
                      )}
                    </div>
                  </div>
                  {c.used ? (
                    <span className="text-xs font-crimson text-moon-400/40 italic">Utilisée</span>
                  ) : (
                    <button
                      onClick={() => handleUseClairvoyance(c)}
                      disabled={player.status !== 'alive'}
                      className="bg-purple-600/20 border border-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg text-xs font-cinzel hover:bg-purple-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Utiliser
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clairvoyance Modal */}
        {showClairvoyanceModal && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowClairvoyanceModal(false)} />
            <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-night-800 border border-night-600 rounded-xl p-5 z-50 max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
              <h3 className="font-cinzel text-parchment-100 font-semibold tracking-wider mb-4">
                🔮 Choisir une cible
              </h3>
              <p className="font-crimson text-moon-400 text-sm mb-4 italic">
                Sélectionne un joueur pour révéler son rôle.
              </p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedTarget(p)}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${selectedTarget?.id === p.id
                      ? 'bg-purple-600/20 border-purple-500/40 text-purple-200'
                      : 'bg-night-700/50 border-night-600/30 text-parchment-200 hover:bg-night-700'
                      }`}
                  >
                    <span className="font-crimson">{p.name}</span>
                  </button>
                ))}
              </div>
              {selectedTarget && (
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3 mb-4">
                  <p className="font-crimson text-purple-200 text-sm">
                    Révéler le rôle de <strong>{selectedTarget.name}</strong> ?
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClairvoyanceModal(false)}
                  className="flex-1 bg-night-700 border border-night-600 text-moon-400 py-2 rounded-lg font-crimson hover:bg-night-600 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmClairvoyance}
                  disabled={!selectedTarget || isUsing}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-cinzel font-semibold hover:bg-purple-500 transition-colors disabled:opacity-40"
                >
                  {isUsing ? '...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
