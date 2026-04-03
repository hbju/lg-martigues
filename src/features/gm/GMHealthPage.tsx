import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../stores/gameStore'
import type { Player, VoteRound } from '../../types/supabase'
import { GiHealthNormal } from 'react-icons/gi'
import { RiRefreshLine } from 'react-icons/ri'

interface HealthCheck {
  label: string
  status: 'ok' | 'warning' | 'error'
  detail: string
}

export function GMHealthPage() {
  const { fetchGameState } = useGameStore()
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorLogs, setErrorLogs] = useState<Array<{ error_message: string; url: string | null; created_at: string }>>([])

  useEffect(() => {
    fetchGameState()
    runDiagnostics()
  }, [])

  async function runDiagnostics() {
    setIsLoading(true)

    const [pRes, gsRes, vrRes, errRes] = await Promise.all([
      supabase.from('players').select('*').eq('is_gm', false),
      supabase.from('game_state').select('*').eq('id', 1).single(),
      supabase.from('vote_rounds').select('*').eq('status', 'open'),
      supabase.from('error_logs').select('error_message, url, created_at').order('created_at', { ascending: false }).limit(20),
    ])

    const players = (pRes.data ?? []) as Player[]
    const gs = gsRes.data as { werewolf_count: number; villager_count: number } | null
    const openRounds = (vrRes.data ?? []) as VoteRound[]

    if (errRes.data) {
      setErrorLogs(errRes.data as Array<{ error_message: string; url: string | null; created_at: string }>)
    }

    const alive = players.filter(p => p.status === 'alive')
    const ghosts = players.filter(p => p.status === 'ghost')
    const wolves = alive.filter(p => p.role === 'werewolf')
    const villagers = alive.filter(p => p.role === 'villager')

    const results: HealthCheck[] = []

    // Player counts
    results.push({
      label: 'Joueurs',
      status: players.length >= 17 ? 'ok' : 'warning',
      detail: `${players.length} total — ${alive.length} vivants, ${ghosts.length} fantômes`,
    })

    // Role counts vs game_state
    if (gs) {
      const wolfMatch = wolves.length === gs.werewolf_count
      const villagerMatch = villagers.length === gs.villager_count

      results.push({
        label: 'Loups-Garous (sync)',
        status: wolfMatch ? 'ok' : 'error',
        detail: wolfMatch
          ? `${wolves.length} loups (game_state: ${gs.werewolf_count}) ✓`
          : `⚠️ ${wolves.length} loups vivants mais game_state dit ${gs.werewolf_count}`,
      })

      results.push({
        label: 'Villageois (sync)',
        status: villagerMatch ? 'ok' : 'error',
        detail: villagerMatch
          ? `${villagers.length} villageois (game_state: ${gs.villager_count}) ✓`
          : `⚠️ ${villagers.length} villageois vivants mais game_state dit ${gs.villager_count}`,
      })
    }

    // Open vote rounds
    results.push({
      label: 'Rounds de vote ouverts',
      status: openRounds.length <= 1 ? 'ok' : 'error',
      detail: openRounds.length === 0
        ? 'Aucun round ouvert'
        : openRounds.length === 1
          ? `1 round ouvert (${openRounds[0].type})`
          : `⚠️ ${openRounds.length} rounds ouverts simultanément !`,
    })

    // Error logs
    results.push({
      label: 'Erreurs récentes',
      status: (errRes.data?.length ?? 0) === 0 ? 'ok' : 'warning',
      detail: `${errRes.data?.length ?? 0} erreurs dans les logs`,
    })

    setChecks(results)
    setIsLoading(false)
  }

  const statusIcons: Record<string, ReactNode> = {
    ok: <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />,
    warning: <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />,
    error: <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />,
  }

  return (
    <div className="min-h-screen bg-village-night p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">
            <GiHealthNormal className="inline" /> Diagnostic Système
          </h1>
          <Link
            to="/gm"
            className="text-moon-400 hover:text-parchment-200 font-crimson text-sm transition-colors"
          >
            ← Retour
          </Link>
        </div>

        <button
          onClick={runDiagnostics}
          className="w-full bg-night-800 hover:bg-night-700 text-parchment-200 font-crimson py-2 rounded-lg transition-colors border border-night-600 mb-6"
        >
          <RiRefreshLine className="inline" /> Relancer le diagnostic
        </button>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-night-800/50 rounded-xl p-4 animate-pulse h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {checks.map((check, idx) => (
              <div
                key={idx}
                className={`bg-parchment-card rounded-xl p-4 backdrop-blur-sm flex items-start gap-3 ${check.status === 'error' ? 'border border-red-500/40' : ''
                  }`}
              >
                <span className="text-lg flex-shrink-0">{statusIcons[check.status]}</span>
                <div>
                  <p className="font-cinzel text-parchment-100 text-sm font-semibold">
                    {check.label}
                  </p>
                  <p className="font-crimson text-moon-400 text-sm mt-0.5">
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error logs */}
        {errorLogs.length > 0 && (
          <div className="mt-8">
            <h2 className="font-cinzel text-parchment-100 font-semibold mb-3 text-sm tracking-wider uppercase">
              Logs d'erreurs récents
            </h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {errorLogs.map((log, idx) => (
                <div key={idx} className="bg-night-800/50 border border-night-700/30 rounded-lg p-3">
                  <p className="font-crimson text-red-300 text-sm truncate">{log.error_message}</p>
                  <p className="font-crimson text-moon-400/40 text-xs mt-1">
                    {log.url} — {new Date(log.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
