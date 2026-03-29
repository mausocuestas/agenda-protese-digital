// Client-side: helpers de autenticação para uso em componentes Svelte
// Importar apenas no contexto do browser (não em +page.server.ts)

import { createAuthClient } from 'better-auth/svelte'

// PUBLIC_APP_URL deve ser definida no .env como VITE_APP_URL ou PUBLIC_APP_URL
// Em desenvolvimento, fallback para localhost
const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5173'

export const authClient = createAuthClient({
  baseURL,
  // Deve bater com o basePath configurado no servidor (neon.ts)
  basePath: '/auth',
})

export const { signIn, signOut, useSession } = authClient
