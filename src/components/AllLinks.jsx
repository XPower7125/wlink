import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function formatClicks(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M clicks`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K clicks`
  return `${n} clicks`
}
function isPinned(link) {
  if (link.pinnedPermanent) return true;
  return link.pinnedUntil != null && link.pinnedUntil > Date.now();
}
const BUMP_BOOST_MS = 60 * 60 * 1000
function bumpActive(link) {
  return link.bumpedAt != null && (link.bumpBoostUntil ?? link.bumpedAt + BUMP_BOOST_MS) > Date.now()
}
const HEX_RE = /^#[0-9a-fA-F]{6}$/
function titleStyle(link) {
  if (link.textColor && link.textColor2 && HEX_RE.test(link.textColor) && HEX_RE.test(link.textColor2)) {
    return {
      backgroundImage: `linear-gradient(90deg, ${link.textColor}, ${link.textColor2})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
    }
  }
  return link.textColor ? { color: link.textColor } : undefined
}

export default function AllLinks() {
  const links = useQuery(api.links.listAllPublic) ?? []
  const myRolesAction = useAction(api.links.myRoles)
  const deleteAny = useAction(api.links.moderatorDelete)
  const [isMod, setIsMod] = useState(false)
  const [adminConfirmId, setAdminConfirmId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    myRolesAction()
      .then((roles) => alive && setIsMod(roles.moderator))
      .catch(() => {})
    return () => { alive = false }
  }, [myRolesAction])

  const handleModDelete = async (id) => {
    if (!window.confirm('Delete this link?')) return
    try {
      await deleteAny({ id })
      setError('')
    } catch (err) {
      setError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not delete link.')
    }
  }

  const safeHrefs = (url) => {
    try {
      const u = new URL(url)
      return u.protocol === 'http:' || u.protocol === 'https:' ? url : null
    } catch {
      return null
    }
  }

  return (
    <section className="border-t border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-black/20">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            All{' '}
            <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">Links</span>
          </h2>
          <a href="/" className="text-sm text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
            ← Back home
          </a>
        </div>

        {links.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            No public links yet.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => {
              const href = safeHrefs(link.url)
              if (!href) return null
              return (
              <div
                key={link._id}
                className={`group relative overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 dark:bg-slate-900/60 ${isPinned(link) ? (link.pinnedPermanent ? "border-blue-400 shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/40 hover:border-blue-400 hover:shadow-blue-500/30 dark:border-blue-400/40 dark:shadow-blue-400/15" : "border-amber-400 shadow-lg shadow-amber-500/25 ring-1 ring-amber-400/40 hover:border-amber-400 hover:shadow-amber-500/30 dark:border-amber-400/40 dark:shadow-amber-400/15") : "border-slate-200 hover:border-sky-400/40 hover:shadow-lg hover:shadow-sky-500/10 dark:border-white/10 dark:hover:shadow-xl dark:hover:shadow-sky-500/10"}`}
              >
                {isMod && (
                  adminConfirmId === link._id ? (
                    <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
                      <button
                        onClick={() => handleModDelete(link._id)}
                        className="rounded-lg bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white shadow transition hover:bg-rose-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setAdminConfirmId(null)}
                        className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 shadow dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAdminConfirmId(link._id)}
                      title="Delete link (moderator)"
                      className="absolute right-2 top-2 z-20 grid size-6 place-items-center rounded-full bg-rose-500/90 text-xs font-bold text-white opacity-0 shadow transition hover:bg-rose-600 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  )
                )}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block p-5"
                >
                  <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_70%)] opacity-0 transition group-hover:opacity-100" />
                  {isPinned(link) && (
                    <span className={`absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[11px] font-medium ${link.pinnedPermanent ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300" : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"}`}>
                      📌 Pinned{link.pinnedPermanent ? " • permanent" : ""}
                    </span>
                  )}
                  {bumpActive(link) && (
                    <span className={`absolute right-3 rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300 ${isPinned(link) ? "top-10" : "top-3"}`}>
                      🚀 Bumped
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-600/20 text-xl ring-1 ring-slate-200 dark:ring-white/10">
                      {link.icon}
                    </span>
                    <div className="min-w-0">
                      <h3
                        className="truncate pr-16 font-semibold text-slate-900 dark:text-slate-100"
                        style={titleStyle(link)}
                      >
                        {isPinned(link) ? "📌 " : ""}
                        {link.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{link.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      {formatClicks(link.clicks)}
                    </span>
                    <span className="font-mono text-xs lowercase text-slate-400 transition group-hover:text-sky-600 dark:text-slate-500 dark:group-hover:text-sky-300">
                      /{link.slug}
                    </span>
                  </div>
                </a>
              </div>
              )
            })}
          </div>
        )}
        {error && <p className="mt-4 text-sm text-rose-500 dark:text-rose-400">{error}</p>}
      </div>
    </section>
  )
}
