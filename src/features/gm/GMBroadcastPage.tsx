import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'

type TargetGroup = 'all' | 'alive' | 'ghosts'

export function GMBroadcastPage() {
    const { players } = useRealtimePlayers()
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [targetGroup, setTargetGroup] = useState<TargetGroup>('all')
    const [specificPlayerId, setSpecificPlayerId] = useState<string>('')
    const [isSending, setIsSending] = useState(false)
    const [sent, setSent] = useState(false)

    async function handleSend() {
        if (!title.trim() || !message.trim()) return
        setIsSending(true)

        let targets = players.filter(p => !p.is_gm)

        if (specificPlayerId) {
            targets = targets.filter(p => p.id === specificPlayerId)
        } else if (targetGroup === 'alive') {
            targets = targets.filter(p => p.status === 'alive')
        } else if (targetGroup === 'ghosts') {
            targets = targets.filter(p => p.status === 'ghost')
        }

        const notifs = targets.map(p => ({
            player_id: p.id,
            type: 'generic' as const,
            title: title.trim(),
            message: message.trim(),
        }))

        if (notifs.length > 0) {
            await supabase.from('notifications').insert(notifs)
        }

        setSent(true)
        setTitle('')
        setMessage('')
        setSpecificPlayerId('')
        setIsSending(false)

        setTimeout(() => setSent(false), 3000)
    }

    return (
        <div className="min-h-screen bg-village-night p-6">
            <div className="max-w-2xl mx-auto">
                <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-6">
                    📢 Annonce
                </h1>

                <div className="bg-parchment-card rounded-xl p-5 backdrop-blur-sm">
                    <div className="space-y-4">
                        <div>
                            <label className="font-crimson text-moon-400 text-sm block mb-1">Titre</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Ex: Petit-déjeuner !"
                                className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson placeholder:text-night-600"
                            />
                        </div>

                        <div>
                            <label className="font-crimson text-moon-400 text-sm block mb-1">Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Ex: Rendez-vous à la cuisine dans 10 minutes !"
                                rows={3}
                                className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson placeholder:text-night-600 resize-none"
                            />
                        </div>

                        <div>
                            <label className="font-crimson text-moon-400 text-sm block mb-2">Destinataires</label>
                            <div className="flex gap-2 flex-wrap">
                                {(['all', 'alive', 'ghosts'] as const).map(group => (
                                    <button
                                        key={group}
                                        onClick={() => { setTargetGroup(group); setSpecificPlayerId('') }}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-crimson transition-colors border ${targetGroup === group && !specificPlayerId
                                                ? 'bg-candle-500/20 border-candle-500/50 text-candle-400'
                                                : 'bg-night-800 border-night-600 text-moon-400 hover:bg-night-700'
                                            }`}
                                    >
                                        {group === 'all' ? '👥 Tous' : group === 'alive' ? '❤️ Vivants' : '👻 Fantômes'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="font-crimson text-moon-400 text-sm block mb-1">Ou un joueur spécifique</label>
                            <select
                                value={specificPlayerId}
                                onChange={(e) => setSpecificPlayerId(e.target.value)}
                                className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
                            >
                                <option value="">— Aucun (utiliser le groupe) —</option>
                                {players.filter(p => !p.is_gm).map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
                                ))}
                            </select>
                        </div>

                        {sent && (
                            <div className="bg-forest-800/30 border border-green-700/30 rounded-lg p-3 text-center">
                                <p className="text-green-400 font-crimson text-sm">✅ Annonce envoyée !</p>
                            </div>
                        )}

                        <button
                            onClick={handleSend}
                            disabled={isSending || !title.trim() || !message.trim()}
                            className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 disabled:from-night-700 disabled:to-night-700 disabled:text-night-600 text-night-950 font-cinzel font-semibold py-3 rounded-lg transition-all shadow-lg shadow-candle-500/20"
                        >
                            {isSending ? 'Envoi...' : '📢 Envoyer l\'annonce'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
