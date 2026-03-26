interface LeaderboardEntry {
  playerId: string
  playerName: string
  score: number
}

interface LeaderboardProps {
  scores: LeaderboardEntry[]
  title?: string
  currentPlayerId?: string
  className?: string
}

export function Leaderboard({ scores, title = 'Classement', currentPlayerId, className = '' }: LeaderboardProps) {
  return (
    <div className={`bg-parchment-card rounded-xl p-4 backdrop-blur-sm ${className}`}>
      <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
        {title}
      </h2>
      <div className="space-y-2">
        {scores.map((entry, idx) => {
          const isMe = entry.playerId === currentPlayerId
          const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`
          return (
            <div
              key={entry.playerId}
              className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${isMe
                  ? 'bg-candle-600/10 border-candle-500/30'
                  : 'bg-night-800/50 border-night-700/30'
                }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base w-8 text-center font-cinzel">{rankEmoji}</span>
                <span className={`font-crimson text-sm ${isMe ? 'text-candle-400 font-semibold' : 'text-parchment-200'}`}>
                  {entry.playerName}
                  {isMe && <span className="ml-1 text-xs italic text-candle-400/70">(toi)</span>}
                </span>
              </div>
              <span className="font-cinzel text-candle-400 font-bold">{entry.score}</span>
            </div>
          )
        })}
        {scores.length === 0 && (
          <p className="text-moon-400/50 text-sm font-crimson italic text-center py-4">
            Aucun score pour le moment.
          </p>
        )}
      </div>
    </div>
  )
}
