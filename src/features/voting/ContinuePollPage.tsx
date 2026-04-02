import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import { useGameStore } from '../../stores/gameStore'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import { motion } from 'framer-motion'
import type { VoteRound, Vote } from '../../types/supabase'
import { GiWolfHead, GiStopSign } from 'react-icons/gi'
import { RiSearchLine, RiCheckboxCircleFill, RiQuestionFill } from 'react-icons/ri'

export function ContinuePollPage() {
  const { player } = useAuthStore()
  const { gameState, subscribeToGameState } = useGameStore()
  const navigate = useNavigate()
  const [pollRound, setPollRound] = useState<VoteRound | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<'continue' | 'stop' | null>(null)

  useEffect(() => {
    const unsub = subscribeToGameState()
    return unsub
  }, [])

  useEffect(() => {
    fetchPoll()
    const channel = supabase
      .channel('continue_poll_watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vote_rounds' }, () => {
        fetchPoll()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Redirect to final reveal when game ends
  useEffect(() => {
    if (gameState?.phase === 'finished') {
      navigate('/reveal/final', { replace: true })
    }
  }, [gameState?.phase])

  async function fetchPoll() {
    const { data } = await supabase
      .from('vote_rounds')
      .select('*')
      .eq('type', 'final')
      .order('created_at', { ascending: false })
      .limit(1)

    const round = (data?.[0] ?? null) as VoteRound | null
    setPollRound(round)

    if (round && round.metadata?.subtype === 'continue_poll') {
      // Check if current player already voted
      if (player) {
        const { data: votes } = await supabase
          .from('votes')
          .select('*')
          .eq('round_id', round.id)
          .eq('voter_id', player.id)

        setHasVoted((votes?.length ?? 0) > 0)
      }

      // Check result if resolved
      if (round.status === 'resolved') {
        const { data: allVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('round_id', round.id) as { data: Vote[] | null }

        if (allVotes) {
          // target_id used as a "continue" sentinel or "stop" sentinel
          const continueVotes = allVotes.filter(v => (v.metadata as Record<string, unknown>)?.choice === 'continue' || v.target_id === v.voter_id).length
          const stopVotes = allVotes.length - continueVotes
          setResult(continueVotes > stopVotes ? 'continue' : 'stop')
        }
      }
    }
  }

  async function handleVote(choice: 'continue' | 'stop') {
    if (!player || !pollRound || hasVoted) return
    setIsSubmitting(true)

    // We use the voter's own ID as target for "continue", and a sentinel for "stop"
    // This is encoded in metadata
    await supabase.from('votes').insert({
      round_id: pollRound.id,
      voter_id: player.id,
      target_id: player.id, // Self-reference (required field)
      metadata: { choice },
    })

    setHasVoted(true)
    setIsSubmitting(false)
  }

  if (!player) return null

  // Show result
  if (pollRound?.status === 'resolved' && result) {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-5xl mb-4">
            {result === 'continue' ? <RiSearchLine /> : <GiStopSign />}
          </div>
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-3">
            {result === 'continue'
              ? 'La chasse continue !'
              : 'Le village a décidé de s\'arrêter.'
            }
          </h1>
          <p className="font-crimson text-moon-400 italic">
            {result === 'continue'
              ? 'Le groupe pense qu\'il reste des loups parmi vous...'
              : 'Les masques vont tomber...'
            }
          </p>
        </motion.div>
      </div>
    )
  }

  // No active poll
  if (!pollRound || pollRound.metadata?.subtype !== 'continue_poll' || pollRound.status !== 'open') {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <p className="font-cinzel text-parchment-200 text-xl">Aucun sondage en cours</p>
        <p className="font-crimson text-moon-400 italic mt-2">
          Attends le Maître du Jeu.
        </p>
      </div>
    )
  }

  // Already voted
  if (hasVoted) {
    return (
      <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
        <div className="text-4xl mb-4"><RiCheckboxCircleFill /></div>
        <p className="font-cinzel text-parchment-200 text-xl mb-2">Vote enregistré</p>
        <p className="font-crimson text-moon-400 italic">En attente du résultat...</p>
        {pollRound.timer_end_at && (
          <div className="mt-4">
            <CountdownTimer endTime={new Date(pollRound.timer_end_at)} />
          </div>
        )}
      </div>
    )
  }

  // Voting UI
  return (
    <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="text-4xl mb-4"><GiWolfHead className="inline" /><RiQuestionFill className="inline" /></div>
        <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-3">
          Pensez-vous qu'il reste des Loups&nbsp;?
        </h1>
        <p className="font-crimson text-moon-400 italic mb-8">
          Votez pour continuer l'élimination ou arrêter et révéler les rôles.
        </p>

        {pollRound.timer_end_at && (
          <div className="mb-8">
            <CountdownTimer endTime={new Date(pollRound.timer_end_at)} />
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => handleVote('continue')}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-b from-blood-500 to-blood-700 hover:from-blood-500/90 hover:to-blood-600 disabled:opacity-50 text-parchment-100 font-cinzel font-semibold py-4 rounded-xl transition-all shadow-lg shadow-blood-700/30 text-lg"
          >
            <RiSearchLine className="inline" /> Continuer la chasse
          </button>
          <button
            onClick={() => handleVote('stop')}
            disabled={isSubmitting}
            className="w-full bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 disabled:opacity-50 text-night-950 font-cinzel font-semibold py-4 rounded-xl transition-all shadow-lg shadow-candle-500/20 text-lg"
          >
            <GiStopSign className="inline" /> Nous sommes en sécurité
          </button>
        </div>
      </motion.div>
    </div>
  )
}
