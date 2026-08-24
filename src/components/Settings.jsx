import { useEffect, useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'

import { api } from '../../convex/_generated/api'
import { authClient, signInDiscord } from '../lib/auth-client'

const EXT_API_BASE = 'https://tangible-basilisk-706.eu-west-1.convex.site'

export default function Settings() {
  const { data: session, isPending } = authClient.useSession()
  const extToken = useQuery(api.links.getExtToken, session ? {} : 'skip')
  const ensureExtToken = useMutation(api.links.ensureExtToken)
  const rotateExtToken = useMutation(api.links.rotateExtToken)
  const myRolesAction = useAction(api.links.myRoles)
  const [isMod, setIsMod] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    if (!session) return
    myRolesAction()
      .then((roles) => {
        if (!alive) return
        setIsMod(roles.moderator)
        setIsPremium(roles.premium)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [session, myRolesAction])

  if (isPending) {
    return (
      <section className="border-t border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-black/20">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </div>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="border-t border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-black/20">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight">
            Profile{' '}
            <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">· settings</span>
          </h2>
          <div className="mt-8 flex flex-col items-start gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Sign in to view your settings and extension token.</p>
            <button
              onClick={signInDiscord}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[0.98]"
            >
              Login with Discord
            </button>
          </div>
        </div>
      </section>
    )
  }

  const copyToken = async () => {
    if (!extToken) return
    try {
      await navigator.clipboard.writeText(extToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 1500)
    } catch {}
  }

  return (
    <section className="border-t border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-black/20">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">
            Profile{' '}
            <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">· settings</span>
          </h2>
          <a href="/my" className="text-sm text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300">
            ← My links
          </a>
        </div>

        {/* Profile card */}
        <div className="mt-8 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
          {session.user.image && (
            <img
              src={session.user.image}
              alt=""
              className="size-14 rounded-full ring-1 ring-slate-200 dark:ring-white/20"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{session.user.name}</p>
            {session.user.email && (
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{session.user.email}</p>
            )}
            <div className="mt-1 flex gap-1.5">
              {isPremium && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300">
                  👑 Premium
                </span>
              )}
              {isMod && (
                <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300">
                  🛡️ Staff
                </span>
              )}
              {!isPremium && !isMod && (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  Free plan
                </span>
              )}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-rose-500 dark:text-rose-400">{error}</p>}

        {/* Extension token */}
        <h3 className="mt-10 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Chrome{' '}
          <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">extension</span>
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Shorten the page you're on straight from your browser toolbar. Load the <code className="rounded bg-slate-200 px-1 font-mono text-xs dark:bg-white/10">extension/</code> folder via <code className="rounded bg-slate-200 px-1 font-mono text-xs dark:bg-white/10">chrome://extensions</code> → Developer mode → Load unpacked, then paste this token into the extension.
        </p>
        <div className="mt-4 max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/60">
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Your extension token</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700 dark:bg-black/30 dark:text-slate-200">
              {extToken === undefined
                ? 'Loading…'
                : extToken
                  ? showToken
                    ? extToken
                    : `${extToken.slice(0, 8)}${'•'.repeat(24)}${extToken.slice(-8)}`
                  : 'No token yet'}
            </code>
            {extToken && (
              <>
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={copyToken}
                  className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  {tokenCopied ? 'Copied ✓' : 'Copy'}
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            {!extToken ? (
              <button
                onClick={() => ensureExtToken().catch((err) => setError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not create token.'))}
                className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110"
              >
                Create token
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm('Rotate token? The extension will stop working until you paste the new one.')) {
                    rotateExtToken().catch((err) => setError(err?.message?.replace(/^\[?ERROR\]?\s*/i, '') || 'Could not rotate token.'))
                  }
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
              >
                Rotate token
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
            API base for the extension: <code className="font-mono">{EXT_API_BASE}</code>
          </p>
        </div>
      </div>
    </section>
  )
}
