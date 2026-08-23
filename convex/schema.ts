import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  links: defineTable({
    slug: v.string(),
    url: v.string(),
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    clicks: v.number(),
    public: v.boolean(),
  }).index("by_slug", ["slug"]),
});
