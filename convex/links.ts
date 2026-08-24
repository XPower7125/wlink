import { v } from "convex/values";
import {
  action,
  internalQuery,
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { components, internal } from "./_generated/api";
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
  redirectText: 120,
};

const RATE_LIMIT_PER_HOUR = 10;
const PREMIUM_RATE_LIMIT_PER_HOUR = 25;

// ── expiring links: 1h–6h free for everyone, the rest premium ────────────
export const EXPIRY_DURATIONS_MS: Record<string, number> = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "2d": 2 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const FREE_EXPIRY_DURATIONS: Record<string, true> = {
  "1h": true,
  "2h": true,
  "3h": true,
  "6h": true,
};

function isExpired(link: any, now = Date.now()): boolean {
  return link.expiresAt != null && link.expiresAt <= now;
}

// ── moderator config ─────────────────────────────────────────────────────
// Members of this Discord guild holding these roles get special powers.
const MOD_GUILD_ID = "1541152238494552087";
const MOD_ROLE_ID = "1541154100576788580";
const PREMIUM_ROLE_ID = "1541154192574390402";

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
    // ── embed style: "wlink" (custom) or "stock" (destination's own embed) ──
    embedMode: v.optional(v.string()),
    // ── premium early access: expiry selector ("30m" … "7d") ───────────
    expiresIn: v.optional(v.string()),
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
    // Staff have no limit; premium get 25/hr, others 10/hr. Roles are cached
    // in userRoles (updated by myRoles action) because mutations can't fetch Discord.
    const rolesDoc = await ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const isStaffCached = rolesDoc?.isStaff ?? false;
    const isPremiumCached = rolesDoc?.isPremium ?? false;

    // Expiring links: 1h–6h free, the rest premium. Staff exempt from gates.
    let expiresAt: number | undefined;
    if (args.expiresIn !== undefined && args.expiresIn !== "") {
      const key = String(args.expiresIn);
      const ms = EXPIRY_DURATIONS_MS[key];
      if (!ms) fail("Invalid expiry duration.");
      const freeExpiry = key in FREE_EXPIRY_DURATIONS;
      if (!freeExpiry && !(isStaffCached || isPremiumCached)) {
        fail("That expiry duration is a premium feature.");
      }
      expiresAt = Date.now() + ms;
    }

    if (!isStaffCached) {
      const limit = isPremiumCached ? PREMIUM_RATE_LIMIT_PER_HOUR : RATE_LIMIT_PER_HOUR;
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recent = await ctx.db
        .query("links")
        .filter((q) => q.eq(q.field("ownerId"), user._id))
        .filter((q) => q.gt(q.field("_creationTime"), oneHourAgo))
        .collect();
      if (recent.length >= limit) {
        fail(`Rate limit reached: max ${limit} links per hour${isPremiumCached ? " (premium)" : ""}.`);
      }
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

    const embedMode = args.embedMode === "stock" ? "stock" : "wlink";

    return ctx.db.insert("links", {
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
      expiresAt,
      embedMode,
    });
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = String(args.slug || "").toLowerCase();
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!link) return null;
    if (isExpired(link)) return null; // expired links stop resolving
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
    const slug = String(args.slug || "").toLowerCase();
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!link || isExpired(link)) return { url: null };
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
    const normSlug = String(slug || "").toLowerCase();
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", normSlug))
      .unique();
    if (!link) return;
    await ctx.db.patch(link._id, { clicks: link.clicks + 1 });
  },
});

// ── bump links: boost 30m/1h/2h (duration choice is premium) ────────────
// Cooldown starts once the boost ends: premium can bump again after 1h,
// free users after 3h, staff have no limits.
const PREMIUM_BUMP_COOLDOWN_MS = 60 * 60 * 1000;
const FREE_BUMP_COOLDOWN_MS = 3 * 60 * 60 * 1000;
export const BUMP_DURATIONS_MS = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
} as const;
// Existing bumps did not record their expiry, so preserve their original 1h boost.
export const BUMP_BOOST_MS = BUMP_DURATIONS_MS["1h"];

