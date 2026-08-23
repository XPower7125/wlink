import { useEffect, useState } from 'react'
import { signInDiscord } from '../lib/auth-client'

const NAV = ['Twitter', 'Discord', 'About us', 'Documentation']

export default function Header() {
  const [dark, setDark] = useState(true)
  const { data: session } = authClient.useSession()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0e17]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 shadow-lg shadow-sky-500/30">
            <svg viewBox="0 0 24 24" className="size-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
            </svg>
          </span>
          wlink
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item}
              href="#"
              className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
            >
              {item}
            </a>
          ))}
          <button
            onClick={() => setDark(!dark)}
            className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            Change theme
          </button>
        </nav>

        {session ? (
          <div className="flex items-center gap-2">
            {session.user.image && (
              <img src={session.user.image} alt="" className="size-7 rounded-full ring-1 ring-white/20" />
            )}
            <span className="hidden text-sm text-slate-300 sm:block">{session.user.name}</span>
          </div>
        ) : (
          <button
            onClick={signInDiscord}
            className="group flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-300"
          >
            Sign in
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        )}
      </div>
    </header>
  )
}
