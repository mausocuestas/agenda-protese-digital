// Ponto de entrada unificado — troca de provider via AUTH_PROVIDER no .env
import { AUTH_PROVIDER } from '$env/static/private'

export const provider = (AUTH_PROVIDER ?? 'neon') as 'neon' | 'google'

// Client-side: importar de $lib/auth/client.ts
// Server-side: importar de $lib/auth/neon.ts ou $lib/auth/google.ts diretamente
export { provider as authProvider }
