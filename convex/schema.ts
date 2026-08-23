import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  links: defineTable({
    slug: v.string(),
    url: v.string(),
    title: v.string(),
    description: v.string(),
    icon: v.string(),
    color: v.optional(v.string()),
    image: v.optional(v.string()),
    // F1/F4: ownership tracking. Stored as an opaque string on purpose:
    // better-auth users live in the auth component's tables, so a plain
    // equality-comparable reference is the right shape (no joins needed).
    // Optional so pre-existing anonymous rows keep validating.
    ownerId: v.optional(v.string()),
    clicks: v.number(),
    public: v.boolean(),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),
});
