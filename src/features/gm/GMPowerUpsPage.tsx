import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import type { PowerUp } from '../../types/supabase'

export function GMPowerUpsPage() {
  const { players } = useRealtimePlayers()
  const [powerUps, setPowerUps] = useState<PowerUp[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [grantPlayerId, setGrantPlayerId] = useState('')
  const [grantType, setGrantType] = useState<'shield' | 'clairvoyance'>('shield')
  const [isGranting, setIsGranting] = useState(false)

  useEffect(() => {
    fetchPowerUps()
    const channel = supabase
      .channel('gm_power_ups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'power_ups' }, () => {
        fetchPowerUps()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchPowerUps() {
    const { data } = await supabase
      .from('power_ups')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      console.log('Fetched power-ups:', data)
      setPowerUps(data as PowerUp[])
    }
    setIsLoading(false)
  }

  function getPlayerName(id: string): string {
    return players.find(p => p.id === id)?.name ?? 'Inconnu'
  }

  // Pending clairvoyance requests (used but no result yet in metadata)
  const pendingClairvoyances = powerUps.filter(
    p => p.type === 'clairvoyance' && p.used && !(p.metadata as Record<string, unknown>)?.result
  )

  // Pending shield checks — the GM sees power-ups that exist and aren't used yet
  const activeShields = powerUps.filter(p => p.type === 'shield' && !p.used)

  async function handleConfirmClairvoyance(powerUp: PowerUp) {
    if (!powerUp.used_on) return
    // Fetch the target's role
    const target = players.find(p => p.id === powerUp.used_on)
    if (!target || !target.role) return

    // Update metadata with the result
    await supabase
      .from('power_ups')
      .update({
        metadata: { result: target.role, target_name: target.name },
        granted_by_gm: true,
      })
      .eq('id', powerUp.id)

    // Send notification to the player
    const roleLabel = target.role === 'werewolf' ? '🐺 Loup-Garou' : '🏘️ Villageois'
    await supabase.from('notifications').insert({
      player_id: powerUp.player_id,
      type: 'clairvoyance_result' as const,
      title: 'Résultat de clairvoyance',
      message: `${target.name} est ${roleLabel}`,
    })
  }

  async function handleRejectClairvoyance(powerUp: PowerUp) {
    // Reset the power-up
    await supabase
      .from('power_ups')
      .update({ used: false, used_at: null, used_on: null })
      .eq('id', powerUp.id)

    await supabase.from('notifications').insert({
      player_id: powerUp.player_id,
      type: 'generic' as const,
      title: 'Clairvoyance bloquée',
      message: 'Ta clairvoyance a été rejetée par le MJ.',
    })
  }

  async function handleGrantPowerUp() {
    if (!grantPlayerId) return
    setIsGranting(true)

    await supabase.from('power_ups').insert({
      player_id: grantPlayerId,
      type: grantType,
      source: 'manual' as const,
      granted_by_gm: true,
    })

    const typeLabel = grantType === 'shield' ? '🛡️ Bouclier' : '🔮 Clairvoyance'
    await supabase.from('notifications').insert({
      player_id: grantPlayerId,
      type: grantType === 'shield' ? 'shield_gained' as const : 'clairvoyance_gained' as const,
      title: `${typeLabel} obtenu !`,
      message: `Le MJ t'a donné un ${typeLabel.toLowerCase()}.`,
    })

    setGrantPlayerId('')
    setIsGranting(false)
  }

  // Shield: when GM wants to apply a shield for a player
  async function handleApplyShield(powerUp: PowerUp) {
    await supabase
      .from('power_ups')
      .update({ used: true, used_at: new Date().toISOString(), granted_by_gm: true })
      .eq('id', powerUp.id)

    await supabase.from('notifications').insert({
      player_id: powerUp.player_id,
      type: 'shield_gained' as const,
      title: 'Bouclier activé !',
      message: 'Ton bouclier t\'a protégé ! Tu survis ce tour.',
    })
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
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
            ⚡ Power-ups
          </h1>
          <Link to="/gm" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Dashboard</Link>
        </div>

        {/* Grant power-up */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
            Donner un power-up
          </h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="font-crimson text-moon-400 text-xs block mb-1">Joueur</label>
              <select
                value={grantPlayerId}
                onChange={e => setGrantPlayerId(e.target.value)}
                className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
              >
                <option value="">Choisir...</option>
                {players.filter(p => p.status === 'alive').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-crimson text-moon-400 text-xs block mb-1">Type</label>
              <select
                value={grantType}
                onChange={e => setGrantType(e.target.value as 'shield' | 'clairvoyance')}
                className="bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
              >
                <option value="shield">🛡️ Bouclier</option>
                <option value="clairvoyance">🔮 Clairvoyance</option>
              </select>
            </div>
            <button
              onClick={handleGrantPowerUp}
              disabled={!grantPlayerId || isGranting}
              className="bg-candle-500 text-night-950 px-4 py-2 rounded-lg font-cinzel font-semibold hover:bg-candle-400 transition-colors disabled:opacity-40"
            >
              Donner
            </button>
          </div>
        </div>

        {/* Pending Clairvoyance Requests */}
        {pendingClairvoyances.length > 0 && (
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-6">
            <h2 className="font-cinzel text-purple-300 font-semibold text-sm tracking-wider uppercase mb-3">
              🔮 Clairvoyances en attente
            </h2>
            <div className="space-y-3">
              {pendingClairvoyances.map(p => (
                <div key={p.id} className="bg-night-800/50 border border-night-600/30 rounded-lg p-3">
                  <p className="font-crimson text-parchment-200 text-sm mb-2">
                    <strong>{getPlayerName(p.player_id)}</strong> veut utiliser la clairvoyance sur{' '}
                    <strong>{p.used_on ? getPlayerName(p.used_on) : '?'}</strong>
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmClairvoyance(p)}
                      className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-cinzel hover:bg-purple-500 transition-colors"
                    >
                      ✅ Confirmer
                    </button>
                    <button
                      onClick={() => handleRejectClairvoyance(p)}
                      className="bg-night-700 text-moon-400 px-3 py-1.5 rounded-lg text-xs font-crimson hover:bg-night-600 transition-colors border border-night-600"
                    >
                      ❌ Rejeter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Shields */}
        {activeShields.length > 0 && (
          <div className="bg-candle-600/10 border border-candle-500/20 rounded-xl p-4 mb-6">
            <h2 className="font-cinzel text-candle-400 font-semibold text-sm tracking-wider uppercase mb-3">
              🛡️ Boucliers actifs
            </h2>
            <div className="space-y-2">
              {activeShields.map(s => (
                <div key={s.id} className="bg-night-800/50 border border-night-600/30 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-crimson text-parchment-200 text-sm">
                      <strong>{getPlayerName(s.player_id)}</strong>
                    </p>
                    <p className="font-crimson text-moon-400/60 text-xs">Source : {s.source}</p>
                  </div>
                  <button
                    onClick={() => handleApplyShield(s)}
                    className="bg-candle-500 text-night-950 px-3 py-1.5 rounded-lg text-xs font-cinzel hover:bg-candle-400 transition-colors"
                  >
                    Activer le bouclier
                  </button>
                </div>
              ))}
            </div>
            <p className="font-crimson text-moon-400/40 text-xs mt-2 italic">
              Active un bouclier lorsqu'un joueur est ciblé pour l'élimination.
            </p>
          </div>
        )}

        {/* All power-ups history */}
        <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
            Historique ({powerUps.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {powerUps.map(p => (
              <div key={p.id} className={`p-2.5 bg-night-800/50 border border-night-700/30 rounded-lg flex items-center justify-between ${p.used ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <span>{p.type === 'shield' ? '🛡️' : '🔮'}</span>
                  <div>
                    <p className="font-crimson text-parchment-200 text-sm">{getPlayerName(p.player_id)}</p>
                    <p className="font-crimson text-moon-400/50 text-xs">{p.source} — {p.used ? 'utilisé' : 'actif'}</p>
                  </div>
                </div>
              </div>
            ))}
            {powerUps.length === 0 && (
              <p className="text-moon-400/50 text-sm font-crimson italic text-center py-4">Aucun power-up distribué.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
