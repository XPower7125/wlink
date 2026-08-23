const BOT_RE =
  /(discordbot|twitterbot|telegrambot|slackbot|facebookexternalhit|linkedinbot|whatsapp|embedly|quora link preview|vkshare|applebot|googlebot|bingbot|yandexbot|petalbot)/i;

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ── FIX V7: baseline hardening headers on every response we render.
// The embed page is bot-facing HTML built from user input; a restrictive
// default-src plus nosniff bounds the blast radius of any future escaping
// bug (and would have blunted the javascript:-URI redirect, see report V6).
function hardenedHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'"
  );
}

// ── FIX V2 ─────────────────────────────────────────────────────────────
// Never build absolute URLs from the client-supplied Host header. An
// attacker who can set Host (direct-to-origin requests, cache poisoning,
// hostile proxies) could otherwise make wlink render *its* URLs inside
// wlink's trusted embed pages. Origins are pinned via environment config;
// anything unrecognised is answered with the canonical origin anyway.
const DEFAULT_ORIGIN = "https://wlink.vercel.app";

function configuredOrigins() {
  return (process.env.EMBED_ORIGINS || process.env.SITE_URL || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .map((s) => {
      // Accept both bare origins and full URLs.
      if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
      return s.replace(/\/+$/, "");
    });
}

function resolveOrigin(hostHeader) {
  const allowed = configuredOrigins();
  if (allowed.length === 0) return DEFAULT_ORIGIN;
  const host = String(hostHeader || "").toLowerCase();
  for (const origin of allowed) {
    try {
      if (new URL(origin).host === host) return origin;
    } catch {}
  }
  // Unknown/poisoned Host → canonical origin wins, always.
  return allowed[0];
}

async function fetchLink(slug) {
  const base = process.env.VITE_CONVEX_URL;
  if (!base) return null;
  try {
    const siteUrl = base.replace(".convex.cloud", ".convex.site");
    const r = await fetch(`${siteUrl}/api/link/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || "");
  if (!/^[a-zA-Z0-9-]{1,40}$/.test(slug) || slug === "all" || slug === "my") {
    // Not a short link; let the SPA handle it (e.g. /favicon.svg falls through to filesystem anyway).
    return proxyIndex(req, res);
  }

  const ua = String(req.headers["user-agent"] || "");

  if (!BOT_RE.test(ua)) {
    return proxyIndex(req, res);
  }

  // FIX V2: origin resolved from pinned config, never from req Host alone.
  const siteOrigin = resolveOrigin(req.headers.host);
  const shortUrl = `${siteOrigin}/${slug}`;
  const link = await fetchLink(slug);

  if (!link) {
    hardenedHeaders(res);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(404).send(
      `<!doctype html><html><body><p>Link not found. <a href="${escapeHtml(shortUrl)}">${escapeHtml(shortUrl)}</a></p></body></html>`
    );
  }

  const title = `${link.icon ? link.icon + " " : ""}${link.title}`.slice(0, 256);
  const description = (link.description || "").slice(0, 512);
  const color =
    typeof link.color === "string" && /^#[0-9a-fA-F]{6}$/.test(link.color)
      ? link.color
      : "#38bdf8";
  const image =
    typeof link.image === "string" && /^https?:\/\//i.test(link.image)
      ? link.image
      : null;

  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${escapeHtml(shortUrl)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta name="theme-color" content="${color}">`,
    description &&
      `<meta property="og:description" content="${escapeHtml(description)}">`,
    image && `<meta property="og:image" content="${escapeHtml(image)}">`,
    image
      ? `<meta name="twitter:card" content="summary_large_image">`
      : `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    description &&
      `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image && `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ]
    .filter(Boolean)
    .join("\n    ");

  hardenedHeaders(res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.status(200).send(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="canonical" href="${escapeHtml(shortUrl)}">
    ${tags}
<title>${escapeHtml(title)}</title>
</head>
<body>
<p>${escapeHtml(title)} — <a href="${escapeHtml(shortUrl)}">${escapeHtml(shortUrl)}</a></p>
</body>
</html>`
  );
}

async function proxyIndex(req, res) {
  // NOTE: no hardenedHeaders here. The restrictive embed CSP
  // (default-src 'none') is meant for the bot-facing HTML we render from
  // user input. The SPA shell is build-output served verbatim (identical to
  // what Vercel serves at /), and its scripts/styles would be blocked by
  // that policy — which broke every human-served app route like /all.
  // FIX V2 still applies: serve from the pinned origin, not the raw Host.
  const origin = resolveOrigin(req.headers.host);
  try {
    const r = await fetch(`${origin}/index.html`, { cache: "no-store" });
    const html = await r.text();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    return res.status(200).send(html);
  } catch {
    return res.status(500).send("Upstream error");
  }
}
