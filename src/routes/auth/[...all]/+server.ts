// Rota catch-all para Better Auth (provider=neon)
// Quando provider=google, o @auth/sveltekit intercepta /auth/* via hooks.server.ts antes de chegar aqui
import { AUTH_PROVIDER } from '$env/static/private'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async (event) => {
  if (AUTH_PROVIDER === 'google') {
    // Nunca deve chegar aqui — Auth.js intercepta via hooks
    return new Response('Not found', { status: 404 })
  }
  const { auth } = await import('$lib/auth/neon')
  return auth.handler(event.request)
}

export const POST: RequestHandler = async (event) => {
  if (AUTH_PROVIDER === 'google') {
    return new Response('Not found', { status: 404 })
  }
  const { auth } = await import('$lib/auth/neon')
  return auth.handler(event.request)
}
