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
    // upstream feature: password-protected links (SHA-256, see links.ts)
    passwordHash: v.optional(v.string()),
    clicks: v.number(),
    public: v.boolean(),
    // Premium feature: custom text shown on the redirect page.
    redirectText: v.optional(v.string()),
    // Premium feature: custom title text color (hex) shown in public listings.
    textColor: v.optional(v.string()),
    // Pinning (premium + staff). pinnedUntil is ms epoch; pinnedPermanent for staff.
    pinnedAt: v.optional(v.number()),
    pinnedUntil: v.optional(v.number()),
    pinnedPermanent: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]),

  // Tracks per-user pin cooldown (6h after unpin).
  pinStates: defineTable({
    userId: v.string(),
    lastUnpinnedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Cached Discord roles for mutations that can't fetch live (e.g. rate limits).
  userRoles: defineTable({
    userId: v.string(),
    isPremium: v.boolean(),
    isStaff: v.boolean(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
