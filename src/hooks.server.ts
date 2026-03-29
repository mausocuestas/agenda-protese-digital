// Middleware SvelteKit — valida sessão em todas as rotas protegidas
// e enriquece event.locals com os dados do usuário do sistema

import { redirect } from '@sveltejs/kit'
import { AUTH_PROVIDER } from '$env/static/private'
import { db } from '$lib/server/db/client'
import { users } from '$lib/server/db/index'
import { eq } from 'drizzle-orm'
import type { Handle } from '@sveltejs/kit'

// Rotas acessíveis sem autenticação
const PUBLIC_ROUTES = ['/login', '/auth']

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname
  const isPublic = PUBLIC_ROUTES.some((r) => path.startsWith(r))

  // ── Google OAuth (Auth.js) ──────────────────────────────────────────────────
  if (AUTH_PROVIDER === 'google') {
    const { googleHandle } = await import('$lib/auth/google')

    return googleHandle({ event, resolve: async (event) => {
      // Auth.js popula locals.auth() após seu handle rodar
      if (!isPublic) {
        const session = await event.locals.auth()
        if (!session?.user?.email) {
          redirect(302, '/login')
        }

        const appUser = await fetchAppUser(session.user.email)
        if (!appUser) redirect(302, '/login?erro=nao-autorizado')
        event.locals.user = appUser
      }

      return resolve(event)
    }})
  }

  // ── Neon Auth (Better Auth) ─────────────────────────────────────────────────
  if (!isPublic) {
    const { auth } = await import('$lib/auth/neon')
    const session = await auth.api.getSession({ headers: event.request.headers })

    if (!session?.user) {
      redirect(302, '/login')
    }

    // Verifica se o email está cadastrado e ativo em protese.users
    const appUser = await fetchAppUser(session.user.email)
    if (!appUser) {
      // Autenticado no provider mas não autorizado no sistema → logout
      redirect(302, '/login?erro=nao-autorizado')
    }

    event.locals.user = appUser
  }

  return resolve(event)
}

// Busca o usuário na tabela protese.users pelo email e valida acesso
async function fetchAppUser(email: string) {
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      defaultUnitId: users.defaultUnitId,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = result[0]
  if (!user || !user.isActive) return null

  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    image: null as string | null,
    appId: user.id,
    role: user.role,
    defaultUnitId: user.defaultUnitId ?? null,
    isActive: user.isActive,
  }
}
