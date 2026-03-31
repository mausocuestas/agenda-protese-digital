import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { users, estabelecimentos } from '$lib/server/db/index'
import { eq, asc } from 'drizzle-orm'

const VALID_ROLES = ['dentist', 'attendant', 'coordinator', 'third_party'] as const
type UserRole = (typeof VALID_ROLES)[number]

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')
  if (user.role !== 'coordinator') redirect(302, '/')

  const [allUsers, allUnits] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        defaultUnitId: users.defaultUnitId,
        unitLabel: estabelecimentos.estabelecimento,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(estabelecimentos, eq(users.defaultUnitId, estabelecimentos.id))
      .orderBy(asc(users.name)),
    db
      .select({ id: estabelecimentos.id, label: estabelecimentos.estabelecimento })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.isActive, true))
      .orderBy(asc(estabelecimentos.estabelecimento)),
  ])

  return { users: allUsers, units: allUnits, currentUserId: user.appId }
}

export const actions: Actions = {
  // Cadastra novo membro da equipe (pré-registro — acesso liberado no primeiro login via Google)
  addUser: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const name = (data.get('name') as string)?.trim()
    const email = (data.get('email') as string)?.trim().toLowerCase()
    const role = data.get('role') as string
    const defaultUnitIdRaw = (data.get('defaultUnitId') as string)?.trim()

    if (!name || !email || !role) {
      return fail(400, { error: 'Nome, e-mail e perfil são obrigatórios' })
    }
    if (name.length > 255) return fail(400, { error: 'Nome muito longo (máx. 255 caracteres)' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { error: 'E-mail inválido' })
    }
    if (!VALID_ROLES.includes(role as UserRole)) {
      return fail(400, { error: 'Perfil inválido' })
    }

    const defaultUnitId = defaultUnitIdRaw ? parseInt(defaultUnitIdRaw, 10) : null
    if (defaultUnitIdRaw && isNaN(defaultUnitId!)) {
      return fail(400, { error: 'Unidade inválida' })
    }

    try {
      await db.insert(users).values({
        name,
        email,
        role: role as UserRole,
        defaultUnitId,
      })
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { error: 'Já existe um usuário com esse e-mail' })
      }
      return fail(500, { error: 'Erro ao cadastrar usuário. Tente novamente.' })
    }

    return { userAdded: true }
  },

  // Atualiza nome, perfil e unidade padrão do usuário
  editUser: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { editError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    const name = (data.get('name') as string)?.trim()
    const role = data.get('role') as string
    const defaultUnitIdRaw = (data.get('defaultUnitId') as string)?.trim()

    if (!id || isNaN(id)) return fail(400, { editError: 'Usuário inválido' })
    if (!name || !role) return fail(400, { editError: 'Nome e perfil são obrigatórios' })
    if (name.length > 255) return fail(400, { editError: 'Nome muito longo' })
    if (!VALID_ROLES.includes(role as UserRole)) return fail(400, { editError: 'Perfil inválido' })

    const defaultUnitId = defaultUnitIdRaw ? parseInt(defaultUnitIdRaw, 10) : null
    if (defaultUnitIdRaw && isNaN(defaultUnitId!)) {
      return fail(400, { editError: 'Unidade inválida' })
    }

    try {
      await db
        .update(users)
        .set({ name, role: role as UserRole, defaultUnitId, updatedAt: new Date() })
        .where(eq(users.id, id))
    } catch {
      return fail(500, { editError: 'Erro ao atualizar. Tente novamente.' })
    }

    return { userEdited: true }
  },

  // Ativa ou desativa um usuário (sem excluir — mantém histórico de ações)
  toggleActive: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { editError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    const currentIsActive = data.get('isActive') === 'true'

    if (!id || isNaN(id)) return fail(400, { editError: 'Usuário inválido' })

    // Protege o próprio coordenador de se autodesativar
    if (id === user.appId) {
      return fail(400, { editError: 'Não é possível desativar sua própria conta' })
    }

    try {
      await db
        .update(users)
        .set({ isActive: !currentIsActive, updatedAt: new Date() })
        .where(eq(users.id, id))
    } catch {
      return fail(500, { editError: 'Erro ao atualizar. Tente novamente.' })
    }

    return { userEdited: true }
  },
}
