import type { PageServerLoad, Actions } from './$types'
import { redirect, error, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { eq, isNull } from 'drizzle-orm'
import { calcAge, daysSince } from '$lib/utils'
import { patients, referrals, estabelecimentos, prosthesisTypes, referralProsthesisTypes } from '$lib/server/db/index'

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
  const canEditReferral = user.role === 'coordinator'

  // Todos os tipos de prótese disponíveis — usados no select de edição do encaminhamento
  const allProsthesisTypes = canEditReferral
    ? await db.select({ id: prosthesisTypes.id, name: prosthesisTypes.name }).from(prosthesisTypes).orderBy(prosthesisTypes.name)
    : []

  return {
    canEditPatient,
    canEditReferral,
    units,
    allProsthesisTypes,
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
      prosthesisTypeIds: row.prosthesisTypes.map((p) => p.prosthesisTypeId),
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
      nextDurationEstimate: a.nextDurationEstimate,
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

  // Atualiza dados do encaminhamento — apenas coordenador
  update_referral: async ({ locals, params, request }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (user.role !== 'coordinator') return fail(403, { referralError: 'Sem permissão' })

    const referralId = parseInt(params.id, 10)
    if (isNaN(referralId)) return fail(400, { referralError: 'ID inválido' })

    const data = await request.formData()
    const status = data.get('status') as string
    const introductionDate = data.get('introductionDate') as string
    const serviceOrderNumber = (data.get('serviceOrderNumber') as string)?.trim() || null
    // Checkboxes: presença no FormData = marcado; ausência = desmarcado
    const hasOmbudsmanFlag = data.has('hasOmbudsmanFlag')
    const hasAccidentFlag = data.has('hasAccidentFlag')
    const inactivationReason = (data.get('inactivationReason') as string) || null
    const selectedTypeIds = data.getAll('prosthesisTypeIds').map((v) => parseInt(v as string, 10))

    const validStatuses = ['active', 'pending_reassessment', 'suspended', 'inactive']
    if (!validStatuses.includes(status)) return fail(400, { referralError: 'Status inválido' })
    if (!introductionDate) return fail(400, { referralError: 'Data de entrada obrigatória' })
    if (status === 'inactive' && !inactivationReason) {
      return fail(400, { referralError: 'Selecione o motivo de inativação' })
    }
    if (selectedTypeIds.length === 0) {
      return fail(400, { referralError: 'Selecione ao menos um tipo de prótese' })
    }

    await db
      .update(referrals)
      .set({
        status: status as 'active' | 'pending_reassessment' | 'suspended' | 'inactive',
        introductionDate,
        serviceOrderNumber,
        hasOmbudsmanFlag,
        hasAccidentFlag,
        inactivationReason: status === 'inactive' ? (inactivationReason as 'dropout' | 'death' | 'cancellation') : null,
        updatedAt: new Date(),
      })
      .where(eq(referrals.id, referralId))

    // Atualiza tipos de prótese: remove todos e reinseere os selecionados
    await db.delete(referralProsthesisTypes).where(eq(referralProsthesisTypes.referralId, referralId))
    await db.insert(referralProsthesisTypes).values(
      selectedTypeIds.map((typeId) => ({ referralId, prosthesisTypeId: typeId }))
    )

    return { referralUpdated: true }
  },
}
