import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
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
function bumpBoostLeft(link, now) {
  const until = link.bumpBoostUntil ?? (link.bumpedAt ?? 0) + BUMP_BOOST_MS
  const minsLeft = Math.ceil((until - now) / 60000)
  if (minsLeft <= 0) return null
  const h = Math.floor(minsLeft / 60)
  const m = minsLeft % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
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

export default function PopularLinks() {
  const now = useNow()
  const links = useQuery(api.links.listPublic) ?? []

  // F1c companion: never render hrefs with attacker-chosen schemes.
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
            Popular{' '}
            <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">Links</span>
          </h2>
          <a href="/all" className="text-sm text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
            View all →
          </a>
        </div>

        {links.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            No public links yet. Create one above to get started.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => {
              // F1c companion: skip entries with unsafe destination schemes.
              const href = safeHrefs(link.url)
              if (!href) return null
              return (
              <a
                key={link._id}
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className={`group relative overflow-hidden rounded-2xl border bg-white p-5 transition hover:-translate-y-1 dark:bg-slate-900/60 ${isPinned(link) ? (link.pinnedPermanent ? "border-blue-400 shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/40 hover:border-blue-400 hover:shadow-blue-500/30 dark:border-blue-400/40 dark:shadow-blue-400/15" : "border-amber-400 shadow-lg shadow-amber-500/25 ring-1 ring-amber-400/40 hover:border-amber-400 hover:shadow-amber-500/30 dark:border-amber-400/40 dark:shadow-amber-400/15") : "border-slate-200 hover:border-sky-400/40 hover:shadow-lg hover:shadow-sky-500/10 dark:border-white/10 dark:hover:shadow-xl dark:hover:shadow-sky-500/10"}`}
              >
                <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_70%)] opacity-0 transition group-hover:opacity-100" />
                <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
                  {isPinned(link) && (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${link.pinnedPermanent ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300" : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"}`}>
                      📌 Pinned{link.pinnedPermanent ? " • permanent" : ""}
                    </span>
                  )}
                  {link.bumpedAt != null && (
                    <span className="rounded-full border border-violet-300 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-300">
                      🚀 {bumpBoostLeft(link, now) ? `Boosted · ${bumpBoostLeft(link, now)} left` : "Bumped"}
                    </span>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-600/20 text-xl ring-1 ring-slate-200 dark:ring-white/10">
                    {link.icon}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate pr-16 font-semibold text-slate-900 dark:text-slate-100" style={titleStyle(link)}>
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
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