// Everyone can bump their own link. Premium members can choose a longer boost;
// cached roles are used because mutations cannot fetch Discord live.
export const bumpLink = mutation({
  args: {
    slug: v.string(),
    duration: v.optional(v.union(v.literal("30m"), v.literal("1h"), v.literal("2h"))),
  },
  handler: async (ctx, { slug, duration }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) fail("You must be signed in to bump links.");

    const rolesDoc = await ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const isStaff = rolesDoc?.isStaff ?? false;
    const isPremium = rolesDoc?.isPremium ?? false;
    const selectedDuration = duration ?? "1h";
    if (duration !== undefined && !(isStaff || isPremium)) {
      fail("Choosing a bump duration is a premium feature.");
    }

    const normSlug = String(slug || "").toLowerCase();
    const link = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", normSlug))
      .unique();
    if (!link) fail("Link not found.");
    if (link.ownerId !== user._id) fail("You can only bump your own links.");

    const now = Date.now();
    // Cooldown starts when the previous boost ends.
    if (!isStaff && link.bumpedAt != null) {
      const boostEnd = link.bumpBoostUntil ?? link.bumpedAt + BUMP_BOOST_MS;
      const cooldownMs = isPremium ? PREMIUM_BUMP_COOLDOWN_MS : FREE_BUMP_COOLDOWN_MS;
      const readyAt = boostEnd + cooldownMs;
      if (now < readyAt) {
        const minsLeft = Math.ceil((readyAt - now) / 60000);
        const h = Math.floor(minsLeft / 60);
        const m = minsLeft % 60;
        fail(`Already bumped — try again in ${h > 0 ? `${h}h ${m}m` : `${m}m`}.`);
      }
    }

    const bumpBoostUntil = now + BUMP_DURATIONS_MS[selectedDuration];
    await ctx.db.patch(link._id, { bumpedAt: now, bumpBoostUntil });
    return { bumpedAt: now, bumpBoostUntil };
  },
});

function sortPinnedFirst(a: any, b: any, now: number): number {
  const aPinned = isPinned(a, now) ? 1 : 0;
  const bPinned = isPinned(b, now) ? 1 : 0;
  if (aPinned !== bPinned) return bPinned - aPinned;
  return 0;
}

// Recently bumped links float above non-bumped ones (below pins) until the
// selected duration expires. Existing bumps fall back to the former 1h window.
function sortBumpedFirst(a: any, b: any, now: number): number {
  const aBumped = a.bumpedAt != null && (a.bumpBoostUntil ?? a.bumpedAt + BUMP_BOOST_MS) > now ? a.bumpedAt : 0;
  const bBumped = b.bumpedAt != null && (b.bumpBoostUntil ?? b.bumpedAt + BUMP_BOOST_MS) > now ? b.bumpedAt : 0;
  return bBumped - aBumped;
}

export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const links = await ctx.db.query("links").collect();
    return links
      .filter((l) => l.public && !l.passwordHash && !isExpired(l, now))
      .sort((a, b) => {
        const pinCmp = sortPinnedFirst(a, b, now);
        if (pinCmp !== 0) return pinCmp;
        const bumpCmp = sortBumpedFirst(a, b, now);
        if (bumpCmp !== 0) return bumpCmp;
        return b.clicks - a.clicks;
      })
      .map(({ passwordHash, ...safe }) => safe);
  },
});

