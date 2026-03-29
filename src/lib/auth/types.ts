// Tipos compartilhados entre providers de autenticação

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

export interface AuthSession {
  user: AuthUser
  expires: string
}

export type AuthProvider = 'neon' | 'google'

// Usuário enriquecido com dados do sistema (role, unidade)
export interface AppUser extends AuthUser {
  appId: number           // id em protese.users
  role: string            // dentist | attendant | coordinator | third_party
  defaultUnitId: number | null
  isActive: boolean
}
