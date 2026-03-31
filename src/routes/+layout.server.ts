import type { LayoutServerLoad } from './$types'
import { getNotificationCounts } from '$lib/server/notifications'

// Expõe o usuário logado e contagens de pendências para todas as páginas
export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user ?? null

  if (!user) {
    return { user, notifications: { fila: 0, custodia: 0, qualidade: 0 } }
  }

  const notifications = await getNotificationCounts(user)

  return { user, notifications }
}
