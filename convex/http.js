import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
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
    const auth = String(req.headers["authorization"] || "");
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

    const userId = await ctx.runQuery(internal.links.extTokenUserId, { token });
    if (!userId) {
      return extJson({ error: "Invalid token. Regenerate it on the wlink site." }, 401);
    }

    // Rate limit (staff exempt via cached roles).
    const roles = await ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!(roles?.isStaff ?? false)) {
      const recent = await ctx.runQuery(internal.links.extCountRecentLinks, {
        userId,
        since: Date.now() - 60 * 60 * 1000,
      });
      const limit = roles?.isPremium ? 60 : EXT_RATE_LIMIT_PER_HOUR;
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
    });

    return extJson({ ok: true, slug, shortUrlPath: `/${slug}` });
  }),
});

export default http;
