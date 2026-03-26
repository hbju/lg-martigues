import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { useRealtimePlayers } from '../../hooks/useRealtimePlayers'
import type { QrCode } from '../../types/supabase'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin

export function GMRewardQRPage() {
  const { players } = useRealtimePlayers()
  const [qrCodes, setQrCodes] = useState<QrCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newRewardType, setNewRewardType] = useState<'shield' | 'clairvoyance'>('shield')
  const [isCreating, setIsCreating] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isGeneratingCheatSheet, setIsGeneratingCheatSheet] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchQrCodes()
    const channel = supabase
      .channel('gm_qr_codes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_codes' }, () => {
        fetchQrCodes()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchQrCodes() {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setQrCodes(data as QrCode[])
    setIsLoading(false)
  }

  function getPlayerName(id: string | null): string {
    if (!id) return ''
    return players.find(p => p.id === id)?.name ?? 'Inconnu'
  }

  async function handleCreate() {
    if (!newLabel.trim()) return
    setIsCreating(true)

    const code = crypto.randomUUID().slice(0, 12)
    await supabase.from('qr_codes').insert({
      code,
      label: newLabel.trim(),
      reward_type: newRewardType,
    })

    setNewLabel('')
    setIsCreating(false)
  }

  async function handleBatchCreate(count: number) {
    setIsCreating(true)
    const items = Array.from({ length: count }, (_, i) => ({
      code: crypto.randomUUID().slice(0, 12),
      label: `QR #${qrCodes.length + i + 1}`,
      reward_type: newRewardType,
    }))
    await supabase.from('qr_codes').insert(items)
    setIsCreating(false)
  }

  async function handleApprove(qr: QrCode) {
    if (!qr.scanned_by) return

    // Mark as confirmed
    await supabase
      .from('qr_codes')
      .update({ confirmed_by_gm: true })
      .eq('id', qr.id)

    // Grant the power-up
    await supabase.from('power_ups').insert({
      player_id: qr.scanned_by,
      type: qr.reward_type,
      source: 'qr' as const,
      granted_by_gm: true,
    })

    const typeLabel = qr.reward_type === 'shield' ? '🛡️ Bouclier' : '🔮 Clairvoyance'
    await supabase.from('notifications').insert({
      player_id: qr.scanned_by,
      type: qr.reward_type === 'shield' ? 'shield_gained' as const : 'clairvoyance_gained' as const,
      title: `${typeLabel} trouvé !`,
      message: `Tu as obtenu un ${typeLabel.toLowerCase()} via un QR code.`,
    })
  }

  async function handleReject(qr: QrCode) {
    if (!qr.scanned_by) return

    const playerId = qr.scanned_by

    // Reset the QR code
    await supabase
      .from('qr_codes')
      .update({ scanned_by: null, scanned_at: null, confirmed_by_gm: false })
      .eq('id', qr.id)

    await supabase.from('notifications').insert({
      player_id: playerId,
      type: 'generic' as const,
      title: 'QR rejeté',
      message: 'Ta réclamation de QR code a été rejetée par le MJ.',
    })
  }

  async function handleDelete(qr: QrCode) {
    if (!confirm(`Supprimer le QR "${qr.label}" ?`)) return
    await supabase.from('qr_codes').delete().eq('id', qr.id)
  }

  async function handleDownloadRewardPdf() {
    if (unscanned.length === 0) return
    setIsGeneratingPdf(true)

    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210
      const pageHeight = 297
      const margin = 10
      const cols = 3
      const rows = 3
      const cardWidth = (pageWidth - margin * (cols + 1)) / cols
      const cardHeight = (pageHeight - margin * (rows + 1)) / rows
      const cardsPerPage = cols * rows

      for (let i = 0; i < unscanned.length; i++) {
        const pageIndex = i % cardsPerPage
        if (i > 0 && pageIndex === 0) pdf.addPage()

        const col = pageIndex % cols
        const row = Math.floor(pageIndex / cols)
        const x = margin + col * (cardWidth + margin)
        const y = margin + row * (cardHeight + margin)

        // Dotted cut lines
        pdf.setDrawColor(180, 180, 180)
        pdf.setLineDashPattern([2, 2], 0)
        pdf.rect(x, y, cardWidth, cardHeight)

        // Render QR
        const qrEl = document.getElementById(`qr-reward-${unscanned[i].id}`)
        if (qrEl) {
          const canvas = await html2canvas(qrEl, { backgroundColor: '#ffffff', scale: 2 })
          const imgData = canvas.toDataURL('image/png')
          const qrSize = Math.min(cardWidth - 10, cardHeight - 18)
          const qrX = x + (cardWidth - qrSize) / 2
          const qrY = y + 4
          pdf.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize)
        }

        // Small reward icon
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(150, 150, 150)
        const typeIcon = unscanned[i].reward_type === 'shield' ? 'Recompense' : 'Recompense'
        pdf.text(typeIcon, x + cardWidth / 2, y + cardHeight - 4, { align: 'center' })
      }

      pdf.save('qr-codes-recompenses.pdf')
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Erreur lors de la génération du PDF.')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  async function handleDownloadCheatSheet() {
    setIsGeneratingCheatSheet(true)

    try {
      const pdf = new jsPDF('p', 'mm', 'a4')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.setTextColor(30, 30, 30)
      pdf.text('Aide-memoire QR Recompenses — MJ', 105, 20, { align: 'center' })

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.setTextColor(100, 100, 100)
      pdf.text(`Genere le ${new Date().toLocaleDateString('fr-FR')}`, 105, 27, { align: 'center' })

      // Table header
      let y = 40
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(30, 30, 30)
      pdf.text('#', 15, y)
      pdf.text('Label / Emplacement', 25, y)
      pdf.text('Recompense', 120, y)
      pdf.text('Code', 165, y)

      pdf.setDrawColor(0, 0, 0)
      pdf.setLineWidth(0.5)
      pdf.line(15, y + 2, 195, y + 2)

      y += 10
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)

      const allQr = [...unscanned, ...confirmed]
      for (let i = 0; i < allQr.length; i++) {
        if (y > 280) {
          pdf.addPage()
          y = 20
        }
        const qr = allQr[i]
        const rewardLabel = qr.reward_type === 'shield' ? 'Bouclier' : 'Clairvoyance'
        const status = qr.confirmed_by_gm ? ' (utilise)' : qr.scanned_by ? ' (scanne)' : ''

        pdf.setTextColor(30, 30, 30)
        pdf.text(`${i + 1}`, 15, y)
        pdf.text(qr.label || 'N/A', 25, y)
        pdf.text(`${rewardLabel}${status}`, 120, y)
        pdf.setFontSize(8)
        pdf.setTextColor(120, 120, 120)
        pdf.text(qr.code, 165, y)
        pdf.setFontSize(10)

        y += 8
      }

      pdf.save('aide-memoire-qr-mj.pdf')
    } catch (err) {
      console.error('Cheat sheet generation failed:', err)
      alert('Erreur lors de la génération.')
    } finally {
      setIsGeneratingCheatSheet(false)
    }
  }

  const pendingScans = qrCodes.filter(q => q.scanned_by && !q.confirmed_by_gm)
  const unscanned = qrCodes.filter(q => !q.scanned_by)
  const confirmed = qrCodes.filter(q => q.confirmed_by_gm)

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
          <h1 className="font-cinzel text-2xl font-bold text-parchment-100 tracking-wide">🎁 QR Récompenses</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadRewardPdf}
              disabled={isGeneratingPdf || unscanned.length === 0}
              className="bg-candle-500 text-night-950 px-3 py-2 rounded-lg font-cinzel font-semibold text-sm hover:bg-candle-400 transition-colors disabled:opacity-40 print:hidden"
            >
              {isGeneratingPdf ? '⏳...' : '📄 PDF QR'}
            </button>
            <button
              onClick={handleDownloadCheatSheet}
              disabled={isGeneratingCheatSheet || qrCodes.length === 0}
              className="bg-night-700 text-parchment-200 px-3 py-2 rounded-lg font-crimson text-sm hover:bg-night-600 transition-colors border border-night-600 disabled:opacity-40 print:hidden"
            >
              {isGeneratingCheatSheet ? '⏳...' : '📋 Aide-mémoire MJ'}
            </button>
            <button
              onClick={() => window.print()}
              className="bg-night-700 hover:bg-night-600 text-parchment-200 py-2 px-4 rounded-lg transition-colors print:hidden font-crimson border border-night-600"
            >
              🖨️ Imprimer
            </button>
            <Link to="/gm" className="text-moon-400 hover:text-parchment-200 font-crimson text-sm print:hidden">← Dashboard</Link>
          </div>
        </div>

        {/* Create new QR codes */}
        <div className="bg-parchment-card rounded-xl p-4 mb-6 backdrop-blur-sm print:hidden">
          <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
            Créer un QR code
          </h2>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="font-crimson text-moon-400 text-xs block mb-1">Label (emplacement)</label>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Ex: Derrière la TV"
                className="w-full bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson placeholder:text-night-600"
              />
            </div>
            <div>
              <label className="font-crimson text-moon-400 text-xs block mb-1">Récompense</label>
              <select
                value={newRewardType}
                onChange={e => setNewRewardType(e.target.value as 'shield' | 'clairvoyance')}
                className="bg-night-800 text-parchment-200 rounded-lg px-3 py-2 border border-night-600 focus:border-candle-500 focus:outline-none font-crimson"
              >
                <option value="shield">🛡️ Bouclier</option>
                <option value="clairvoyance">🔮 Clairvoyance</option>
              </select>
            </div>
            <button
              onClick={handleCreate}
              disabled={!newLabel.trim() || isCreating}
              className="bg-candle-500 text-night-950 px-4 py-2 rounded-lg font-cinzel font-semibold hover:bg-candle-400 transition-colors disabled:opacity-40"
            >
              Créer
            </button>
            <button
              onClick={() => handleBatchCreate(4)}
              disabled={isCreating}
              className="bg-night-700 text-parchment-200 px-4 py-2 rounded-lg font-crimson hover:bg-night-600 transition-colors border border-night-600 disabled:opacity-40"
            >
              +4 en lot
            </button>
          </div>
        </div>

        {/* Pending scans */}
        {pendingScans.length > 0 && (
          <div className="bg-candle-600/10 border border-candle-500/20 rounded-xl p-4 mb-6 print:hidden">
            <h2 className="font-cinzel text-candle-400 font-semibold text-sm tracking-wider uppercase mb-3">
              ⏳ Scans en attente ({pendingScans.length})
            </h2>
            <div className="space-y-3">
              {pendingScans.map(q => (
                <div key={q.id} className="bg-night-800/50 border border-night-600/30 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-crimson text-parchment-200 text-sm">
                      <strong>{getPlayerName(q.scanned_by)}</strong> a scanné <em className="text-moon-400">{q.label}</em>
                    </p>
                    <p className="font-crimson text-moon-400/60 text-xs">
                      {q.reward_type === 'shield' ? '🛡️ Bouclier' : '🔮 Clairvoyance'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(q)}
                      className="bg-candle-500 text-night-950 px-3 py-1.5 rounded-lg text-xs font-cinzel hover:bg-candle-400 transition-colors"
                    >
                      ✅ Approuver
                    </button>
                    <button
                      onClick={() => handleReject(q)}
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

        {/* Hidden QR renders for PDF generation */}
        <div ref={printRef} className="fixed -left-[9999px] top-0" aria-hidden="true">
          {unscanned.map(q => {
            const scanUrl = `${APP_URL}/scan?code=${encodeURIComponent(q.code)}`
            return (
              <div key={q.id} id={`qr-reward-${q.id}`} className="bg-white p-3 inline-block">
                <QRCodeSVG value={scanUrl} size={160} level="M" />
              </div>
            )
          })}
        </div>

        {/* Printable QR cards */}
        {unscanned.length > 0 && (
          <div className="mb-6">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3 print:hidden">
              📇 QR codes à imprimer ({unscanned.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
              {unscanned.map(q => {
                const scanUrl = `${APP_URL}/scan?code=${encodeURIComponent(q.code)}`
                return (
                  <div
                    key={q.id}
                    className="bg-parchment-50 rounded-xl p-5 flex flex-col items-center gap-3 print:break-inside-avoid border-2 border-parchment-200"
                  >
                    <QRCodeSVG value={scanUrl} size={160} level="M" />
                    <p className="text-night-950 font-cinzel font-bold text-sm tracking-wide text-center">
                      {q.reward_type === 'shield' ? '🛡️' : '🔮'} Récompense
                    </p>
                    {/* Label only visible to GM (not when printed for players) */}
                    <p className="text-parchment-300 text-xs font-crimson italic print:hidden">{q.label}</p>
                    <button
                      onClick={() => handleDelete(q)}
                      className="text-red-400 hover:text-red-300 text-xs print:hidden font-crimson"
                    >
                      Supprimer
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Confirmed/claimed history */}
        {confirmed.length > 0 && (
          <div className="bg-parchment-card rounded-xl p-4 backdrop-blur-sm print:hidden">
            <h2 className="font-cinzel text-parchment-100 font-semibold text-sm tracking-wider uppercase mb-3">
              ✅ QR confirmés ({confirmed.length})
            </h2>
            <div className="space-y-2">
              {confirmed.map(q => (
                <div key={q.id} className="p-2 bg-night-800/50 border border-night-700/30 rounded-lg flex items-center justify-between opacity-60">
                  <div>
                    <p className="font-crimson text-parchment-200 text-sm">{q.label}</p>
                    <p className="font-crimson text-moon-400/50 text-xs">
                      Scanné par {getPlayerName(q.scanned_by)} — {q.reward_type === 'shield' ? '🛡️' : '🔮'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
