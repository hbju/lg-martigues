import { Component, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { GiWolfHead } from 'react-icons/gi'
import { RiRefreshLine } from 'react-icons/ri'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const playerId = localStorage.getItem('lg_player_id')
    supabase.from('error_logs').insert({
      player_id: playerId,
      error_message: error.message,
      error_stack: error.stack ?? errorInfo.componentStack ?? null,
      url: window.location.href,
    }).then(() => {/* fire and forget */ })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-night-950 flex flex-col items-center justify-center p-6">
          <div className="flex justify-center text-6xl mb-6"><GiWolfHead className="inline text-6xl" /></div>
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-3">
            Quelque chose s'est mal passé
          </h1>
          <p className="font-crimson text-moon-400 italic text-center mb-8 max-w-sm">
            Une erreur inattendue est survenue. Appuie sur le bouton pour recharger.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3 px-8 rounded-lg transition-all shadow-lg shadow-candle-500/20"
          >
            <RiRefreshLine className="inline" /> Recharger
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
