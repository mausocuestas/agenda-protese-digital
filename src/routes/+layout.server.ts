import type { LayoutServerLoad } from './$types'

// Expõe o usuário logado para todas as páginas via data.user
export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user ?? null,
  }
}
