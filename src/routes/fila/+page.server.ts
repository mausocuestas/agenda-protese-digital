import type { PageServerLoad } from './$types'
import { db } from '$lib/server/db/client'
import { referrals } from '$lib/server/db/index'
import { isNull, inArray, desc, asc } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'

export const load: PageServerLoad = async () => {
  const rows = await db.query.referrals.findMany({
    where: (r, { and }) =>
      and(inArray(r.status, ['active', 'pending_reassessment']), isNull(r.deletedAt)),
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

  // Computa campos derivados que não vivem no banco
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
      isDelayed: daysInQueue >= 180, // > 6 meses → bloqueado para reavaliação
      status: r.status,
      hasOmbudsmanFlag: r.hasOmbudsmanFlag,
      hasAccidentFlag: r.hasAccidentFlag,
      serviceOrderNumber: r.serviceOrderNumber,
      prosthesisTypes: r.prosthesisTypes.map((p) => p.prosthesisType.name),
    }
  })

  return { items }
}
