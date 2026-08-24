import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QrModal({ url, title, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!url) return
    let alive = true
    setDataUrl(null)
    setError('')
    QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((d) => alive && setDataUrl(d))
      .catch((e) => alive && setError(e?.message || 'Could not generate QR code.'))
    return () => { alive = false }
  }, [url])

  if (!url) return null

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${(title || 'link').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}-qr.png`
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">QR code</h3>
          <button
            onClick={onClose}
            className="grid size-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <p className="mt-0.5 truncate font-mono text-xs lowercase text-slate-400 dark:text-slate-500">{url}</p>
        <div className="mt-3 grid place-items-center rounded-xl bg-white p-3">
          {error ? (
            <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>
          ) : dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${url}`} className="size-56 rounded-lg" />
          ) : (
            <div className="grid size-56 place-items-center text-sm text-slate-400 dark:text-slate-500">Generating…</div>
          )}
        </div>
        <button
          onClick={download}
          disabled={!dataUrl}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
        >
          Download PNG
        </button>
      </div>
    </div>
  )
}
