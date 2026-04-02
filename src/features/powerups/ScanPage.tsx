import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { QrCode } from '../../types/supabase'
import { GiCheckedShield, GiCrystalBall } from 'react-icons/gi'
import { RiCameraFill, RiCheckboxCircleFill, RiCloseCircleFill, RiHourglassFill } from 'react-icons/ri'

export function ScanPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { player } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'pending' | 'already_claimed' | 'error' | 'no_code'>('loading')
  const [qrCode, setQrCode] = useState<QrCode | null>(null)
  const [claimerName, setClaimerName] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)

  const code = searchParams.get('code')

  useEffect(() => {
    if (!code) {
      setStatus('no_code')
      return
    }
    if (!player) {
      navigate(`/login?redirect=${encodeURIComponent(`/scan?code=${code}`)}`)
      return
    }
    handleScan(code)
  }, [code, player])

  async function handleScan(scanCode: string) {
    setStatus('loading')

    // Check if this is a login QR (has token param) — redirect gracefully
    if (scanCode.startsWith('token-') || scanCode.includes('login?token=')) {
      navigate('/home')
      return
    }

    // Look up the QR code
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('code', scanCode)
      .single()

    if (error || !data) {
      setStatus('error')
      return
    }

    const qr = data as QrCode

    if (qr.scanned_by) {
      // Already claimed
      const { data: claimer } = await supabase
        .from('players')
        .select('name')
        .eq('id', qr.scanned_by)
        .single()
      setClaimerName(claimer?.name ?? 'quelqu\'un')
      setQrCode(qr)
      setStatus('already_claimed')
      return
    }

    // Claim it
    const { error: updateError } = await supabase
      .from('qr_codes')
      .update({
        scanned_by: player!.id,
        scanned_at: new Date().toISOString(),
      })
      .eq('id', qr.id)
      .is('scanned_by', null)

    if (updateError) {
      setStatus('error')
      return
    }

    setQrCode({ ...qr, scanned_by: player!.id })
    setStatus('pending')
  }

  async function openScanner() {
    setShowScanner(true)
    // Dynamically import to avoid loading the library on page load
    const { Html5QrcodeScanner } = await import('html5-qrcode')
    const scanner = new Html5QrcodeScanner(
      'reward-qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    )

    scanner.render(
      (decodedText) => {
        scanner.clear()
        setShowScanner(false)
        try {
          const url = new URL(decodedText)
          const scannedCode = url.searchParams.get('code')
          if (scannedCode) {
            navigate(`/scan?code=${encodeURIComponent(scannedCode)}`)
          } else {
            // Maybe it's a login QR
            const token = url.searchParams.get('token')
            if (token) {
              navigate('/home')
            }
          }
        } catch {
          // Try raw code
          navigate(`/scan?code=${encodeURIComponent(decodedText)}`)
        }
      },
      () => { } // ignore scan errors
    )
  }

  if (!player) return null

  const rewardLabel = qrCode?.reward_type === 'shield' ? <><GiCheckedShield className="inline" /> Bouclier</> : <><GiCrystalBall className="inline" /> Clairvoyance</>

  return (
    <div className="min-h-screen bg-village-night flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        {status === 'loading' && (
          <div className="animate-candle text-candle-400 font-cinzel text-lg">Vérification du QR code...</div>
        )}

        {status === 'no_code' && !showScanner && (
          <div>
            <div className="text-5xl mb-4"><RiCameraFill /></div>
            <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide mb-4">
              Scanner un QR
            </h1>
            <button
              onClick={openScanner}
              className="bg-gradient-to-b from-candle-500 to-candle-600 hover:from-candle-400 hover:to-candle-500 text-night-950 font-cinzel font-semibold py-3 px-8 rounded-lg transition-all"
            >
              Ouvrir la caméra
            </button>
            <button
              onClick={() => navigate('/home')}
              className="block mx-auto mt-4 text-moon-400 hover:text-parchment-200 font-crimson text-sm"
            >
              ← Retour
            </button>
          </div>
        )}

        {showScanner && (
          <div>
            <div id="reward-qr-reader" className="rounded-lg overflow-hidden border border-night-600 mb-4" />
            <button
              onClick={() => { setShowScanner(false); navigate('/home') }}
              className="text-moon-400 hover:text-parchment-200 font-crimson text-sm"
            >
              Annuler
            </button>
          </div>
        )}

        {status === 'pending' && (
          <div>
            <div className="text-5xl mb-4"><RiCheckboxCircleFill /></div>
            <h1 className="font-cinzel text-2xl font-bold text-candle-400 tracking-wide mb-2">
              QR scanné !
            </h1>
            <p className="font-crimson text-moon-400 text-lg mb-2">
              Récompense : {rewardLabel}
            </p>
            <div className="bg-candle-600/20 border border-candle-500/30 rounded-xl p-4 mb-6">
              <p className="font-crimson text-candle-400 text-sm animate-pulse">
                <RiHourglassFill className="inline" /> En attente d'approbation du MJ...
              </p>
            </div>
            <button
              onClick={() => navigate('/home')}
              className="text-moon-400 hover:text-parchment-200 font-crimson text-sm"
            >
              ← Retour au village
            </button>
          </div>
        )}

        {status === 'already_claimed' && (
          <div>
            <div className="text-5xl mb-4"><RiCloseCircleFill /></div>
            <h1 className="font-cinzel text-xl font-bold text-red-400 tracking-wide mb-2">
              Déjà réclamé !
            </h1>
            <p className="font-crimson text-moon-400 mb-6">
              Ce QR code a déjà été scanné par <strong className="text-parchment-200">{claimerName}</strong>.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="text-moon-400 hover:text-parchment-200 font-crimson text-sm"
            >
              ← Retour au village
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="text-5xl mb-4"><RiCloseCircleFill /></div>
            <h1 className="font-cinzel text-xl font-bold text-red-400 tracking-wide mb-2">
              QR code invalide
            </h1>
            <p className="font-crimson text-moon-400 mb-6">
              Ce QR code n'existe pas ou a expiré.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="text-moon-400 hover:text-parchment-200 font-crimson text-sm"
            >
              ← Retour au village
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
