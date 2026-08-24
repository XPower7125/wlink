import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth, { cors: true });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
  });

http.route({
  pathPrefix: "/api/link/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const slug = new URL(req.url).pathname.slice("/api/link/".length);
    if (!/^[a-zA-Z0-9-]{1,40}$/.test(slug)) {
      return json({ error: "Invalid slug." }, 400);
    }
    const link = await ctx.runQuery(api.links.getBySlug, { slug });
    if (!link) {
      return json({ error: "Not found." }, 404);
    }
    return json({
      title: link.title,
      description: link.description,
      icon: link.icon ?? null,
      color: link.color ?? null,
      image: link.image ?? null,
      embedMode: link.embedMode ?? "wlink",
      url: link.url ?? null,
    });
  }),
});

// ── Chrome extension API ─────────────────────────────────────────────────
// POST /api/ext/shorten  { url, slug?, public? }  Authorization: Bearer <token>
const EXT_SLUG_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const EXT_RATE_LIMIT_PER_HOUR = 30;

const extJson = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });

http.route({
  path: "/api/ext/shorten",
  method: "OPTIONS",
  handler: httpAction(async () =>
    new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    })
  ),
});

http.route({
  path: "/api/ext/shorten",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // NOTE: req.headers is a Headers instance — use .get(), bracket access is always undefined.
    const auth = String(req.headers.get("authorization") || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!/^[0-9a-f]{32,128}$/.test(token)) {
      return extJson({ error: "Missing or invalid token." }, 401);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return extJson({ error: "Invalid JSON body." }, 400);
    }

    const url = String(body.url || "").trim();
    if (!url || url.length > 2048) {
      return extJson({ error: "URL is required (max 2048 chars)." }, 400);
    }
    if (!/^https?:\/\//i.test(url)) {
      return extJson({ error: "Only http(s) URLs are supported." }, 400);
    }

    let title = String(body.title || "").trim();
    if (!title) {
      title = url.replace(/^https?:\/\//i, "").split("/")[0] || url;
    }
    if (title.length > 120) title = title.slice(0, 120);

    const authInfo = await ctx.runQuery(internal.links.extAuthInfo, { token });
    if (!authInfo) {
      return extJson({ error: "Invalid token. Regenerate it on the wlink site." }, 401);
    }
    const userId = authInfo.userId;

    // Rate limit (staff exempt via cached roles).
    if (!authInfo.isStaff) {
      const recent = await ctx.runQuery(internal.links.extCountRecentLinks, {
        userId,
        since: Date.now() - 60 * 60 * 1000,
      });
      const limit = authInfo.isPremium ? 60 : EXT_RATE_LIMIT_PER_HOUR;
      if (recent >= limit) {
        return extJson({ error: `Rate limit reached: max ${limit} links per hour.` }, 429);
      }
    }

    // Slug: custom (validated) or random, collision-checked.
    const RESERVED = new Set(["api", "assets", "all", "my", "admin", "public", "static", "create", "signin", "signout", "settings", "profile"]);
    let slug = String(body.slug || "").trim().toLowerCase();
    if (slug) {
      if (!/^[a-z0-9-]{1,40}$/.test(slug) || RESERVED.has(slug)) {
        return extJson({ error: "Invalid or reserved alias." }, 400);
      }
      if (await ctx.runQuery(internal.links.extSlugExists, { slug })) {
        return extJson({ error: "That alias is already taken." }, 409);
      }
    } else {
      for (let attempt = 0; attempt < 5; attempt++) {
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        slug = [...bytes].map((b) => EXT_SLUG_ALPHABET[b % EXT_SLUG_ALPHABET.length]).join("");
        if (!(await ctx.runQuery(internal.links.extSlugExists, { slug }))) break;
        slug = "";
      }
      if (!slug) return extJson({ error: "Could not generate a slug, try again." }, 500);
    }

    await ctx.runMutation(internal.links.extInsertLink, {
      ownerId: userId,
      slug,
      url,
      title,
      public: Boolean(body.public),
    });

    return extJson({ ok: true, slug, shortUrlPath: `/${slug}` });
  }),
});

// ── agent-compatible public API (no auth, CORS-enabled, self-describing) ──
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const apiJson = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=15",
      ...CORS_HEADERS,
    },
  });

const apiText = (text, type = "text/plain; charset=utf-8") =>
  new Response(text, {
    status: 200,
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600", ...CORS_HEADERS },
  });

http.route({
  path: "/api/public",
  method: "GET",
  handler: httpAction(async () => {
    const base = process.env.SITE_URL || "https://wlink.vercel.app";
    const convexBase = (process.env.VITE_CONVEX_URL || "").replace(".convex.cloud", ".convex.site");
    return apiJson({
      name: "wlink public API",
      version: "1.0.0",
      description:
        "Agent-compatible REST API for wlink, a URL shortener. No auth needed for reads. Writes require a Bearer token from your wlink account.",
      base_url: convexBase,
      site: base,
      docs: {
        llms: `${convexBase}/llms.txt`,
        openapi: `${convexBase}/api/public/openapi.json`,
      },
      endpoints: {
        "GET /api/public": "This index.",
        "GET /api/public/links?limit=&offset=":
          "List public links (pinned/bumped first, then clicks). limit ≤ 100 (default 25). Returns { total, offset, limit, items[] }.",
        "GET /api/public/links/{slug}":
          "Metadata for one link incl. destination url. 404 for unknown, private, password-protected or expired links.",
        "GET /api/public/resolve/{slug}": "302 redirect to the destination of a public link.",
        "POST /api/ext/shorten": "Create a short link. Auth: Authorization: Bearer <token>. Body: { url, slug?, title?, public? }. Get a token at " + base + "/settings",
      },
      notes: [
        "All responses are JSON (except /llms.txt and /api/public/resolve).",
        "CORS: enabled for all origins on /api/public/* and /api/ext/*.",
        "Rate limits: 30 created links/hour (60 premium, unlimited staff).",
        "Password-protected and expired links are never exposed through this API.",
      ],
    });
  }),
});