export const listAllPublic = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const links = await ctx.db.query("links").collect();
    return links
      .filter((l) => l.public && !l.passwordHash)
      .sort((a, b) => {
        const pinCmp = sortPinnedFirst(a, b, now);
        if (pinCmp !== 0) return pinCmp;
        return b.clicks - a.clicks;
      })
      .map(({ passwordHash, ...safe }) => safe);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];
    const now = Date.now();
    const links = await ctx.db
      .query("links")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
    return links
      .sort((a, b) => {
        const pinCmp = sortPinnedFirst(a, b, now);
        if (pinCmp !== 0) return pinCmp;
        return b._creationTime - a._creationTime;
      })
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
    // ── embed style: "wlink" (custom) or "stock" (destination's own embed) ──
    embedMode: v.optional(v.string()),
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
      embedMode: args.embedMode === "stock" ? "stock" : "wlink",
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

// True if the user holds the given role in the configured Discord guild.
// Requires DISCORD_BOT_TOKEN (bot must be a member of MOD_GUILD_ID).
async function hasGuildRole(
  ctx,
  authUserId: string,
  roleId: string,
): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return false;
  try {
    const discordId = await getDiscordAccountId(ctx, authUserId);
    if (!discordId) return false;
    const r = await fetch(
      `https://discord.com/api/v10/guilds/${MOD_GUILD_ID}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) return false; // 404 → not in guild; 401/403 → bad token
    const member = await r.json();
    return Array.isArray(member?.roles) && member.roles.includes(roleId);
  } catch {
    return false;
  }
}

async function hasModRole(ctx, authUserId: string): Promise<boolean> {
  return hasGuildRole(ctx, authUserId, MOD_ROLE_ID);
}

async function hasPremiumRole(ctx, authUserId: string): Promise<boolean> {
  return hasGuildRole(ctx, authUserId, PREMIUM_ROLE_ID);
}

export const getUserRoleInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
});

export const upsertUserRoleInternal = internalMutation({
  args: { userId: v.string(), isPremium: v.boolean(), isStaff: v.boolean(), updatedAt: v.number() },
  handler: async (ctx, { userId, isPremium, isStaff, updatedAt }) => {
    const existing = await ctx.db
      .query("userRoles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { isStaff, isPremium, updatedAt });
    else await ctx.db.insert("userRoles", { userId, isPremium, isStaff, updatedAt });
  },
});

// Returns the caller's Discord-derived privileges in one call.
export const myRoles = action({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) return { moderator: false, premium: false };
    const [moderator, premium] = await Promise.all([
      hasModRole(ctx, user._id),
      hasPremiumRole(ctx, user._id),
    ]);
    // Cache for mutations (e.g. createLink rate limits) that can't fetch Discord live.
    try {
      await ctx.runMutation(internal.links.upsertUserRoleInternal, {
        userId: user._id,
        isStaff: moderator,
        isPremium: premium,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.error("myRoles cache write failed", e);
    }
    return { moderator, premium };
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

// ── premium: custom redirect text ─────────────────────────────────────────

export const setRedirectTextInternal = internalMutation({
  args: { id: v.id("links"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    // Store undefined when cleared so it falls back to the default.
    await ctx.db.patch(id, { redirectText: text === "" ? undefined : text });
  },
});

export const setTextColorInternal = internalMutation({
  args: { id: v.id("links"), color: v.string(), color2: v.optional(v.string()) },
  handler: async (ctx, { id, color, color2 }) => {
    if (color === "") {
      await ctx.db.patch(id, { textColor: undefined, textColor2: undefined });
    } else {
      if (!HEX_COLOR_RE.test(color)) throw new Error("Invalid color.");
      const patch = { textColor: color };
      // Gradient end color; cleared when empty so solid color wins.
      if (color2 !== undefined) {
        if (color2 !== "" && !HEX_COLOR_RE.test(color2)) throw new Error("Invalid gradient color.");
        patch.textColor2 = color2 === "" ? undefined : color2;
      }
      await ctx.db.patch(id, patch);
    }
  },
});

// Premium users may set the text color shown in public listings.
export const saveTextColor = action({
  args: { id: v.id("links"), color: v.string(), color2: v.optional(v.string()) },
  handler: async (ctx, { id, color, color2 }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) fail("You must be signed in to edit links.");
    const link = await ctx.runQuery(internal.links.getLinkById, { id });
    if (!link) fail("Link not found.");
    if (link.ownerId !== user._id) fail("You can only edit your own links.");
    if (!(await hasPremiumRole(ctx, user._id))) fail("Custom text color is a premium feature.");
    const clean = String(color ?? "").trim();
    if (clean !== "" && !HEX_COLOR_RE.test(clean)) fail("Color must be a hex value like #38bdf8.");
    const clean2 = String(color2 ?? "").trim();
    if (clean2 !== "" && !HEX_COLOR_RE.test(clean2)) fail("Gradient color must be a hex value like #38bdf8.");
    await ctx.runMutation(internal.links.setTextColorInternal, { id, color: clean, color2: clean2 });
  },
});

// Premium users may set the text shown on the redirect page.
export const saveRedirectText = action({
  args: { id: v.id("links"), text: v.string() },
  handler: async (ctx, { id, text }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) fail("You must be signed in to edit links.");

    const link = await ctx.runQuery(internal.links.getLinkById, { id });
    if (!link) fail("Link not found.");
    if (link.ownerId !== user._id) fail("You can only edit your own links.");
    if (!(await hasPremiumRole(ctx, user._id))) {
      fail("Custom redirect text is a premium feature.");
    }

    const clean = String(text ?? "").trim();
    if (clean.length > MAX_LEN.redirectText) fail("Redirect text is too long.");
    if (CTRL_RE.test(clean)) fail("Redirect text contains invalid characters.");

    await ctx.runMutation(internal.links.setRedirectTextInternal, {
      id,
      text: clean,
    });
  },
});

// ── pinning (premium + staff) ─────────────────────────────────────────────

const PIN_DURATIONS: Record<string, number> = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
};
const PIN_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function isPinned(doc: any, now: number): boolean {
  if (doc.pinnedPermanent) return true;
  return doc.pinnedUntil != null && doc.pinnedUntil > now;
}

export const getLinksByOwnerInternal = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) =>
    ctx.db
      .query("links")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect(),
});

export const getPinStateInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) =>
    ctx.db
      .query("pinStates")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
});

export const setPinInternal = internalMutation({
  args: {
    id: v.id("links"),
    pinnedAt: v.number(),
    pinnedUntil: v.optional(v.number()),
    pinnedPermanent: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, pinnedAt, pinnedUntil, pinnedPermanent }) => {
    await ctx.db.patch(id, { pinnedAt, pinnedUntil, pinnedPermanent });
  },
});

export const clearPinInternal = internalMutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      pinnedAt: undefined,
      pinnedUntil: undefined,
      pinnedPermanent: undefined,
    });
  },
});

export const setPinStateInternal = internalMutation({
  args: { userId: v.string(), lastUnpinnedAt: v.number() },
  handler: async (ctx, { userId, lastUnpinnedAt }) => {
    const existing = await ctx.db
      .query("pinStates")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { lastUnpinnedAt });
    else await ctx.db.insert("pinStates", { userId, lastUnpinnedAt });
  },
});

export const expirePin = internalMutation({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const link = await ctx.db.get(id);
    if (!link) return;
    if (link.pinnedPermanent) return;
    if (link.pinnedUntil == null) return;
    if (link.pinnedUntil > Date.now()) return;
    await ctx.db.patch(id, {
      pinnedAt: undefined,
      pinnedUntil: undefined,
      pinnedPermanent: undefined,
    });
    if (link.ownerId) {
      const existing = await ctx.db
        .query("pinStates")
        .withIndex("by_userId", (q) => q.eq("userId", link.ownerId))
        .unique();
      if (existing) await ctx.db.patch(existing._id, { lastUnpinnedAt: Date.now() });
      else await ctx.db.insert("pinStates", { userId: link.ownerId, lastUnpinnedAt: Date.now() });
    }
  },
});

export const pinLink = action({
  args: { id: v.id("links"), duration: v.string() },
  handler: async (ctx, { id, duration }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) fail("You must be signed in to pin links.");
    const link = await ctx.runQuery(internal.links.getLinkById, { id });
    if (!link) fail("Link not found.");
    const isStaff = await hasModRole(ctx, user._id);
    const isPremium = isStaff || (await hasPremiumRole(ctx, user._id));
    if (!isPremium) fail("Pinning is a premium feature.");
    if (link.ownerId !== user._id && !isStaff) fail("You can only pin your own links.");
    const now = Date.now();
    if (isPinned(link, now)) fail("Link is already pinned.");
    const isPermanent = duration === "permanent";
    if (isPermanent && !isStaff) fail("Permanent pins are staff only.");
    const durationMs = PIN_DURATIONS[duration];
    if (!isPermanent && durationMs == null) fail("Invalid pin duration.");
    // One active pin at a time (premium only)
    if (!isStaff) {
      const owned = await ctx.runQuery(internal.links.getLinksByOwnerInternal, { ownerId: user._id });
      const active = owned.find((d) => isPinned(d, now));
      if (active) fail("You already have a pinned link. Unpin it first.");
      const pinState = await ctx.runQuery(internal.links.getPinStateInternal, { userId: user._id });
      if (pinState?.lastUnpinnedAt && now - pinState.lastUnpinnedAt < PIN_COOLDOWN_MS) {
        const waitMs = PIN_COOLDOWN_MS - (now - pinState.lastUnpinnedAt);
        const mins = Math.ceil(waitMs / 60000);
        fail(`Pin cooldown: wait ${mins} more minute(s) before pinning again.`);
      }
    }
    const pinnedAt = now;
    const pinnedUntil = isPermanent ? undefined : now + durationMs;
    const pinnedPermanent = isPermanent ? true : undefined;
    await ctx.runMutation(internal.links.setPinInternal, { id, pinnedAt, pinnedUntil, pinnedPermanent });
    if (!isPermanent) {
      await ctx.scheduler.runAfter(durationMs, internal.links.expirePin, { id });
    }
  },
});

export const unpinLink = action({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    const user = await authComponent.safeGetAuthUser(ctx);
    if (!user) fail("You must be signed in.");
    const link = await ctx.runQuery(internal.links.getLinkById, { id });
    if (!link) fail("Link not found.");
    const isStaff = await hasModRole(ctx, user._id);
    if (link.ownerId !== user._id && !isStaff) fail("You can only unpin your own links.");
    if (!isPinned(link, Date.now())) fail("Link is not pinned.");
    await ctx.runMutation(internal.links.clearPinInternal, { id });
    if (!isStaff) {
      await ctx.runMutation(internal.links.setPinStateInternal, { userId: link.ownerId!, lastUnpinnedAt: Date.now() });
    }
  },
});

// Delete as owner OR as Discord moderator. Actions run outside transactions,
// so the ownership/permission check happens here and the delete itself is an
// internal mutation.
export const moderatorDelete = action({
  args: { id: v.id("links") },
  handler: async (ctx, { id }) => {
    try {
      const link = await ctx.runQuery(internal.links.getLinkById, { id });
      if (!link) return;

      const user = await authComponent.safeGetAuthUser(ctx);
      if (!user) fail("You must be signed in to delete links.");

      if (link.ownerId !== user._id) {
        const isMod = await hasModRole(ctx, user._id);
        if (!isMod) fail("You can only delete your own links.");
      }

      await ctx.runMutation(internal.links.removeLinkInternal, { id });
    } catch (err) {
      // Surface the real cause in deployment logs instead of a bare
      // "Server Error" reaching the client.
      console.error("moderatorDelete failed", {
        id,
        message: err?.message,
        stack: err?.stack,
      });
      throw err;
    }
  },
});
