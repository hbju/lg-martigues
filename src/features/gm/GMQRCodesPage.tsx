import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import type { Player } from '../../types/supabase'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { RiHourglassFill, RiFileTextFill, RiPrinterFill, RiRefreshLine } from 'react-icons/ri'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export function GMQRCodesPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPlayers()
  }, [])

  async function fetchPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('is_gm', false)
      .order('name')
      .returns<Player[]>()

    if (data) setPlayers(data)
    setIsLoading(false)
  }

  async function regenerateToken(playerId: string) {
    const newToken = crypto.randomUUID().slice(0, 12)
    await supabase
      .from('players')
      .update({ auth_token: newToken })
      .eq('id', playerId)

    fetchPlayers()
  }

  async function handleDownloadPdf() {
    if (!printRef.current || players.length === 0) return
    setIsGeneratingPdf(true)

    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210
      const pageHeight = 297
      const margin = 10
      const cardWidth = (pageWidth - margin * 3) / 2
      const cardHeight = (pageHeight - margin * 3) / 2
      const cardsPerPage = 4

      for (let i = 0; i < players.length; i++) {
        const pageIndex = i % cardsPerPage
        if (i > 0 && pageIndex === 0) pdf.addPage()

        const col = pageIndex % 2
        const row = Math.floor(pageIndex / 2)
        const x = margin + col * (cardWidth + margin)
        const y = margin + row * (cardHeight + margin)

        // Draw dotted cut lines
        pdf.setDrawColor(180, 180, 180)
        pdf.setLineDashPattern([2, 2], 0)
        pdf.rect(x, y, cardWidth, cardHeight)

        // Render QR code from hidden container
        const qrEl = document.getElementById(`qr-login-${players[i].id}`)
        if (qrEl) {
          const canvas = await html2canvas(qrEl, { backgroundColor: '#ffffff', scale: 2 })
          const imgData = canvas.toDataURL('image/png')
          const qrSize = Math.min(cardWidth - 20, cardHeight - 40)
          const qrX = x + (cardWidth - qrSize) / 2
          pdf.addImage(imgData, 'PNG', qrX, y + 8, qrSize, qrSize)
        }

        // Player name
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(16)
        pdf.setTextColor(30, 30, 30)
        const nameY = y + cardHeight - 20
        pdf.text(players[i].name, x + cardWidth / 2, nameY, { align: 'center' })

        // Instruction text
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(120, 120, 120)
        pdf.text('Scanne ce QR avec l\'app Loups-Garous', x + cardWidth / 2, nameY + 7, { align: 'center' })
      }

      pdf.save('qr-codes-login.pdf')
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Erreur lors de la génération du PDF.')
    } finally {
      setIsGeneratingPdf(false)
    }
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">QR Codes Login</h1>
          <div className="flex items-center gap-3 print:hidden">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || players.length === 0}
              className="bg-candle-500 text-night-950 px-4 py-2 rounded-lg font-cinzel font-semibold hover:bg-candle-400 transition-colors disabled:opacity-40"
            >
              {isGeneratingPdf ? <><RiHourglassFill className="inline" /> Génération...</> : <><RiFileTextFill className="inline" /> Télécharger PDF</>}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-night-700 hover:bg-night-600 text-parchment-200 py-2 px-4 rounded-lg transition-colors font-crimson border border-night-600"
            >
              <RiPrinterFill className="inline" /> Imprimer
            </button>
            <Link to="/gm" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm">← Dashboard</Link>
          </div>
        </div>

        {/* Hidden QR renders for PDF generation */}
        <div ref={printRef} className="fixed -left-[9999px] top-0" aria-hidden="true">
          {players.map((player) => {
            const loginUrl = `${APP_URL}/login?token=${encodeURIComponent(player.auth_token)}`
            return (
              <div key={player.id} id={`qr-login-${player.id}`} className="bg-white p-4 inline-block">
                <QRCodeSVG value={loginUrl} size={200} level="M" />
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3">
          {players.map((player) => {
            const loginUrl = `${APP_URL}/login?token=${encodeURIComponent(player.auth_token)}`
            return (
              <div
                key={player.id}
                className="bg-parchment-50 rounded-xl p-5 flex flex-col items-center gap-3 print:break-inside-avoid border-2 border-parchment-200"
              >
                <QRCodeSVG value={loginUrl} size={180} level="M" />
                <div className="h-px w-full bg-parchment-200" />
                <p className="text-night-950 font-cinzel font-bold text-lg tracking-wide">{player.name}</p>
                <p className="text-parchment-300 text-xs font-mono truncate max-w-full">
                  {player.auth_token}
                </p>
                <button
                  onClick={() => regenerateToken(player.id)}
                  className="text-blood-500 hover:text-blood-600 text-sm print:hidden transition-colors font-crimson"
                >
                  <RiRefreshLine className="inline" /> Régénérer
                </button>
              </div>
            )
          })}
        </div>

        {players.length === 0 && (
          <div className="text-center text-moon-400 mt-12 font-crimson">
            <p className="italic">Aucun joueur trouvé.</p>
            <p className="text-sm mt-1">Ajoute des joueurs depuis le dashboard MJ.</p>
          </div>
        )}
      </div>
    </div>
  )
}
