import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useChallengeStore } from '../../stores/challengeStore'

const statusLabels: Record<string, string> = {
    upcoming: '⏳ À venir',
    active: '🟢 En cours',
    completed: '✅ Terminé',
}

export function GMChallengesPage() {
    const { challenges, subscribeToAll } = useChallengeStore()

    useEffect(() => {
        const unsub = subscribeToAll()
        return unsub
    }, [])

    const beerPong = challenges.find(c => c.type === 'beer_pong')
    const pubCrawl = challenges.find(c => c.type === 'pub_crawl')
    const madScientists = challenges.find(c => c.type === 'mad_scientists')

    return (
        <div className="min-h-screen bg-village-night p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🎮 Challenges (MJ)</h1>
                    <Link to="/gm" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Dashboard</Link>
                </div>

                <div className="space-y-4">
                    <Link
                        to="/gm/challenges/beer-pong"
                        className="block bg-parchment-card rounded-xl p-4 backdrop-blur-sm hover:bg-night-700/30 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🍺</span>
                                <div>
                                    <p className="font-cinzel text-parchment-100 font-semibold text-sm">Beer Pong</p>
                                    <p className="font-crimson text-moon-400/60 text-xs">Tournoi en duo — Vendredi</p>
                                </div>
                            </div>
                            <span className="font-crimson text-xs text-moon-400">
                                {beerPong ? statusLabels[beerPong.status] : 'Non créé'}
                            </span>
                        </div>
                    </Link>

                    <Link
                        to="/gm/challenges/pub-crawl"
                        className="block bg-parchment-card rounded-xl p-4 backdrop-blur-sm hover:bg-night-700/30 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🍻</span>
                                <div>
                                    <p className="font-cinzel text-parchment-100 font-semibold text-sm">Pub Crawl</p>
                                    <p className="font-crimson text-moon-400/60 text-xs">Barathon — Samedi</p>
                                </div>
                            </div>
                            <span className="font-crimson text-xs text-moon-400">
                                {pubCrawl ? statusLabels[pubCrawl.status] : 'Non créé'}
                            </span>
                        </div>
                    </Link>

                    <Link
                        to="/gm/challenges/mad-scientists"
                        className="block bg-parchment-card rounded-xl p-4 backdrop-blur-sm hover:bg-night-700/30 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">🧪</span>
                                <div>
                                    <p className="font-cinzel text-parchment-100 font-semibold text-sm">Savants Fous</p>
                                    <p className="font-crimson text-moon-400/60 text-xs">Savants vs Citoyens — Dimanche</p>
                                </div>
                            </div>
                            <span className="font-crimson text-xs text-moon-400">
                                {madScientists ? statusLabels[madScientists.status] : 'Non créé'}
                            </span>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}
