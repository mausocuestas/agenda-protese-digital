import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { systemConfigs, prosthesisTypes, unitResponsibilities, estabelecimentos, thirdPartySchedules } from '$lib/server/db/index'
import { eq, asc, inArray, and } from 'drizzle-orm'

// IDs fixos das unidades responsáveis (Centro-UBS e Imperial-USF)
const RESPONSIBLE_UNIT_IDS = [12, 17] as const

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
  {
    key: 'delay_days',
    label: 'Dias para Flag de Atraso',
    description: 'Dias na fila sem agendamento a partir dos quais o encaminhamento é sinalizado como atrasado',
    unit: 'dias',
    min: 30,
    max: 730,
  },
] as const

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')
  if (user.role !== 'coordinator') redirect(302, '/fila')

  const [rows, types, responsibleUnits, allLinks, allUnits, schedules] = await Promise.all([
    db.select().from(systemConfigs),
    db.select().from(prosthesisTypes).orderBy(asc(prosthesisTypes.name)),
    // Nomes das unidades responsáveis
    db
      .select({ id: estabelecimentos.id, label: estabelecimentos.estabelecimento })
      .from(estabelecimentos)
      .where(inArray(estabelecimentos.id, [...RESPONSIBLE_UNIT_IDS])),
    // Todos os vínculos com o nome da unidade designada
    db
      .select({
        responsibleUnitId: unitResponsibilities.responsibleUnitId,
        designatedUnitId: unitResponsibilities.designatedUnitId,
        designatedLabel: estabelecimentos.estabelecimento,
      })
      .from(unitResponsibilities)
      .innerJoin(estabelecimentos, eq(unitResponsibilities.designatedUnitId, estabelecimentos.id))
      .where(inArray(unitResponsibilities.responsibleUnitId, [...RESPONSIBLE_UNIT_IDS]))
      .orderBy(asc(estabelecimentos.estabelecimento)),
    // Todas as unidades ativas para o dropdown de adição
    db
      .select({ id: estabelecimentos.id, label: estabelecimentos.estabelecimento })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.isActive, true))
      .orderBy(asc(estabelecimentos.estabelecimento)),
    // Todos os agendamentos do terceirizado com nome da unidade
    db
      .select({
        id: thirdPartySchedules.id,
        scheduledDate: thirdPartySchedules.scheduledDate,
        startTime: thirdPartySchedules.startTime,
        endTime: thirdPartySchedules.endTime,
        lunchStart: thirdPartySchedules.lunchStart,
        lunchEnd: thirdPartySchedules.lunchEnd,
        defaultDuration: thirdPartySchedules.defaultDuration,
        healthUnitId: thirdPartySchedules.healthUnitId,
        healthUnitLabel: estabelecimentos.estabelecimento,
      })
      .from(thirdPartySchedules)
      .innerJoin(estabelecimentos, eq(thirdPartySchedules.healthUnitId, estabelecimentos.id))
      .orderBy(asc(thirdPartySchedules.scheduledDate), asc(estabelecimentos.estabelecimento)),
  ])

  const valueMap = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const configs = CONFIG_DEFS.map((def) => ({
    ...def,
    value: valueMap[def.key] ?? '',
  }))

  // Agrupa vínculos por unidade responsável para facilitar a renderização
  const unitGroups = RESPONSIBLE_UNIT_IDS.map((rId) => ({
    responsibleUnitId: rId,
    responsibleLabel: responsibleUnits.find((u) => u.id === rId)?.label ?? `Unidade ${rId}`,
    designatedUnits: allLinks.filter((l) => l.responsibleUnitId === rId),
  }))

  return { configs, prosthesisTypes: types, unitGroups, allUnits, schedules }
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

  // Vincula uma unidade designada a uma unidade responsável
  addUnitLink: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { unitLinkError: 'Sem permissão' })

    const data = await request.formData()
    const responsibleUnitId = parseInt(data.get('responsibleUnitId') as string, 10)
    const designatedUnitId = parseInt(data.get('designatedUnitId') as string, 10)

    if (!responsibleUnitId || isNaN(responsibleUnitId) || !designatedUnitId || isNaN(designatedUnitId)) {
      return fail(400, { unitLinkError: 'Selecione uma unidade válida' })
    }

    // Impede vincular unidade não-responsável
    if (!RESPONSIBLE_UNIT_IDS.includes(responsibleUnitId as (typeof RESPONSIBLE_UNIT_IDS)[number])) {
      return fail(400, { unitLinkError: 'Unidade responsável inválida' })
    }

    try {
      await db.insert(unitResponsibilities).values({ responsibleUnitId, designatedUnitId })
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { unitLinkError: 'Vínculo já existe' })
      }
      return fail(500, { unitLinkError: 'Erro ao adicionar vínculo. Tente novamente.' })
    }

    return { unitLinkAdded: true }
  },

  // Adiciona um dia de atendimento do terceirizado em uma unidade
  addSchedule: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { scheduleError: 'Sem permissão' })

    const data = await request.formData()
    const healthUnitId = parseInt(data.get('healthUnitId') as string, 10)
    const scheduledDate = (data.get('scheduledDate') as string)?.trim()
    const startTime = (data.get('startTime') as string)?.trim()
    const endTime = (data.get('endTime') as string)?.trim()
    const lunchStart = (data.get('lunchStart') as string)?.trim() || null
    const lunchEnd = (data.get('lunchEnd') as string)?.trim() || null
    const defaultDuration = parseInt(data.get('defaultDuration') as string, 10)

    if (!healthUnitId || isNaN(healthUnitId)) {
      return fail(400, { scheduleError: 'Selecione uma unidade de saúde' })
    }
    if (!scheduledDate || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return fail(400, { scheduleError: 'Data inválida' })
    }
    if (!startTime || !endTime) {
      return fail(400, { scheduleError: 'Horário de início e fim são obrigatórios' })
    }
    if (startTime >= endTime) {
      return fail(400, { scheduleError: 'Horário de fim deve ser após o início' })
    }
    if (defaultDuration !== 30 && defaultDuration !== 60) {
      return fail(400, { scheduleError: 'Duração padrão inválida (use 30 ou 60 minutos)' })
    }
    // Valida almoço: se informado, lunchEnd deve ser depois de lunchStart e dentro da janela
    if (lunchStart && lunchEnd) {
      if (lunchStart >= lunchEnd) {
        return fail(400, { scheduleError: 'Fim do almoço deve ser após o início' })
      }
      if (lunchStart < startTime || lunchEnd > endTime) {
        return fail(400, { scheduleError: 'Horário de almoço deve estar dentro da janela de atendimento' })
      }
    }

    try {
      await db.insert(thirdPartySchedules).values({
        healthUnitId,
        scheduledDate,
        startTime,
        endTime,
        lunchStart,
        lunchEnd,
        defaultDuration,
        createdBy: user.appId,
      })
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { scheduleError: 'Já existe um agendamento para essa unidade nessa data' })
      }
      return fail(500, { scheduleError: 'Erro ao salvar agendamento. Tente novamente.' })
    }

    return { scheduleAdded: true }
  },

  // Remove um dia de atendimento do terceirizado
  removeSchedule: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { scheduleError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)

    if (!id || isNaN(id)) return fail(400, { scheduleError: 'Agendamento inválido' })

    try {
      await db.delete(thirdPartySchedules).where(eq(thirdPartySchedules.id, id))
    } catch {
      return fail(500, { scheduleError: 'Erro ao remover agendamento. Tente novamente.' })
    }

    return { scheduleRemoved: true }
  },

  // Remove o vínculo entre uma unidade designada e sua responsável
  removeUnitLink: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { unitLinkError: 'Sem permissão' })

    const data = await request.formData()
    const responsibleUnitId = parseInt(data.get('responsibleUnitId') as string, 10)
    const designatedUnitId = parseInt(data.get('designatedUnitId') as string, 10)

    if (!responsibleUnitId || isNaN(responsibleUnitId) || !designatedUnitId || isNaN(designatedUnitId)) {
      return fail(400, { unitLinkError: 'Vínculo inválido' })
    }

    // Impede remover o vínculo da unidade responsável com ela mesma
    if (responsibleUnitId === designatedUnitId) {
      return fail(400, { unitLinkError: 'Não é possível remover a unidade responsável de si mesma' })
    }

    try {
      await db
        .delete(unitResponsibilities)
        .where(
          and(
            eq(unitResponsibilities.responsibleUnitId, responsibleUnitId),
            eq(unitResponsibilities.designatedUnitId, designatedUnitId)
          )
        )
    } catch {
      return fail(500, { unitLinkError: 'Erro ao remover vínculo. Tente novamente.' })
    }

    return { unitLinkRemoved: true }
  },
}
