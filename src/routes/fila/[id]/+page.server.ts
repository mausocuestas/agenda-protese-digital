import type { PageServerLoad, Actions } from './$types'
import { redirect, error, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { eq, isNull } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'
import { patients, referrals, estabelecimentos } from '$lib/server/db/index'

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

  // Lista de unidades ativas — usada no select de edição de dados do paciente
  const units = await db
    .select({ id: estabelecimentos.id, name: estabelecimentos.estabelecimento })
    .from(estabelecimentos)
    .where(eq(estabelecimentos.isActive, true))
    .orderBy(estabelecimentos.estabelecimento)

  const canEditPatient = ['coordinator', 'attendant', 'dentist'].includes(user.role)

  return {
    canEditPatient,
    units,
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
      healthUnitId: row.patient.healthUnitId,
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

export const actions: Actions = {
  // Atualiza dados cadastrais do paciente — disponível para coordinator, attendant e dentist
  update_patient: async ({ locals, params, request }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')

    const allowedRoles = ['coordinator', 'attendant', 'dentist']
    if (!allowedRoles.includes(user.role)) return fail(403, { error: 'Sem permissão' })

    const referralId = parseInt(params.id, 10)
    if (isNaN(referralId)) return fail(400, { error: 'ID inválido' })

    const data = await request.formData()
    const fullName = (data.get('fullName') as string)?.trim()
    const birthDate = data.get('birthDate') as string
    const phone = (data.get('phone') as string)?.trim()
    const healthUnitId = parseInt(data.get('healthUnitId') as string, 10)

    if (!fullName || !birthDate || !phone || !healthUnitId) {
      return fail(400, { error: 'Preencha todos os campos obrigatórios' })
    }

    // Busca o encaminhamento para obter o patientId e validar acesso
    const referral = await db.query.referrals.findFirst({
      where: (r, { and, eq: eqFn }) => and(eqFn(r.id, referralId), isNull(r.deletedAt)),
    })

    if (!referral) return fail(404, { error: 'Encaminhamento não encontrado' })

    // Não-coordenador só pode editar pacientes da sua unidade
    if (user.role !== 'coordinator' && referral.healthUnitId !== user.defaultUnitId) {
      return fail(403, { error: 'Acesso negado' })
    }

    // Atualiza dados do paciente
    await db
      .update(patients)
      .set({ fullName, birthDate, phone, healthUnitId, updatedAt: new Date() })
      .where(eq(patients.id, referral.patientId))

    // Se a unidade mudou, atualiza também o encaminhamento
    if (healthUnitId !== referral.healthUnitId) {
      await db
        .update(referrals)
        .set({ healthUnitId, updatedAt: new Date() })
        .where(eq(referrals.id, referralId))
    }

    return { updateSuccess: true }
  },
}
