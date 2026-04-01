import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { referrals, estabelecimentos, unitResponsibilities } from '$lib/server/db/index'
import { isNull, inArray, eq, desc, asc } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  const isCoordinator = user.role === 'coordinator'
  const isAttendant = user.role === 'attendant'

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
      isDelayed: daysInQueue >= 180,
      status: r.status,
      isSuspended: r.status === 'suspended',
      hasOmbudsmanFlag: r.hasOmbudsmanFlag,
      hasAccidentFlag: r.hasAccidentFlag,
      serviceOrderNumber: r.serviceOrderNumber,
      prosthesisTypes: r.prosthesisTypes.map((p) => p.prosthesisType.name),
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
