import type { PageServerLoad } from './$types'
import { AUTH_PROVIDER } from '$env/static/private'

export const load: PageServerLoad = async ({ url }) => {
  return {
    provider: AUTH_PROVIDER ?? 'neon',
    erro: url.searchParams.get('erro'),
  }
}
