import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// F1c fix: only follow http(s) destinations, never attacker-chosen schemes
// like javascript:, data:, or vbscript:. Applied to BOTH navigation paths
// below — the plain link and the password-unlocked one.
function isSafeDestination(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Redirector({ slug }) {
  const link = useQuery(api.links.getBySlug, { slug });
  const recordClick = useMutation(api.links.recordClick);
  const [password, setPassword] = useState("");
  const [attempt, setAttempt] = useState(null);
  const unlocked = useQuery(
    api.links.unlock,
    attempt ? { slug, password: attempt } : { slug, password: "" },
  );

  useEffect(() => {
    // V6 fix: scheme-check before navigating (plain links only).
    if (link && !link.requiresPassword && isSafeDestination(link.url)) {
      recordClick({ slug }).catch(() => {});
      window.location.replace(link.url);
    }
  }, [link, slug, recordClick]);

  useEffect(() => {
    // V6 fix: same guard on the unlocked destination.
    if (unlocked?.url && isSafeDestination(unlocked.url)) {
      recordClick({ slug }).catch(() => {});
      window.location.replace(unlocked.url);
    }
  }, [unlocked, slug, recordClick]);

  const redirectText = link.redirectText?.trim() || "Redirecting…";

  if (link === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">{redirectText}</p>
      </div>
    );
  }

  if (link === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-slate-500 dark:text-slate-400">Link not found.</p>
      </div>
    );
  }

  if (link.requiresPassword) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAttempt(password);
          }}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-2xl dark:shadow-black/40"
        >
          <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            🔒 Password required
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This link is protected. Enter the password to continue.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 dark:border-white/10 dark:bg-black/30 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:brightness-110 active:scale-[0.99]"
          >
            Unlock →
          </button>
          {attempt !== null && unlocked === undefined && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Checking…</p>
          )}
          {attempt !== null && unlocked?.url === null && (
            <p className="mt-3 text-sm text-rose-500 dark:text-rose-400">Incorrect password.</p>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-slate-500 dark:text-slate-400">{redirectText}</p>
    </div>
  );
}