http.route({
  path: "/api/public/links",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const params = new URL(req.url).searchParams;
    const limit = Number.parseInt(params.get("limit") ?? "25", 10);
    const offset = Number.parseInt(params.get("offset") ?? "0", 10);
    const result = await ctx.runQuery(api.links.listPublicApi, {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    return apiJson(result);
  }),
});

http.route({
  pathPrefix: "/api/public/links/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const slug = new URL(req.url).pathname.slice("/api/public/links/".length).toLowerCase();
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
      return apiJson({ error: "Invalid slug." }, 400);
    }
    const link = await ctx.runQuery(api.links.getBySlug, { slug });
    if (!link || link.requiresPassword || !link.url) {
      return apiJson({ error: "Not found." }, 404);
    }
    return apiJson({
      slug: link.slug,
      url: link.url,
      title: link.title,
      description: link.description,
      icon: link.icon ?? null,
      clicks: link.clicks,
      pinned: link.pinnedUntil != null || Boolean(link.pinnedPermanent),
      createdAt: link._creationTime,
    });
  }),
});

http.route({
  pathPrefix: "/api/public/resolve/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const slug = new URL(req.url).pathname.slice("/api/public/resolve/".length).toLowerCase();
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) {
      return apiJson({ error: "Invalid slug." }, 400);
    }
    const link = await ctx.runQuery(api.links.getBySlug, { slug });
    if (!link || link.requiresPassword || !link.url || !/^https?:\/\//i.test(link.url)) {
      return apiJson({ error: "Not found." }, 404);
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: link.url,
        "Cache-Control": "public, max-age=30",
        ...CORS_HEADERS,
      },
    });
  }),
});

http.route({
  path: "/api/public/openapi.json",
  method: "GET",
  handler: httpAction(async () => {
    const base = process.env.SITE_URL || "https://wlink.vercel.app";
    const convexBase = (process.env.VITE_CONVEX_URL || "").replace(".convex.cloud", ".convex.site");
    return apiJson({
      openapi: "3.1.0",
      info: {
        title: "wlink public API",
        version: "1.0.0",
        description: "Agent-compatible API for the wlink URL shortener.",
      },
      servers: [{ url: convexBase }],
      paths: {
        "/api/public": {
          get: { summary: "API index", operationId: "getIndex", responses: { "200": { description: "OK" } } },
        },
        "/api/public/links": {
          get: {
            summary: "List public links",
            operationId: "listLinks",
            parameters: [
              { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
              { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
            ],
            responses: { "200": { description: "OK" } },
          },
        },
        "/api/public/links/{slug}": {
          get: {
            summary: "Get link metadata",
            operationId: "getLink",
            parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9-]{1,40}$" } }],
            responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
          },
        },
        "/api/public/resolve/{slug}": {
          get: {
            summary: "Resolve a link (302 to destination)",
            operationId: "resolveLink",
            parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string", pattern: "^[a-z0-9-]{1,40}$" } }],
            responses: { "302": { description: "Redirect" }, "404": { description: "Not found" } },
          },
        },
        "/api/ext/shorten": {
          post: {
            summary: "Create a short link",
            operationId: "shorten",
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["url"],
                    properties: {
                      url: { type: "string", format: "uri" },
                      slug: { type: "string", pattern: "^[a-z0-9-]{1,40}$" },
                      title: { type: "string", maxLength: 120 },
                      public: { type: "boolean", default: false },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Created — returns { ok, slug, shortUrlPath }" },
              "401": { description: "Missing/invalid token" },
              "409": { description: "Alias taken" },
              "429": { description: "Rate limited" },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer" },
        },
      },
      "x-token-url": `${base}/settings`,
    });
  }),
});

http.route({
  path: "/llms.txt",
  method: "GET",
  handler: httpAction(async () => {
    const base = process.env.SITE_URL || "https://wlink.vercel.app";
    const convexBase = (process.env.VITE_CONVEX_URL || "").replace(".convex.cloud", ".convex.site");
    return apiText(`# wlink

> wlink is a free URL shortener with custom embeds, pinning, bumping, expiring links and QR codes.

Public short links look like ${base}/{slug}. This API base is ${convexBase}.

## Public API (no auth)

- GET ${convexBase}/api/public: machine-readable API index (JSON).
- GET ${convexBase}/api/public/links?limit={n}&offset={n}: list public links, sorted pinned → bumped → most clicks. Returns { total, offset, limit, items }.
- GET ${convexBase}/api/public/links/{slug}: metadata for one public link, including its destination url. 404 if unknown, private, password-protected or expired.
- GET ${convexBase}/api/public/resolve/{slug}: 302 redirect to the destination.
- GET ${convexBase}/api/public/openapi.json: OpenAPI 3.1 spec.

## Creating links (auth)

- POST ${convexBase}/api/ext/shorten
- Headers: Authorization: Bearer <token>, Content-Type: application/json
- Body: { "url": "https://example.com", "slug": "optional-custom-alias", "title": "optional", "public": false }
- Response 200: { "ok": true, "slug": "abc123", "shortUrlPath": "/abc123" }
- Tokens: sign in at ${base}, open ${base}/settings, create/copy a token.
- Rate limits: 30 links/hour free, 60 premium, unlimited staff.

## Rules

- Only http(s) URLs. Max 2048 chars.
- Slugs: lowercase letters, digits, hyphens, max 40 chars; some aliases are reserved.
- Password-protected and expired links are never exposed via the API.
`);
  }),
});

export default http;
