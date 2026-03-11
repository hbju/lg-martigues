import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { useAuthStore } from '../../stores/authStore'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, player, isLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Auto-authenticate if token is in URL
  useEffect(() => {
    const token = searchParams.get('token')
    if (token && !player && !isLoggingIn) {
      handleLogin(token)
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    if (player && !isLoading) {
      navigate('/lobby', { replace: true })
    }
  }, [player, isLoading])

  // QR Scanner
  useEffect(() => {
    if (!showScanner) return

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    )

    scanner.render(
      (decodedText) => {
        scanner.clear()
        setShowScanner(false)
        // Extract token from URL
        try {
          const url = new URL(decodedText)
          const token = url.searchParams.get('token')
          if (token) {
            handleLogin(token)
          } else {
            setError('QR code invalide.')
          }
        } catch {
          // If not a URL, try as raw token
          handleLogin(decodedText)
        }
      },
      () => {
        // Scan error — ignore, scanner keeps trying
      }
    )

    return () => {
      scanner.clear().catch(() => { })
    }
  }, [showScanner])

  async function handleLogin(token: string) {
    setIsLoggingIn(true)
    setError(null)
    const result = await login(token)
    if (!result.success) {
      setError(result.error ?? 'Erreur inconnue')
    }
    setIsLoggingIn(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-village-night flex items-center justify-center">
        <div className="animate-candle text-candle-400 font-cinzel text-lg">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative stars */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-1 h-1 bg-parchment-200 rounded-full opacity-40" style={{ animation: 'twinkle 3s ease-in-out infinite' }} />
        <div className="absolute top-[5%] right-[20%] w-1.5 h-1.5 bg-parchment-100 rounded-full opacity-30" style={{ animation: 'twinkle 4s ease-in-out 1s infinite' }} />
        <div className="absolute top-[15%] left-[60%] w-1 h-1 bg-moon-200 rounded-full opacity-50" style={{ animation: 'twinkle 5s ease-in-out 2s infinite' }} />
        <div className="absolute top-[8%] left-[40%] w-0.5 h-0.5 bg-parchment-50 rounded-full opacity-40" style={{ animation: 'twinkle 3.5s ease-in-out 0.5s infinite' }} />
        <div className="absolute top-[20%] right-[35%] w-1 h-1 bg-parchment-200 rounded-full opacity-30" style={{ animation: 'twinkle 4.5s ease-in-out 1.5s infinite' }} />
      </div>

      {/* Moon */}
      <div className="absolute top-8 right-8 w-16 h-16 rounded-full bg-gradient-to-br from-moon-200 to-moon-300 opacity-20 moon-glow" />

      <div className="text-center mb-10 relative z-10">
        <div className="text-6xl mb-4 animate-slow-pulse">🐺</div>
        <h1 className="font-cinzel text-3xl font-bold text-parchment-100 tracking-wider">
          Les Loups-Garous
        </h1>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-candle-400/50" />
          <p className="font-crimson text-candle-400 italic text-lg">de Martigues</p>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-candle-400/50" />
        </div>
      </div>

      {isLoggingIn && (
        <div className="text-candle-400 animate-candle font-crimson text-lg mb-4 italic">
          Connexion en cours...
        </div>
      )}

      {error && (
        <div className="bg-blood-800/60 border border-blood-500/50 rounded-lg p-4 mb-6 max-w-sm text-center backdrop-blur-sm">
          <p className="text-red-300 font-crimson">{error}</p>
        </div>
      )}

      {!isLoggingIn && !showScanner && (
        <button
          onClick={() => setShowScanner(true)}
          className="relative bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3.5 px-10 rounded-lg text-lg transition-all shadow-lg shadow-candle-500/20 hover:shadow-candle-400/30"
        >
          Scanner le QR Code
        </button>
      )}

      {showScanner && (
        <div className="w-full max-w-sm relative z-10">
          <div id="qr-reader" className="rounded-lg overflow-hidden border border-night-600" />
          <button
            onClick={() => setShowScanner(false)}
            className="mt-4 w-full text-moon-400 hover:text-parchment-100 py-2 transition-colors font-crimson"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
