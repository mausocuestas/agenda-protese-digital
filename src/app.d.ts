// Tipos globais do SvelteKit
import type { AppUser } from '$lib/auth/types'

declare global {
  namespace App {
    interface Locals {
      // Usuário autenticado + autorizado no sistema (null em rotas públicas)
      user: AppUser | null
      // Função injetada pelo handle do @auth/sveltekit (provider Google)
      auth: () => Promise<import('@auth/core/types').Session | null>
    }
    interface PageData {
      user?: AppUser | null
    }
    // interface Error {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {}
