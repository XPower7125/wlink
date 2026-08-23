import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";

const SLUG_RE = /^[a-z0-9-]{1,40}$/;
const HTTP_URL_RE = /^https?:\/\//i;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
// eslint-disable-next-line no-control-regex
const CTRL_RE = /[\u0000-\u001f\u007f]/;

const MAX_LEN = {
  url: 2048,
  title: 120,
  description: 300,
  image: 2048,
};

const RATE_LIMIT_PER_HOUR = 10;

// Reserved slugs so short links can't shadow app routes/assets.
const RESERVED = new Set([
  "api",
  "assets",
  "favicon.svg",
  "favicon.png",
  "wlink.png",
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "signin",
  "signout",
  "login",
  "logout",
  "create",
  "admin",
  "public",
  "static",
]);

function fail(msg) {
  throw new Error(msg);
}

export const createLink = mutation({
  args: {
    slug: v.string(),
    url: v.string(),
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.optional(v.string()),
    image: v.optional(v.string()),
    public: v.boolean(),
  },
  handler: async (ctx, args) => {
    // ── FIX F1a: require an authenticated session (was: completely absent).
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      fail("You must be signed in to create links.");
    }

    const slug = String(args.slug || "")
      .trim()
      .toLowerCase();

    // ── FIX F1b: server-side validation (client checks are advisory only).
    if (!SLUG_RE.test(slug)) {
      fail("Alias can only contain lowercase letters, numbers and hyphens (max 40).");
    }
    if (RESERVED.has(slug)) {
      fail("That alias is reserved.");
    }

    const url = String(args.url || "").trim();
    if (!url) fail("URL is required.");
    if (url.length > MAX_LEN.url) fail("URL is too long.");
    if (!HTTP_URL_RE.test(url)) fail("Only http(s) URLs are supported.");

    let title = String(args.title || "").trim();
    if (!title) {
      title = url.replace(/^https?:\/\//i, "").split("/")[0] || url;
    }
    if (title.length > MAX_LEN.title) fail("Title is too long.");
    if (CTRL_RE.test(title)) fail("Title contains invalid characters.");

    const description =
      String(args.description || "").trim() || "No description provided.";
    if (description.length > MAX_LEN.description) {
      fail("Description is too long.");
    }
    if (CTRL_RE.test(description)) {
      fail("Description contains invalid characters.");
    }

    const icon = String(args.icon || "").trim() || "\u{1F517}";
    if ([...icon].length > 4) fail("Icon must be at most 4 characters.");
    if (CTRL_RE.test(icon)) fail("Icon contains invalid characters.");

    const color = args.color ? String(args.color).trim() : undefined;
    if (color !== undefined && !HEX_COLOR_RE.test(color)) {
      fail("Color must be a hex value like #38bdf8.");
    }

    const image = args.image ? String(args.image).trim() : undefined;
    if (image !== undefined && image.length > MAX_LEN.image) {
      fail("Image URL is too long.");
    }
    if (image !== undefined && !HTTP_URL_RE.test(image)) {
      fail("Image must be an http(s) URL.");
    }

    // ── FIX F2b: rate limit — max creations per user per rolling hour.
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recent = await ctx.db
      .query("links")
      .filter((q) => q.eq(q.field("ownerId"), user.id))
      .filter((q) => q.gt(q.field("_creationTime"), oneHourAgo))
      .collect();
    if (recent.length >= RATE_LIMIT_PER_HOUR) {
      fail("Rate limit reached: max 10 links per hour.");
    }

    // ── FIX F1c: ownership-aware collision check against ALL links, so an
    // anonymous or other-user link can never be silently shadowed/hijacked.
    const existing = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing && existing.ownerId !== user.id) {
      fail("That alias is already taken. Please choose another.");
    }

    await ctx.db.insert("links", {
      slug,
      url,
      title,
      description,
      icon,
      color,
      image,
      ownerId: user.id,
      clicks: 0,
      public: Boolean(args.public),
    });
  },
});

// Click counting moved behind internalMutation so clients can't inflate it
// directly (F2b companion: no public write surface on ranking counters).
export const incrementClicks = internalMutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const link = await ctx.db.get(id);
    if (!link) return;
    await ctx.db.patch(id, { clicks: link.clicks + 1 });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    return links
      .filter((l) => l.public)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6);
  },
});
