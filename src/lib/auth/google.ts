// Provider alternativo: Auth.js v5 com Google OAuth
// Ativado via AUTH_PROVIDER=google no .env

import { SvelteKitAuth } from '@auth/sveltekit'
import Google from '@auth/sveltekit/providers/google'
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET } from '$env/static/private'
import { db } from '$lib/server/db/client'
import { users } from '$lib/server/db/index'
import { eq } from 'drizzle-orm'

export const googleAuth = SvelteKitAuth({
  providers: [
    Google({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: AUTH_SECRET,
  trustHost: true,

  callbacks: {
    // Bloqueia login se o email não estiver pré-cadastrado e ativo em protese.users
    async signIn({ user }) {
      if (!user.email) return false

      const existing = await db
        .select({ id: users.id, isActive: users.isActive })
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1)

      if (!existing.length || !existing[0]!.isActive) return false

      return true
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})

// @auth/sveltekit v1 retorna { handle, signIn, signOut } — sem "handlers"
export const { handle: googleHandle, signIn, signOut } = googleAuth
