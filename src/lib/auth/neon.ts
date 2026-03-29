// Provider primário: Better Auth (Neon Auth)
// Gerencia sessões via Google OAuth + tabelas no schema auth.*

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET } from '$env/static/private'
import { db } from '$lib/server/db/client'
import { authUser, authSession, authAccount, authVerification } from '$lib/server/db/schema/auth'

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  // Nossa rota handler está em /auth/[...all], não no padrão /api/auth
  basePath: '/auth',

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),

  socialProviders: {
    google: {
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    },
  },
})

export type Session = typeof auth.$Infer.Session
