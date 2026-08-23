import { createClient } from '@convex-dev/better-auth'
import { convex, crossDomain } from '@convex-dev/better-auth/plugins'
import { components } from './_generated/api'
import { query } from './_generated/server'
import { betterAuth } from 'better-auth/minimal'
import authConfig from './auth.config'

const siteUrl = process.env.SITE_URL

const socialProviders = process.env.DISCORD_CLIENT_ID
  ? {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
      },
    }
  : {}

export const authComponent = createClient(components.betterAuth)

export const createAuth = (ctx) =>
  betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: siteUrl ? [siteUrl] : undefined,
    database: authComponent.adapter(ctx),
    socialProviders,
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
    ],
  })

export const getCurrentUser = query({
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx)
  },
})
