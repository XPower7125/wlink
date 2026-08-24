import { useEffect, useState } from 'react'
import { useAction, useMutation } from 'convex/react'
import QRCode from 'qrcode'
import { api } from '../../convex/_generated/api'
import { normalizeUrl, randomSlug } from '../lib/store'
import { authClient, signInDiscord } from '../lib/auth-client'

function DiscordIcon({ className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.331c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418Z" />
    </svg>
  )
}

export default function Hero() {
  const { data: session, isPending } = authClient.useSession()
  const createLink = useMutation(api.links.createLink)
  const saveRedirectText = useAction(api.links.saveRedirectText)
  const saveTextColor = useAction(api.links.saveTextColor)
  const myRolesAction = useAction(api.links.myRoles)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('🔗')
  const [color, setColor] = useState('#38bdf8')
  const [image, setImage] = useState('')
  const [password, setPassword] = useState('')
  const [customAlias, setCustomAlias] = useState('')
  const [publicListing, setPublicListing] = useState(false)
  const [embedMode, setEmbedMode] = useState('wlink')
  const [redirectText, setRedirectText] = useState('')
  const [textColor, setTextColor] = useState('')
  const [expiresIn, setExpiresIn] = useState('')
  const [isPremium, setIsPremium] = useState(false)
  const [created, setCreated] = useState(null)
  const [createdQr, setCreatedQr] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    if (!session) {
      setIsPremium(false)
      return
    }
    myRolesAction()
      .then((roles) => alive && setIsPremium(roles.premium))
      .catch(() => {})
    return () => { alive = false }
  }, [session, myRolesAction])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return setError('Inserisci un URL da accorciare.')
    try {
      new URL(normalizeUrl(url))
    } catch {
      return setError('URL non valido.')
    }
    const custom = customAlias.trim().toLowerCase()
    if (custom && !/^[a-z0-9-]{1,40}$/.test(custom)) {
      return setError('Custom alias can only contain letters, numbers and hyphens (max 40).')
    }
    const slug = custom || randomSlug()
    let embedImage
    try {
      if (image.trim()) embedImage = new URL(normalizeUrl(image.trim())).href
    } catch {
      return setError('Embed image must be a valid URL.')
    }
    const link = {
      slug,
      url: normalizeUrl(url),
      title: title.trim() || normalizeUrl(url).replace(/^https?:\/\//, '').split('/')[0],
      description: description.trim() || 'No description provided.',
      icon: icon.trim() || '🔗',
      color,
      image: embedImage,
      password: password.trim() || undefined,
      public: publicListing,
      embedMode,
      expiresIn: isPremium && expiresIn ? expiresIn : undefined,
    }
    let newId
    try {
      newId = await createLink(link)
    } catch (err) {
      return setError(err?.message || 'Could not create link.')
    }
    if (isPremium && redirectText.trim()) {
      try {
        await saveRedirectText({ id: newId, text: redirectText.trim() })
      } catch (err) {
        return setError(err?.message || 'Could not save redirect text.')
      }
    }
    if (isPremium && textColor.trim()) {
      try {
        await saveTextColor({ id: newId, color: textColor.trim() })
      } catch (err) {
        return setError(err?.message || 'Could not save text color.')
      }
    }
    setCreated(`${window.location.origin}/${slug}`)
    QRCode.toDataURL(`${window.location.origin}/${slug}`, {
      width: 256,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setCreatedQr)
      .catch(() => setCreatedQr(null))
    setError('')
    setUrl('')
    setTitle('')
    setDescription('')
    setCustomAlias('')
    setPublicListing(false)
    setEmbedMode('wlink')
    setColor('#38bdf8')
    setImage('')
    setPassword('')
    setRedirectText('')
    setTextColor('')
    setExpiresIn('')
  }

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.15),transparent_60%)]" />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-20 text-center sm:pt-28">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          w
          <span className="bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.35)]">
            link
          </span>
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">The best URL shortener.</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {session ? (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 dark:border-white/10 dark:bg-white/5">
              {session.user.image && (
                <img src={session.user.image} alt="" className="size-6 rounded-full" />
              )}
              <span className="text-sm font-medium">{session.user.name}</span>
              <button
                onClick={() => authClient.signOut()}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
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
            className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-200 active:scale-[0.98] dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-slate-700/80"
          >
            Create a link
          </a>
        </div>

        <form
          id="create"
          onSubmit={handleSubmit}
          className="mt-14 w-full rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-xl shadow-black/5 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-2xl dark:shadow-black/40"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Create a new link</h2>

          <div className="mt-4 space-y-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-long-url.com/..."
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <input
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value.toLowerCase())}
              placeholder="Custom alias (optional) e.g. myprofile"
              maxLength={40}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm lowercase text-slate-900 outline-none transition placeholder:text-slate-400 placeholder:normal-case focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (shown in Popular Links)"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              <input
                value={icon}
                maxLength={4}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="Emoji icon 🔗"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description (optional)"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 transition hover:border-sky-400/30 dark:border-white/10 dark:bg-black/30 dark:text-slate-100">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-7 cursor-pointer rounded-lg border-none bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0"
                />
                Embed color
              </label>
              <input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="Embed image URL"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              The color stripe and preview shown when your link is shared on Discord.
            </p>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>🖼️</span> Embed style
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={embedMode === 'wlink'}
                  onClick={() => setEmbedMode('wlink')}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${embedMode === 'wlink' ? 'border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-500/30' : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-sky-400/50 dark:border-white/10 dark:bg-black/20 dark:text-slate-300'}`}
                >
                  Custom embed
                </button>
                <button
                  type="button"
                  aria-pressed={embedMode === 'stock'}
                  onClick={() => setEmbedMode('stock')}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${embedMode === 'stock' ? 'border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-500/30' : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-sky-400/50 dark:border-white/10 dark:bg-black/20 dark:text-slate-300'}`}
                >
                  Stock embed
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Custom uses your title/description/color. Stock skips it and shows the destination site's own preview.
              </p>
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password protect this link (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>⏳</span> Link expiry
              </label>
              <select
                value={expiresIn}
                onChange={(e) => {
                  const v = e.target.value
                  if (v && !["1h", "2h", "3h", "6h"].includes(v) && !isPremium) return
                  setExpiresIn(v)
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
              >
                <option value="">Never expires</option>
                {["1h", "2h", "3h", "6h"].map((d) => (
                  <option key={d} value={d}>
                    Expires after {d}
                  </option>
                ))}
                {["30m", "12h", "1d", "2d", "7d"].map((d) => (
                  <option key={d} value={d} disabled={!isPremium}>
                    {isPremium ? `Expires after ${d}` : `👑 Expires after ${d} (premium)`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                1h–6h free · other durations premium. Expired links stop working and disappear from listings.
              </p>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>👑</span> Custom redirect text
              </label>
              {isPremium ? (
                <>
                  <input
                    value={redirectText}
                    onChange={(e) => setRedirectText(e.target.value)}
                    maxLength={120}
                    placeholder="Custom redirect text (premium)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Premium: this text replaces "Redirecting…" on the redirect page.
                  </p>
                </>
              ) : (
                <>
                  <input
                    disabled
                    value=""
                    placeholder="Premium feature"
                    className="w-full cursor-not-allowed rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700/70 outline-none dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300/70"
                  />
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-300/80">
                    Premium feature — upgrade to customize the redirect message.
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <span>👑</span> Custom title color
              </label>
              {isPremium ? (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor || '#38bdf8'}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="size-8 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-0 dark:border-white/10 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-0"
                    />
                    <input
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      placeholder="#38bdf8 (leave empty for default)"
                      className="flex-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    {textColor && (
                      <button type="button" onClick={() => setTextColor('')} className="text-xs text-slate-500 dark:text-slate-400">
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Premium: custom color for the title in public listings.</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-400/30 dark:bg-amber-400/10">
                    <span className="size-6 rounded bg-amber-200 dark:bg-amber-400/20" />
                    <span className="text-sm text-amber-700/70 dark:text-amber-300/70">#38bdf8</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-300/80">Premium feature — upgrade to customize title colors.</p>
                </>
              )}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-400/30 dark:border-white/10 dark:bg-black/20">
              <button
                type="button"
                role="switch"
                aria-checked={publicListing}
                onClick={() => setPublicListing(!publicListing)}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${publicListing ? 'bg-gradient-to-r from-sky-500 to-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${publicListing ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
              <span>
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">List this link publicly</span>
                <span className="block text-xs text-slate-500">
                  Show it in the Popular Links section below so everyone can discover it.
                </span>
              </span>
            </label>

            {error && <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>}
            {created && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-400/30 dark:bg-emerald-400/10">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Created! Your short link:{' '}
                  <span className="font-mono font-semibold text-sky-600 dark:text-sky-300">{created}</span>
                </p>
                {createdQr && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={createdQr} alt={`QR code for ${created}`} className="size-24 rounded-lg bg-white p-1" />
                    <div>
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Scan to open</p>
                      <a
                        href={createdQr}
                        download="wlink-qr.png"
                        className="mt-1 inline-block text-xs font-semibold text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                      >
                        Download QR ↓
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-sky-500 via-sky-500 to-blue-600 py-3 font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:brightness-110 active:scale-[0.99]"
            >
              Shorten it ✨
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
