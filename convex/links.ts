import { v } from "convex/values";
import {
  action,
  internalQuery,
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { components } from "./_generated/api";
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

// ── moderator config ─────────────────────────────────────────────────────
// Members of this Discord guild holding this role may delete any link.
const MOD_GUILD_ID = "1541152238494552087";
const MOD_ROLE_ID = "1541154100576788580";

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
  "all",
  "my",
  "admin",
  "public",
  "static",
]);

function fail(msg) {
  throw new Error(msg);
}

// ── upstream helper (password-protected links feature) ────────────────
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
    // ── upstream feature: optional password protection ──────────────────
    password: v.optional(v.string()),
    public: v.boolean(),
  },
  handler: async (ctx, args) => {
    // ── FIX V1: require an authenticated session (was: completely absent).
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      fail("You must be signed in to create links.");
    }

    const slug = String(args.slug || "")
      .trim()
      .toLowerCase();

    // ── FIX V4: server-side validation (client checks are advisory only).
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

    // ── upstream feature: hash the optional password before storing.
    // (V4 note: cap its length too — a "password" is still untrusted input.)
    const password = args.password ? String(args.password).trim() : undefined;
    if (password !== undefined && password.length > 200) {
      fail("Password is too long.");
    }
    const passwordHash = password ? await sha256Hex(password) : undefined;

    // ── FIX V1b: rate limit — max creations per user per rolling hour.
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recent = await ctx.db
      .query("links")
      .filter((q) => q.eq(q.field("ownerId"), user._id))
      .filter((q) => q.gt(q.field("_creationTime"), oneHourAgo))
      .collect();
    if (recent.length >= RATE_LIMIT_PER_HOUR) {
      fail("Rate limit reached: max 10 links per hour.");
    }

    // ── FIX V1c: ownership-aware collision check against ALL links, so an
    // anonymous or other-user link can never be silently shadowed/hijacked.
    const existing = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing && existing.ownerId !== user._id) {
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
      passwordHash,
      ownerId: user._id,
      clicks: 0,
      public: Boolean(args.public),
    });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!link) return null;
    const { passwordHash, ...safe } = link;
    return {
      ...safe,
      url: passwordHash ? null : link.url,
      requiresPassword: Boolean(passwordHash),
    };
  },
});

// ── upstream feature: unlock query. NOTE (V2/V6 hardening): this hands the
// raw stored url to whoever supplies the right password; the CLIENT must keep
// validating the scheme before navigating (see Redirector isSafeDestination).
export const unlock = query({
  args: { slug: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!link) return { url: null };
    if (!link.passwordHash) return { url: link.url };
    const hash = await sha256Hex(args.password);
    return { url: hash === link.passwordHash ? link.url : null };
  },
});

// Click counting moved behind internalMutation so clients can't inflate it
// directly (V5 companion: no public write surface on ranking counters).
export const incrementClicks = internalMutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const link = await ctx.db.get(id);
    if (!link) return;
    await ctx.db.patch(id, { clicks: link.clicks + 1 });
  },
});

// Public click recording: called by the client right before it navigates to
// the destination. Anyone can inflate this in principle, but it's the only
// viable signal since redirects happen browser-side (bots never run the SPA).
export const recordClick = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!link) return;
    await ctx.db.patch(link._id, { clicks: link.clicks + 1 });
  },
});

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    return links
      .filter((l) => l.public && !l.passwordHash)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 6)
      .map(({ passwordHash, ...safe }) => safe);
  },
});

export const listAllPublic = query({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("links").collect();
    return links
      .filter((l) => l.public && !l.passwordHash)
      .sort((a, b) => b.clicks - a.clicks)
      .map(({ passwordHash, ...safe }) => safe);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];
    const links = await ctx.db
      .query("links")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return links
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(({ passwordHash, ...safe }) => ({
        ...safe,
        requiresPassword: Boolean(passwordHash),
      }));
  },
});

