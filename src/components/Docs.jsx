const CODE_CLS =
  'mt-2 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200 dark:bg-black/50'

function Code({ children }) {
  return <pre className={CODE_CLS}>{children}</pre>
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  )
}

function Endpoint({ method, path, auth, children }) {
  const color =
    method === 'GET'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
      : 'bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${color}`}>{method}</span>
        <code className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{path}</code>
        {auth && (
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            🔑 Bearer token
          </span>
        )}
      </div>
      <div className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  )
}

const API_BASE = 'https://tangible-basilisk-706.eu-west-1.convex.site'
const SITE = typeof window !== 'undefined' ? window.location.origin : 'https://wlink.vercel.app'

export default function Docs() {
  return (
    <section className="border-t border-slate-200 bg-slate-100 dark:border-white/5 dark:bg-black/20">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          wlink{' '}
          <span className="bg-gradient-to-r from-sky-400 to-blue-600 bg-clip-text text-transparent">documentation</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Everything about using wlink — the site, the public agent API and the Chrome extension.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2 text-xs">
          {[
            ['basics', 'Basics'],
            ['features', 'Features'],
            ['api', 'Public API'],
            ['auth', 'Authentication'],
            ['embeds', 'Embeds'],
            ['extension', 'Chrome extension'],
            ['limits', 'Limits'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium text-slate-600 transition hover:border-sky-400/40 hover:text-sky-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-sky-300"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-12">
          <Section id="basics" title="Basics">
            <p>
              wlink turns long URLs into short links like <code className="font-mono">{SITE}/abc123</code>. Create links
              from the home page (sign in with Discord), manage them under <a className="text-sky-600 dark:text-sky-300" href="/my">My links</a>, and
              configure your account under <a className="text-sky-600 dark:text-sky-300" href="/settings">Settings</a>.
            </p>
            <p>
              Every link can be private (default) or listed publicly. Public links appear on the home page and the{' '}
              <a className="text-sky-600 dark:text-sky-300" href="/all">All links</a> page, sorted: pinned first, recently bumped next, then by
              clicks.
            </p>
          </Section>

          <Section id="features" title="Features">
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Custom embeds</strong> — pick the title, description, color and image shown when your link is shared on Discord/X/Slack.</li>
              <li><strong>Stock embeds</strong> — or let the destination site's own preview be used instead.</li>
              <li><strong>QR codes</strong> — every link has a scannable QR with PNG download.</li>
              <li><strong>Pinning</strong> (premium) — keep a link at the top of public listings for 30m–6h; staff can pin permanently (blue glow).</li>
              <li><strong>Bumping</strong> — everyone can boost a link back to the top once the cooldown ends (1h premium / 3h free, counted after the boost ends). Premium can pick a 30m/1h/2h boost.</li>
              <li><strong>Expiring links</strong> — 1h–6h free for everyone; 30m, 12h, 1d, 2d, 7d are premium. Expired links stop resolving and disappear from listings.</li>
              <li><strong>Password protection</strong> — require a password before the redirect happens.</li>
              <li><strong>Premium styling</strong> — custom redirect text, solid or gradient title colors.</li>
            </ul>
          </Section>

          <Section id="api" title="Public API (agent-compatible)">
            <p>
              A self-describing REST API for reading public data and creating links. Base URL:
            </p>
            <Code>{API_BASE}</Code>
            <p>Machine-readable discovery: <code className="font-mono">GET /api/public</code> (JSON index), <code className="font-mono">GET /api/public/openapi.json</code> (OpenAPI 3.1) and <code className="font-mono">GET /llms.txt</code> (agent primer).</p>

            <Endpoint method="GET" path="/api/public">
              <p>JSON index of every endpoint, with auth notes and rate limits. Start here.</p>
            </Endpoint>

            <Endpoint method="GET" path="/api/public/links?limit=25&offset=0">
              <p>Paginated public links, pinned → bumped → most clicks. Returns:</p>
              <Code>{`{
  "total": 4,
  "offset": 0,
  "limit": 25,
  "items": [
    { "slug": "discord", "url": "https://discord.gg/…", "title": "Discord",
      "description": "…", "icon": "💬", "clicks": 42,
      "pinned": true, "pinnedPermanent": false, "bumped": false,
      "createdAt": 1787560953718 }
  ]
}`}</Code>
              <p><code className="font-mono">limit</code> max 100 (default 25). Use <code className="font-mono">offset</code> to page.</p>
            </Endpoint>

            <Endpoint method="GET" path="/api/public/links/{slug}">
              <p>Metadata for one public link, including its destination <code className="font-mono">url</code>. Returns 404 for unknown, private, password-protected or expired links.</p>
            </Endpoint>

            <Endpoint method="GET" path="/api/public/resolve/{slug}">
              <p>302 redirect to the destination. Handy for one-shot scripts.</p>
            </Endpoint>
          </Section>

          <Section id="auth" title="Authentication & creating links">
            <p>
              Writes use a per-account Bearer token. Get yours at{' '}
              <a className="text-sky-600 dark:text-sky-300" href="/settings">Settings → Chrome extension → Create token</a>. Rotate it any time; the old
              token stops working immediately.
            </p>
            <Endpoint method="POST" path="/api/ext/shorten" auth>
              <p>Body (JSON):</p>
              <Code>{`{
  "url": "https://example.com/very/long/path",  // required, http(s), ≤2048 chars
  "slug": "my-alias",                            // optional custom alias
  "title": "Optional title",                     // optional, defaults to the domain
  "public": false                                // optional, list publicly
}`}</Code>
              <p>Response:</p>
              <Code>{`{ "ok": true, "slug": "abc123", "shortUrlPath": "/abc123" }`}</Code>
              <p>Example:</p>
              <Code>{`curl -X POST ${API_BASE}/api/ext/shorten \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}'`}</Code>
              <p>Errors: <code className="font-mono">401</code> bad token · <code className="font-mono">409</code> alias taken · <code className="font-mono">429</code> rate limited · <code className="font-mono">400</code> validation.</p>
            </Endpoint>
          </Section>

          <Section id="embeds" title="Embeds">
            <p>
              When a bot (Discord, X, Slack, WhatsApp…) fetches your short link, wlink answers with a preview page. Two
              modes, selectable per link in the create/edit form:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong>Custom embed</strong> — built from your stored title, description, embed color and image. Premium styling (redirect text, title colors) applies to listings.</li>
              <li><strong>Stock embed</strong> — bots are redirected to the destination so the destination site's own Open Graph preview is shown instead.</li>
            </ul>
            <p>Password-protected links always use the custom embed; their destination is never exposed to bots.</p>
          </Section>

          <Section id="extension" title="Chrome extension">
            <p>
              The <code className="font-mono">extension/</code> folder in the repo is a Manifest V3 extension that shortens
              the page you're on from the toolbar.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Open <code className="font-mono">chrome://extensions</code>, enable Developer mode, click <em>Load unpacked</em>, select the <code className="font-mono">extension/</code> folder.</li>
              <li>Copy your token from <a className="text-sky-600 dark:text-sky-300" href="/settings">Settings</a>.</li>
              <li>Right-click the extension icon → Options → paste the token → Save.</li>
              <li>Click the icon on any page → <strong>Shorten this page ✨</strong>. Copy, open or grab a QR.</li>
            </ol>
          </Section>

          <Section id="limits" title="Limits & rules">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Only <code className="font-mono">http(s)</code> URLs, max 2048 characters.</li>
              <li>Slugs: lowercase letters, digits, hyphens, max 40 chars; app routes are reserved.</li>
              <li>Creation rate limits: 10/hour free · 25/hour premium via the site · 30/hour free · 60/hour premium via the API · unlimited for staff.</li>
              <li>Bump: once per cooldown (1h premium / 3h free after the boost ends); boost 1h default, 30m/2h premium.</li>
              <li>Pin: 30m–6h with a 6h cooldown after unpinning; staff unlimited + permanent.</li>
              <li>Passwords are stored as SHA-256 hashes; destination URLs of protected links are never exposed publicly.</li>
            </ul>
          </Section>
        </div>
      </div>
    </section>
  )
}
