import { useState } from 'react'
import { normalizeUrl, randomSlug } from '../lib/store'
import { authClient, signInDiscord } from '../lib/auth-client'

function DiscordIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418Z" />
    </svg>
  )
}

export default function Hero({ onAddLink }) {
  const { data: session, isPending } = authClient.useSession()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🔗')
  const [publicListing, setPublicListing] = useState(false)
  const [created, setCreated] = useState(null)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return setError('Inserisci un URL da accorciare.')
    try {
      new URL(normalizeUrl(url))
    } catch {
      return setError('URL non valido.')
    }
    const slug = randomSlug()
    const link = {
      id: crypto.randomUUID(),
      slug,
      url: normalizeUrl(url),
      title: title.trim() || normalizeUrl(url).replace(/^https?:\/\//, '').split('/')[0],
      description: description.trim() || 'No description provided.',
      icon: icon.trim() || '🔗',
      clicks: 0,
      sponsored: false,
      public: publicListing,
    }
    onAddLink(link)
    setCreated(`${window.location.origin}/${slug}`)
    setError('')
    setUrl('')
    setTitle('')
    setDescription('')
    setPublicListing(false)
  }

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_60%)]" />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-20 text-center sm:pt-28">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          w
          <span className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.35)]">
            link
          </span>
        </h1>
        <p className="mt-4 text-lg text-slate-400">A noice URL shortener.</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {session ? (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              {session.user.image && (
                <img src={session.user.image} alt="" className="size-6 rounded-full" />
              )}
              <span className="text-sm font-medium">{session.user.name}</span>
              <button
                onClick={() => authClient.signOut()}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={signInDiscord}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              <DiscordIcon className="size-5" />
              Login with Discord
            </button>
          )}
          <a
            href="#create"
            className="rounded-xl border border-white/10 bg-slate-800/80 px-5 py-2.5 font-semibold text-slate-200 transition hover:border-white/20 hover:bg-slate-700/80 active:scale-[0.98]"
          >
            Create a link
          </a>
        </div>

        <form
          id="create"
          onSubmit={handleSubmit}
          className="mt-14 w-full rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-left shadow-2xl shadow-black/40 backdrop-blur"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Create a new link</h2>

          <div className="mt-4 space-y-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-long-url.com/..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (shown in Popular Links)"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
              />
              <input
                value={icon}
                maxLength={4}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Emoji icon 🔗"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description (optional)"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20"
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-sky-400/30">
              <button
                type="button"
                role="switch"
                aria-checked={publicListing}
                onClick={() => setPublicListing(!publicListing)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${publicListing ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-slate-700'}`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${publicListing ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
              <span>
                <span className="block text-sm font-medium text-slate-200">List this link publicly</span>
                <span className="block text-xs text-slate-500">
                  Show it in the Popular Links section below so everyone can discover it.
                </span>
              </span>
            </label>

            {error && <p className="text-sm text-rose-400">{error}</p>}
            {created && (
              <p className="text-sm text-emerald-400">
                Created! Your short link:{' '}
                <span className="font-mono font-semibold text-sky-300">{created}</span>
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 active:scale-[0.99]"
            >
              Shorten it ✨
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
