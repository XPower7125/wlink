const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export default async function handler(req, res) {
  const slug = String(req.query.slug || "");
  if (!/^[a-zA-Z0-9-]{1,40}$/.test(slug)) {
    return res.status(404).send("Not found");
  }

  const base = process.env.VITE_CONVEX_URL;
  let link = null;
  if (base) {
    try {
      const siteUrl = base.replace(".convex.cloud", ".convex.site");
      const r = await fetch(`${siteUrl}/api/link/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (r.ok) link = await r.json();
    } catch {}
  }

  const siteOrigin = `https://${req.headers.host || "wlink.vercel.app"}`;
  const shortUrl = `${siteOrigin}/${slug}`;

  if (!link) {
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
    image &&
      `<meta name="twitter:card" content="summary_large_image">`,
    !image && `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    description &&
      `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    image && `<meta name="twitter:image" content="${escapeHtml(image)}">`,
  ]
    .filter(Boolean)
    .join("\n    ");

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${escapeHtml(shortUrl)}">
<link rel="canonical" href="${escapeHtml(shortUrl)}">
    ${tags}
<title>${escapeHtml(title)}</title>
</head>
<body>
<p>${escapeHtml(title)} — <a href="${escapeHtml(shortUrl)}">${escapeHtml(shortUrl)}</a></p>
<script>location.replace(${JSON.stringify(shortUrl)})</script>
</body>
</html>`
  );
}
