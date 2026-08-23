import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    password: v.optional(v.string()),
    public: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error("That alias is already taken. Please choose another.");
    }
    const { color, image, password, ...rest } = args;
    await ctx.db.insert("links", {
      ...rest,
      color: color?.trim() || undefined,
      image: image?.trim() || undefined,
      passwordHash: password?.trim()
        ? await sha256Hex(password.trim())
        : undefined,
      clicks: 0,
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
