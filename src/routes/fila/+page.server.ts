import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { referrals, estabelecimentos, unitResponsibilities, systemConfigs, contactAttempts, appointments } from '$lib/server/db/index'
import { isNull, isNotNull, inArray, eq, desc, asc, and, count } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  const isCoordinator = user.role === 'coordinator'
  const isAttendant = user.role === 'attendant'

  // Limiar de atraso configurável — padrão 180 dias
  const delayConfig = await db.query.systemConfigs.findFirst({
    where: (c, { eq: eqFn }) => eqFn(c.key, 'delay_days'),
    columns: { value: true },
  })
  const delayDays = parseInt(delayConfig?.value ?? '180', 10)

  // filterUnitIds: null = sem filtro (todas as unidades)
  let filterUnitIds: number[] | null = null
  let activeUnitName = 'Fila de Encaminhamentos'
  let scope: 'mine' | 'responsible' | 'all' = 'mine'

  if (isCoordinator) {
    // Coordenador filtra por unidade via query param ou vê todas
    const param = url.searchParams.get('unit')
    filterUnitIds = param ? [parseInt(param, 10)] : null
  } else if (isAttendant) {
    // Atendente tem 3 níveis de visibilidade controlados por ?scope=
    const scopeParam = url.searchParams.get('scope')
    scope = scopeParam === 'responsible' || scopeParam === 'all' ? scopeParam : 'mine'

    if (scope === 'mine') {
      filterUnitIds = user.defaultUnitId ? [user.defaultUnitId] : null
    } else if (scope === 'responsible' && user.defaultUnitId) {
      // Busca todas as unidades designadas à unidade responsável do atendente
      const designations = await db
        .select({ designatedUnitId: unitResponsibilities.designatedUnitId })
        .from(unitResponsibilities)
        .where(eq(unitResponsibilities.responsibleUnitId, user.defaultUnitId))
      filterUnitIds = designations.length > 0 ? designations.map((d) => d.designatedUnitId) : null
    }
    // scope === 'all': filterUnitIds permanece null
  } else {
    // Dentista e terceirizado: sempre fixos na unidade padrão
    filterUnitIds = user.defaultUnitId ? [user.defaultUnitId] : null
  }

  // Carrega lista de unidades ativas — usada pelo seletor do coordenador
  let units: { id: number; name: string }[] = []
  if (isCoordinator) {
    units = await db
      .select({ id: estabelecimentos.id, name: estabelecimentos.estabelecimento })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.isActive, true))
      .orderBy(estabelecimentos.estabelecimento)
  }

  // Resolve o nome da unidade ativa para o título da página
  if (filterUnitIds !== null && filterUnitIds.length === 1) {
    const unitId = filterUnitIds[0]!
    if (isCoordinator) {
      const found = units.find((u) => u.id === unitId)
      activeUnitName = found?.name ?? 'Unidade desconhecida'
    } else {
      const row = await db
        .select({ name: estabelecimentos.estabelecimento })
        .from(estabelecimentos)
        .where(eq(estabelecimentos.id, unitId))
        .limit(1)
      activeUnitName = row[0]?.name ?? 'Minha unidade'
    }
  } else if (isAttendant && scope === 'responsible') {
    activeUnitName = 'Sob minha responsabilidade'
  }

  const rows = await db.query.referrals.findMany({
    where: (r, { and, eq: eqOp }) => {
      const statusFilter = inArray(r.status, ['active', 'pending_reassessment', 'suspended'])
      const notDeleted = isNull(r.deletedAt)
      if (filterUnitIds === null) {
        return and(statusFilter, notDeleted)
      }
      if (filterUnitIds.length === 1) {
        return and(statusFilter, notDeleted, eqOp(r.healthUnitId, filterUnitIds[0]!))
      }
      return and(statusFilter, notDeleted, inArray(r.healthUnitId, filterUnitIds))
    },
    with: {
      patient: true,
      healthUnit: true,
      prosthesisTypes: {
        with: { prosthesisType: true },
      },
    },
    orderBy: [
      desc(referrals.hasOmbudsmanFlag),
      desc(referrals.hasAccidentFlag),
      asc(referrals.introductionDate),
    ],
  })

  // Conta tentativas de contato sem resposta por encaminhamento — alerta CON
  const referralIds = rows.map((r) => r.id)
  const noAnswerMap = new Map<number, number>()
  const consecutiveMissesMap = new Map<number, number>()

  if (referralIds.length > 0) {
    const noAnswerCounts = await db
      .select({ referralId: contactAttempts.referralId, total: count() })
      .from(contactAttempts)
      .where(and(eq(contactAttempts.result, 'no_answer'), inArray(contactAttempts.referralId, referralIds)))
      .groupBy(contactAttempts.referralId)
    for (const row of noAnswerCounts) {
      noAnswerMap.set(row.referralId, row.total)
    }

    // Calcula faltas consecutivas — ordena do mais recente para o mais antigo e conta a sequência inicial de 'absent'
    const apptOutcomes = await db
      .select({
        referralId: appointments.referralId,
        outcome: appointments.outcome,
        scheduledDate: appointments.scheduledDate,
        id: appointments.id,
      })
      .from(appointments)
      .where(and(isNotNull(appointments.outcome), inArray(appointments.referralId, referralIds)))
      .orderBy(desc(appointments.scheduledDate), desc(appointments.id))

    const byReferral = new Map<number, string[]>()
    for (const appt of apptOutcomes) {
      if (!byReferral.has(appt.referralId)) byReferral.set(appt.referralId, [])
      byReferral.get(appt.referralId)!.push(appt.outcome!)
    }
    for (const [refId, outcomes] of byReferral) {
      let streak = 0
      for (const outcome of outcomes) {
        if (outcome === 'absent') streak++
        else break
      }
      if (streak > 0) consecutiveMissesMap.set(refId, streak)
    }
  }

  const items = rows.map((r) => {
    const age = calcAge(r.patient.birthDate)
    const daysInQueue = daysSince(r.introductionDate)
    return {
      id: r.id,
      patientName: r.patient.fullName,
      age,
      isElderly: age >= 60,
      unitName: r.healthUnit.estabelecimento,
      introductionDate: r.introductionDate,
      daysInQueue,
      isDelayed: daysInQueue >= delayDays,
      status: r.status,
      isSuspended: r.status === 'suspended',
      hasOmbudsmanFlag: r.hasOmbudsmanFlag,
      hasAccidentFlag: r.hasAccidentFlag,
      serviceOrderNumber: r.serviceOrderNumber,
      prosthesisTypes: r.prosthesisTypes.map((p) => p.prosthesisType.name),
      noAnswerCount: noAnswerMap.get(r.id) ?? 0,
      consecutiveMisses: consecutiveMissesMap.get(r.id) ?? 0,
    }
  })

  return {
    items,
    isCoordinator,
    isAttendant,
    canCreateReferral: user.role === 'dentist' || user.role === 'coordinator',
    units,
    activeUnitId: filterUnitIds?.length === 1 ? (filterUnitIds[0] ?? null) : null,
    activeUnitName,
    scope,
    delayDays,
  }
}

