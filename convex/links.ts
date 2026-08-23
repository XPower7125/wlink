import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
    const existing = await ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (existing) {
      throw new Error("That alias is already taken. Please choose another.");
    }
    const { color, image, ...rest } = args;
    await ctx.db.insert("links", {
      ...rest,
      color: color?.trim() || undefined,
      image: image?.trim() || undefined,
      clicks: 0,
    });
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
