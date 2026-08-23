import { useEffect, useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { normalizeUrl } from '../lib/store'
import { authClient, signInDiscord } from '../lib/auth-client'

function formatClicks(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M clicks`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K clicks`
  return `${n} clicks`
}

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500'

function EditForm({ link, onDone }) {
  const updateLink = useMutation(api.links.updateLink)
  const [url, setUrl] = useState(link.url ?? '')
  const [title, setTitle] = useState(link.title)
  const [description, setDescription] = useState(link.description)
  const [icon, setIcon] = useState(link.icon)
  const [color, setColor] = useState(link.color ?? '#38bdf8')
  const [image, setImage] = useState(link.image ?? '')
  const [password, setPassword] = useState('')
  const [removePassword, setRemovePassword] = useState(false)
  const [publicListing, setPublicListing] = useState(link.public)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      new URL(normalizeUrl(url))
    } catch {
      setSaving(false)
      return setError('URL non valido.')
    }
    let embedImage
    try {
      if (image.trim()) embedImage = new URL(normalizeUrl(image.trim())).href
    } catch {
      setSaving(false)
      return setError('Embed image must be a valid URL.')
    }
    try {
      await updateLink({
        id: link._id,
        url: normalizeUrl(url),
        title: title.trim(),
        description: description.trim(),
        icon: icon.trim(),
        color,
        image: embedImage ?? '',
        password: removePassword ? '' : password.trim() || undefined,
        public: publicListing,
      })
      onDone()
    } catch (err) {
      setError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not update link.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-sky-400/40 bg-white p-5 shadow-lg shadow-sky-500/10 dark:bg-slate-900/70">
      <div className="space-y-3">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Destination URL" className={inputCls} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={inputCls} />
          <input value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} placeholder="Emoji icon 🔗" className={inputCls} />
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short description" className={`${inputCls} resize-none`} />
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
          <input value={image} onChange={(e) => setImage(e.target.value)} placeholder="Embed image URL (optional)" className={inputCls} />
        </div>
        {link.requiresPassword ? (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 transition hover:border-sky-400/30 dark:border-white/10 dark:bg-black/30 dark:text-slate-100">
            <input
              type="checkbox"
              checked={removePassword}
              onChange={(e) => setRemovePassword(e.target.checked)}
              className="size-4 accent-sky-500"
            />
            Remove password protection
          </label>
        ) : (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set a password (optional)"
            className={inputCls}
          />
        )}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-400/30 dark:border-white/10 dark:bg-black/20">
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
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">List this link publicly</span>
        </label>
        {error && <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-2.5 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={onDone}
            className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700/80"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

export default function MyLinks() {
  const { data: session, isPending } = authClient.useSession()
  const links = useQuery(api.links.listMine, session ? {} : 'skip') ?? []
  const removeLink = useAction(api.links.moderatorDelete)
  const checkMod = useAction(api.links.amModerator)
  const loadAll = useAction(api.links.listAllAsModerator)
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [adminConfirmId, setAdminConfirmId] = useState(null)
  const [isMod, setIsMod] = useState(false)
  const [allLinks, setAllLinks] = useState(null)
  const [adminError, setAdminError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    if (!session) return
    checkMod()
      .then((v) => {
        if (!alive || !v) return
        setIsMod(true)
        return loadAll()
          .then((r) => {
            if (alive) setAllLinks(r)
          })
          .catch((err) => {
            if (alive) {
              setAdminError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not load all links.')
            }
          })
      })
      .catch((err) => {
        if (alive) {
          setAdminError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not verify moderator status.')
        }
      })
    return () => { alive = false }
  }, [session, checkMod, loadAll])

  const handleDelete = async (id) => {
    try {
      await removeLink({ id })
      setError('')
    } catch (err) {
      setError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not delete link.')
    }
    setConfirmId(null)
    setAdminConfirmId(null)
    if (isMod) loadAll().then(setAllLinks).catch(() => {})
  }

  const refreshAll = () => {
    if (isMod) loadAll().then(setAllLinks).catch(() => {})
  }

  return (
    <section className="border-t border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-black/20">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            My{' '}
            <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">Links</span>
          </h2>
          <a href="/" className="text-sm text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
            ← Back home
          </a>
        </div>

        {isPending ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        ) : !session ? (
          <div className="mt-8 flex flex-col items-start gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to manage your links.</p>
            <button
              onClick={signInDiscord}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[0.98]"
            >
              Login with Discord
            </button>
          </div>
        ) : links.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            You haven't created any links yet. Create one from the home page.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) =>
              editingId === link._id ? (
                <EditForm key={link._id} link={link} onDone={() => setEditingId(null)} />
              ) : (
                <div
                  key={link._id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-400/40 dark:border-white/10 dark:bg-slate-900/60"
                >
                  <div className="flex items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-600/20 text-xl ring-1 ring-slate-200 dark:ring-white/10">
                      {link.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">{link.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{link.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        {formatClicks(link.clicks)}
                      </span>
                      {link.requiresPassword && <span title="Password protected">🔒</span>}
                      {!link.public && (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          private
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500">/{link.slug}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => { setEditingId(link._id); setConfirmId(null) }}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-100 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:text-sky-300"
                    >
                      Edit
                    </button>
                    {confirmId === link._id ? (
                      <div className="flex flex-1 gap-2">
                        <button
                          onClick={() => handleDelete(link._id)}
                          className="flex-1 rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(link._id)}
                        className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
        {error && <p className="mt-4 text-sm text-rose-500 dark:text-rose-400">{error}</p>}

        {isMod && (
          <div className="mt-16">
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Admin view ·{' '}
              <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">all links</span>
            </h3>
            {!allLinks ? (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                {adminError || 'Loading…'}
              </p>
            ) : allLinks.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">No links exist yet.</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allLinks.map((link) => (
                  <div
                    key={link._id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60"
                  >
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-600/20 text-lg ring-1 ring-slate-200 dark:ring-white/10">
                        {link.icon}
                      </span>
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold text-slate-900 dark:text-slate-100">{link.title}</h4>
                        <p className="truncate font-mono text-xs text-slate-400 dark:text-slate-500">/{link.slug}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                          {formatClicks(link.clicks)}
                        </span>
                        {link.requiresPassword && <span title="Password protected">🔒</span>}
                        {!link.public && (
                          <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            private
                          </span>
                        )}
                      </div>
                      {adminConfirmId === link._id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(link._id).then(refreshAll)}
                            className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-rose-600"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setAdminConfirmId(null)}
                            className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAdminConfirmId(link._id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