export const actions: Actions = {
  // Ativa/desativa flag OUV ou ACI diretamente da fila
  toggle_flag: async ({ locals, request }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')

    const data = await request.formData()
    const referralId = parseInt(data.get('referralId') as string, 10)
    const flag = data.get('flag') as string

    if (isNaN(referralId) || !['ombudsman', 'accident'].includes(flag)) {
      return fail(400, { error: 'Dados inválidos' })
    }

    // OUV: exclusivo do coordenador; ACI: qualquer perfil pode alternar
    if (flag === 'ombudsman' && user.role !== 'coordinator') {
      return fail(403, { error: 'Sem permissão' })
    }

    const row = await db.query.referrals.findFirst({
      where: (r, { eq: eqFn }) => eqFn(r.id, referralId),
      columns: { hasOmbudsmanFlag: true, hasAccidentFlag: true },
    })

    if (!row) return fail(404, { error: 'Encaminhamento não encontrado' })

    if (flag === 'ombudsman') {
      await db
        .update(referrals)
        .set({ hasOmbudsmanFlag: !row.hasOmbudsmanFlag, updatedAt: new Date() })
        .where(eq(referrals.id, referralId))
    } else {
      await db
        .update(referrals)
        .set({ hasAccidentFlag: !row.hasAccidentFlag, updatedAt: new Date() })
        .where(eq(referrals.id, referralId))
    }

    return { toggled: true }
  },

  // Registra tentativa de contato com o paciente diretamente da fila (sem abrir ficha completa)
  add_contact: async ({ locals, request }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['coordinator', 'attendant'].includes(user.role)) return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const referralId = parseInt(data.get('referralId') as string, 10)
    const channel = data.get('channel') as string
    const result = data.get('result') as string
    const notes = (data.get('notes') as string)?.trim() || null
    const attemptedAtRaw = data.get('attemptedAt') as string

    if (isNaN(referralId)) return fail(400, { error: 'ID inválido' })
    if (!['phone', 'whatsapp', 'in_person'].includes(channel)) return fail(422, { error: 'Canal inválido' })
    if (!['confirmed', 'no_answer', 'cancelled'].includes(result)) return fail(422, { error: 'Resultado inválido' })
    if (!attemptedAtRaw) return fail(422, { error: 'Data/hora obrigatória' })

    await db.insert(contactAttempts).values({
      referralId,
      channel: channel as 'phone' | 'whatsapp' | 'in_person',
      result: result as 'confirmed' | 'no_answer' | 'cancelled',
      notes,
      attemptedAt: new Date(attemptedAtRaw),
      contactedBy: user.appId,
    })

    return { contactAdded: true }
  },

  // Coordenador ou atendente libera vaga após 5 tentativas sem resposta
  release_slot: async ({ locals, request }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['coordinator', 'attendant'].includes(user.role)) return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const referralId = parseInt(data.get('referralId') as string, 10)
    if (isNaN(referralId)) return fail(400, { error: 'Dados inválidos' })

    await db
      .update(referrals)
      .set({ status: 'inactive', inactivationReason: 'dropout', updatedAt: new Date() })
      .where(eq(referrals.id, referralId))

    return { released: true }
  },

  // Suspende ou reativa encaminhamento — exclusivo do coordenador
  // Ao reativar, retorna para 'active'; ajuste fino via edição completa em /fila/[id]
  toggle_suspend: async ({ locals, request }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (user.role !== 'coordinator') return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const referralId = parseInt(data.get('referralId') as string, 10)
    if (isNaN(referralId)) return fail(400, { error: 'Dados inválidos' })

    const row = await db.query.referrals.findFirst({
      where: (r, { eq: eqFn }) => eqFn(r.id, referralId),
      columns: { status: true },
    })

    if (!row) return fail(404, { error: 'Encaminhamento não encontrado' })

    const newStatus = row.status === 'suspended' ? 'active' : 'suspended'
    await db
      .update(referrals)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(referrals.id, referralId))

    return { toggled: true }
  },
}
