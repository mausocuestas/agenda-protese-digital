import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { systemConfigs, prosthesisTypes } from '$lib/server/db/index'
import { eq, asc } from 'drizzle-orm'

// Parâmetros configuráveis pelo coordenador, com metadados para a UI
const CONFIG_DEFS = [
  {
    key: 'reassessment_months',
    label: 'Meses para Reavaliação',
    description: 'Tempo antes de exigir nova triagem do encaminhamento',
    unit: 'meses',
    min: 1,
    max: 24,
  },
  {
    key: 'default_interval_days',
    label: 'Intervalo Padrão entre Consultas',
    description: 'Dias entre consultas para prótese fixa',
    unit: 'dias',
    min: 1,
    max: 90,
  },
  {
    key: 'removable_first_interval',
    label: 'Intervalo — Prótese Removível',
    description: 'Dias entre consultas para prótese removível',
    unit: 'dias',
    min: 1,
    max: 90,
  },
  {
    key: 'monthly_goal',
    label: 'Meta Mensal de Atendimentos',
    description: 'Número alvo de atendimentos finalizados por mês',
    unit: 'atendimentos',
    min: 1,
    max: 200,
  },
  {
    key: 'contact_max_attempts',
    label: 'Tentativas Máximas de Contato',
    description: 'Limite de tentativas antes de arquivar o encaminhamento',
    unit: 'tentativas',
    min: 1,
    max: 20,
  },
  {
    key: 'contact_flag_attempts',
    label: 'Tentativas para Alerta',
    description: 'Número de tentativas que aciona o sinal de atenção',
    unit: 'tentativas',
    min: 1,
    max: 10,
  },
  {
    key: 'whatsapp_deadline_hours',
    label: 'Prazo de Resposta WhatsApp',
    description: 'Horas de espera após mensagem antes de nova tentativa',
    unit: 'horas',
    min: 1,
    max: 72,
  },
  {
    key: 'elderly_age_threshold',
    label: 'Limiar de Idade do Idoso',
    description: 'Idade a partir da qual o paciente recebe prioridade no atendimento',
    unit: 'anos',
    min: 50,
    max: 80,
  },
] as const

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')
  if (user.role !== 'coordinator') redirect(302, '/fila')

  const [rows, types] = await Promise.all([
    db.select().from(systemConfigs),
    db.select().from(prosthesisTypes).orderBy(asc(prosthesisTypes.name)),
  ])

  const valueMap = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const configs = CONFIG_DEFS.map((def) => ({
    ...def,
    value: valueMap[def.key] ?? '',
  }))

  return { configs, prosthesisTypes: types }
}

export const actions: Actions = {
  // Atualiza os parâmetros numéricos do sistema
  update: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()

    // Valida todos os campos antes de salvar qualquer um
    const updates: { key: string; value: string }[] = []
    for (const def of CONFIG_DEFS) {
      const raw = data.get(def.key) as string
      if (!raw || raw.trim() === '') {
        return fail(400, { error: `Campo "${def.label}" é obrigatório` })
      }
      const num = parseInt(raw, 10)
      if (isNaN(num) || num < def.min || num > def.max) {
        return fail(400, {
          error: `${def.label}: valor deve estar entre ${def.min} e ${def.max}`,
        })
      }
      updates.push({ key: def.key, value: String(num) })
    }

    try {
      // Upsert — cria se não existir, atualiza se já existir
      await Promise.all(
        updates.map((u) =>
          db
            .insert(systemConfigs)
            .values({ key: u.key, value: u.value, updatedBy: user.appId })
            .onConflictDoUpdate({
              target: systemConfigs.key,
              set: { value: u.value, updatedBy: user.appId, updatedAt: new Date() },
            })
        )
      )
    } catch {
      return fail(500, { error: 'Erro ao salvar configurações. Tente novamente.' })
    }

    return { success: true }
  },

  // Adiciona novo tipo de prótese
  addType: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { typeError: 'Sem permissão' })

    const data = await request.formData()
    const name = (data.get('name') as string)?.trim()

    if (!name) return fail(400, { typeError: 'Nome é obrigatório' })
    if (name.length > 100) return fail(400, { typeError: 'Nome muito longo (máx. 100 caracteres)' })

    try {
      await db.insert(prosthesisTypes).values({ name })
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { typeError: 'Já existe um tipo com esse nome' })
      }
      return fail(500, { typeError: 'Erro ao salvar. Tente novamente.' })
    }

    return { typeAdded: true }
  },

  // Renomeia um tipo de prótese existente
  editType: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { typeError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    const name = (data.get('name') as string)?.trim()

    if (!id || !name) return fail(400, { typeError: 'Dados inválidos' })
    if (name.length > 100) return fail(400, { typeError: 'Nome muito longo (máx. 100 caracteres)' })

    try {
      await db.update(prosthesisTypes).set({ name }).where(eq(prosthesisTypes.id, id))
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { typeError: 'Já existe um tipo com esse nome' })
      }
      return fail(500, { typeError: 'Erro ao salvar. Tente novamente.' })
    }

    return { typeEdited: true }
  },
}