// Shared field validation for create/update so edits can't bypass the
// same limits creation enforces.
async function validateFields(args) {
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

  return { url, title, description, icon, color, image };
}

export const updateLink = mutation({
  args: {
    id: v.id("links"),
    url: v.string(),
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    // Required on update so an empty string explicitly clears the field.
    color: v.string(),
    image: v.string(),
    // undefined = keep current password, "" = remove it, non-empty = set it
    password: v.optional(v.string()),
    public: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) fail("You must be signed in to edit links.");

    const link = await ctx.db.get(args.id);
    if (!link) fail("Link not found.");
    if (link.ownerId !== user._id) {
      fail("You can only edit your own links.");
    }

    const fields = await validateFields(args);

    let passwordHash = link.passwordHash;
    const password = args.password;
    if (password !== undefined) {
      const trimmed = password.trim();
      if (trimmed === "") {
        passwordHash = undefined;
      } else {
        if (trimmed.length > 200) fail("Password is too long.");
        passwordHash = await sha256Hex(trimmed);
      }
    }

    await ctx.db.patch(args.id, {
      ...fields,
      passwordHash,
      public: Boolean(args.public),
    });
  },
});

export const removeLink = mutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) fail("You must be signed in to delete links.");

    const link = await ctx.db.get(id);
    if (!link) return;
    if (link.ownerId !== user._id) {
      fail("You can only delete your own links.");
    }

    await ctx.db.delete(id);
  },
});

// ── moderator support ────────────────────────────────────────────────────

// Look up the caller's Discord account id from the better-auth account table.
async function getDiscordAccountId(ctx, authUserId: string): Promise<string | null> {
  const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "userId", operator: "eq", value: authUserId },
      { field: "providerId", operator: "eq", value: "discord" },
    ],
  });
  return account?.accountId ?? null;
}

// True if the user holds the moderator role in the configured Discord guild.
// Requires DISCORD_BOT_TOKEN (bot must be a member of MOD_GUILD_ID).
async function hasModRole(ctx, authUserId: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return false;
  try {
    const discordId = await getDiscordAccountId(ctx, authUserId);
    if (!discordId) return false;
    const r = await fetch(
      `https://discord.com/api/v10/guilds/${MOD_GUILD_ID}/members/${discordId}`,
      { headers: { Authorization: `Bot ${token}` }, cache: "no-store" },
    );
    if (!r.ok) return false; // 404 → not in guild; 401/403 → bad token
    const member = await r.json();
    return Array.isArray(member?.roles) && member.roles.includes(MOD_ROLE_ID);
  } catch {
    return false;
  }
}

export const amModerator = action({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return false;
    return hasModRole(ctx, user._id);
  },
});

export const getLinkById = internalQuery({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => ctx.db.get(id),
});

export const getAllLinksInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("links").collect();
    return docs
      .sort((a, b) => b._creationTime - a._creationTime)
      .map(({ passwordHash, ...safe }) => ({
        ...safe,
        requiresPassword: Boolean(passwordHash),
      }));
  },
});

// Moderators can list every link (e.g. for the admin view of My Links).
export const listAllAsModerator = action({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return [];
    if (!(await hasModRole(ctx, user._id))) return [];
    return ctx.runQuery(internal.links.getAllLinksInternal);
  },
});

export const removeLinkInternal = internalMutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

// Delete as owner OR as Discord moderator. Actions run outside transactions,
// so the ownership/permission check happens here and the delete itself is an
// internal mutation.
export const moderatorDelete = action({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const link = await ctx.runQuery(internal.links.getLinkById, { id });
    if (!link) return;

    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) fail("You must be signed in to delete links.");

    if (link.ownerId !== user._id) {
      const isMod = await hasModRole(ctx, user._id);
      if (!isMod) fail("You can only delete your own links.");
    }

    await ctx.runMutation(internal.links.removeLinkInternal, { id });
  },
});
