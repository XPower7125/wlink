function formatClicks(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M clicks`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K clicks`
  return `${n} clicks`
}

export default function PopularLinks({ links }) {
  const popular = links
    .filter((l) => l.public !== false || l.sponsored)
    .slice(0, 6)

  return (
    <section className="border-t border-white/5 bg-black/20">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Popular{' '}
            <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">Links</span>
          </h2>
          <a href="#" className="text-sm text-slate-400 transition hover:text-sky-300">
            View all →
          </a>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition hover:-translate-y-1 hover:border-sky-400/40 hover:shadow-xl hover:shadow-sky-500/10"
            >
              <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12),transparent_70%)] opacity-0 transition group-hover:opacity-100" />
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500/20 to-blue-600/20 text-xl ring-1 ring-white/10">
                  {link.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-slate-100">{link.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{link.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {link.sponsored ? (
                  <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                    Sponsored
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-300">
                    {formatClicks(link.clicks)}
                  </span>
                )}
                <span className="font-mono text-xs text-slate-500 transition group-hover:text-sky-300">
                  /{link.slug}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
