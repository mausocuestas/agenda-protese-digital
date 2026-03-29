import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { referrals, estabelecimentos } from '$lib/server/db/index'
import { isNull, inArray, eq, desc, asc } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  const isCoordinator = user.role === 'coordinator'

  // Coordenador pode filtrar por unidade via query param; outros ficam fixos na sua unidade
  let filterUnitId: number | null = null
  let activeUnitName = 'Fila de Encaminhamentos'

  if (isCoordinator) {
    const param = url.searchParams.get('unit')
    filterUnitId = param ? parseInt(param, 10) : null
  } else {
    filterUnitId = user.defaultUnitId
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
  if (filterUnitId !== null) {
    if (isCoordinator) {
      const found = units.find((u) => u.id === filterUnitId)
      activeUnitName = found?.name ?? 'Unidade desconhecida'
    } else {
      const row = await db
        .select({ name: estabelecimentos.estabelecimento })
        .from(estabelecimentos)
        .where(eq(estabelecimentos.id, filterUnitId))
        .limit(1)
      activeUnitName = row[0]?.name ?? 'Minha unidade'
    }
  }

  const rows = await db.query.referrals.findMany({
    where: (r, { and, eq: eqOp }) => {
      const statusFilter = inArray(r.status, ['active', 'pending_reassessment'])
      const notDeleted = isNull(r.deletedAt)
      if (filterUnitId !== null) {
        return and(statusFilter, notDeleted, eqOp(r.healthUnitId, filterUnitId))
      }
      return and(statusFilter, notDeleted)
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
      hasOmbudsmanFlag: r.hasOmbudsmanFlag,
      hasAccidentFlag: r.hasAccidentFlag,
      serviceOrderNumber: r.serviceOrderNumber,
      prosthesisTypes: r.prosthesisTypes.map((p) => p.prosthesisType.name),
    }
  })

  return {
    items,
    isCoordinator,
    units,
    activeUnitId: filterUnitId,
    activeUnitName,
  }
}
