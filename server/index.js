import 'dotenv/config'
import Database from 'better-sqlite3'
import express from 'express'
import { betterAuth } from 'better-auth'
import { toNodeHandler } from 'better-auth/node'

const socialProviders = process.env.DISCORD_CLIENT_ID
  ? {
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
      },
    }
  : {}

export const auth = betterAuth({
  appName: 'wlink',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  trustedOrigins: ['http://localhost:5173'],
  database: new Database('wlink.db'),
  socialProviders,
})

const app = express()
app.all('/api/auth/*', toNodeHandler(auth))

app.listen(3000, () => {
  console.log('wlink auth server → http://localhost:3000')
})
