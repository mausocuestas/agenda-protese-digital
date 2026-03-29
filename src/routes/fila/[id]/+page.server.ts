import type { PageServerLoad } from './$types'
import { redirect, error } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { isNull } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  const id = parseInt(params.id, 10)
  if (isNaN(id)) error(400, 'ID inválido')

  const row = await db.query.referrals.findFirst({
    where: (r, { and, eq }) => and(eq(r.id, id), isNull(r.deletedAt)),
    with: {
      patient: true,
      healthUnit: true,
      creator: true,
      prosthesisTypes: {
        with: { prosthesisType: true },
      },
      notes: {
        with: { creator: true },
        orderBy: (n, { desc }) => [desc(n.createdAt)],
      },
      appointments: {
        with: { healthUnit: true },
        orderBy: (a, { asc }) => [asc(a.scheduledDate), asc(a.scheduledTime)],
      },
    },
  })

  if (!row) error(404, 'Encaminhamento não encontrado')

  // Controle de acesso: não-coordenador só vê encaminhamentos da sua unidade
  if (user.role !== 'coordinator' && row.healthUnitId !== user.defaultUnitId) {
    error(403, 'Acesso negado')
  }

  const age = calcAge(row.patient.birthDate)
  const daysInQueue = daysSince(row.introductionDate)

  return {
    referral: {
      id: row.id,
      status: row.status,
      inactivationReason: row.inactivationReason,
      introductionDate: row.introductionDate,
      daysInQueue,
      isDelayed: daysInQueue >= 180,
      serviceOrderNumber: row.serviceOrderNumber,
      hasOmbudsmanFlag: row.hasOmbudsmanFlag,
      hasAccidentFlag: row.hasAccidentFlag,
      createdAt: row.createdAt.toISOString(),
      createdByName: row.creator.name,
      prosthesisTypes: row.prosthesisTypes.map((p) => p.prosthesisType.name),
      unitName: row.healthUnit.estabelecimento,
    },
    patient: {
      id: row.patient.id,
      fullName: row.patient.fullName,
      cpf: row.patient.cpf,
      birthDate: row.patient.birthDate,
      age,
      isElderly: age >= 60,
      phone: row.patient.phone,
    },
    notes: row.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdByName: n.creator.name,
      createdAt: n.createdAt.toISOString(),
    })),
    appointments: row.appointments.map((a) => ({
      id: a.id,
      appointmentNumber: a.appointmentNumber,
      unitName: a.healthUnit.estabelecimento,
      scheduledDate: a.scheduledDate,
      scheduledTime: a.scheduledTime,
      outcome: a.outcome,
      refusedReason: a.refusedReason,
      prosthesisReadyAt: a.prosthesisReadyAt?.toISOString() ?? null,
      prosthesisReceivedAt: a.prosthesisReceivedAt?.toISOString() ?? null,
    })),
  }
}
