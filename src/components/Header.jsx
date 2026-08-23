import { useEffect, useState } from 'react'
import { authClient, signInDiscord } from '../lib/auth-client'

export default function Header() {
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('wlink:theme') !== 'light'
    } catch {
      return true
    }
  })
  const { data: session } = authClient.useSession()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('wlink:theme', dark ? 'dark' : 'light')
    } catch {}
  }, [dark])

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#0a0e17]/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          <img
            src="/wlink.png"
            alt=""
            className="size-8 rounded-lg shadow-lg shadow-sky-500/30"
          />
          wlink
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          <a
            href="/all"
            className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            All links
          </a>
          {session && (
            <a
              href="/my"
              className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
            >
              My links
            </a>
          )}
          <button
            onClick={() => setDark(!dark)}
            className="rounded-lg px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
          >
            Change theme
          </button>
        </nav>

        {session ? (
          <div className="flex items-center gap-2">
            {session.user.image && (
              <img src={session.user.image} alt="" className="size-7 rounded-full ring-1 ring-slate-200 dark:ring-white/20" />
            )}
            <span className="hidden text-sm text-slate-700 sm:block dark:text-slate-300">{session.user.name}</span>
          </div>
        ) : (
          <button
            onClick={signInDiscord}
            className="group flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-sky-400/40 dark:hover:bg-sky-400/10 dark:hover:text-sky-300"
          >
            Sign in
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        )}
      </div>
    </header>
  )
}
