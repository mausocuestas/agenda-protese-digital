import type { PageServerLoad, Actions } from './$types'
import { redirect, error, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { appointments, contactAttempts } from '$lib/server/db/index'
import { eq } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  const referralId = parseInt(params.id, 10)
  const apptId = parseInt(params.apptId, 10)
  if (isNaN(referralId) || isNaN(apptId)) error(400, 'ID inválido')

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.id, apptId),
    with: {
      referral: {
        with: { patient: true, healthUnit: true },
      },
      healthUnit: true,
      creator: true,
      contactAttempts: {
        with: { contactedBy: true },
        orderBy: (c, { desc }) => [desc(c.attemptedAt)],
      },
    },
  })

  if (!appt) error(404, 'Consulta não encontrada')
  if (appt.referralId !== referralId) error(400, 'Consulta não pertence a este encaminhamento')

  // Controle de acesso: não-coordenador só acessa encaminhamentos da sua unidade
  if (user.role !== 'coordinator' && appt.referral.healthUnitId !== user.defaultUnitId) {
    error(403, 'Acesso negado')
  }

  // Custódia de prótese só existe para consultas 2, 3 e 4
  const hasProsthesisCustody = appt.appointmentNumber >= 2

  return {
    referralId,
    patientName: appt.referral.patient.fullName,
    patientPhone: appt.referral.patient.phone,
    unitName: appt.referral.healthUnit.estabelecimento,
    appointment: {
      id: appt.id,
      appointmentNumber: appt.appointmentNumber,
      scheduledDate: appt.scheduledDate,
      scheduledTime: appt.scheduledTime,
      unitName: appt.healthUnit.estabelecimento,
      outcome: appt.outcome,
      refusedReason: appt.refusedReason,
      attendedAt: appt.attendedAt?.toISOString() ?? null,
      nextDurationEstimate: appt.nextDurationEstimate,
      prosthesisReadyAt: appt.prosthesisReadyAt?.toISOString() ?? null,
      prosthesisReceivedAt: appt.prosthesisReceivedAt?.toISOString() ?? null,
      createdByName: appt.creator.name,
      createdAt: appt.createdAt.toISOString(),
    },
    hasProsthesisCustody,
    contactAttempts: appt.contactAttempts.map((c) => ({
      id: c.id,
      channel: c.channel,
      result: c.result,
      attemptedAt: c.attemptedAt.toISOString(),
      notes: c.notes,
      contactedByName: c.contactedBy.name,
      whatsappDeadline: c.whatsappDeadline?.toISOString() ?? null,
    })),
    // Permissões granulares — computadas no servidor para evitar lógica duplicada no cliente
    canEditOutcome:
      !appt.outcome &&
      (user.role === 'attendant' || user.role === 'coordinator' || user.role === 'third_party'),
    canMarkReady:
      hasProsthesisCustody &&
      !appt.prosthesisReadyAt &&
      (user.role === 'coordinator' || user.role === 'third_party'),
    canConfirmReceived:
      hasProsthesisCustody &&
      !appt.prosthesisReceivedAt &&
      !!appt.prosthesisReadyAt &&
      (user.role === 'attendant' || user.role === 'coordinator'),
  }
}

export const actions: Actions = {
  // Registra se o paciente compareceu, faltou ou foi recusado pelo protético
  register_outcome: async ({ request, locals, params }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['attendant', 'coordinator', 'third_party'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão para registrar resultado' })
    }

    const apptId = parseInt(params.apptId, 10)
    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })

    const formData = await request.formData()
    const outcome = formData.get('outcome') as string
    const refusedReason = (formData.get('refusedReason') as string)?.trim() || null
    const nextEstimateRaw = formData.get('nextDurationEstimate') as string
    const nextDurationEstimate = nextEstimateRaw ? parseInt(nextEstimateRaw, 10) : null

    if (!['attended', 'absent', 'refused'].includes(outcome)) {
      return fail(422, { message: 'Selecione um resultado válido' })
    }
    if (outcome === 'refused' && !refusedReason) {
      return fail(422, { message: 'Informe o motivo da recusa' })
    }

    const existing = await db.query.appointments.findFirst({
      where: eq(appointments.id, apptId),
    })
    if (!existing) return fail(404, { message: 'Consulta não encontrada' })
    if (existing.outcome) return fail(422, { message: 'Resultado já registrado anteriormente' })

    await db
      .update(appointments)
      .set({
        outcome: outcome as 'attended' | 'absent' | 'refused',
        refusedReason,
        ...(outcome === 'attended' ? { attendedAt: new Date() } : {}),
        ...(nextDurationEstimate && [30, 60].includes(nextDurationEstimate)
          ? { nextDurationEstimate }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, apptId))

    return { success: true }
  },

  // Terceirizado informa que a prótese está pronta para retirada
  mark_prosthesis_ready: async ({ locals, params }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['coordinator', 'third_party'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const apptId = parseInt(params.apptId, 10)
    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })

    await db
      .update(appointments)
      .set({
        prosthesisReadyAt: new Date(),
        prosthesisReadyBy: user.appId,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, apptId))

    return { success: true }
  },

  // Atendente confirma que recebeu a prótese fisicamente na unidade
  confirm_received: async ({ locals, params }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['attendant', 'coordinator'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const apptId = parseInt(params.apptId, 10)
    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })

    await db
      .update(appointments)
      .set({
        prosthesisReceivedAt: new Date(),
        prosthesisReceivedBy: user.appId,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, apptId))

    return { success: true }
  },

  // Registra tentativa de contato com o paciente (auditoria para ouvidoria)
  add_contact: async ({ request, locals, params }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')

    const referralId = parseInt(params.id, 10)
    const apptId = parseInt(params.apptId, 10)
    if (isNaN(referralId) || isNaN(apptId)) return fail(400, { message: 'ID inválido' })

    const formData = await request.formData()
    const channel = formData.get('channel') as string
    const result = formData.get('result') as string
    const notes = (formData.get('notes') as string)?.trim() || null
    const attemptedAtRaw = (formData.get('attemptedAt') as string)?.trim()
    const whatsappDeadlineRaw = (formData.get('whatsappDeadline') as string)?.trim() || null

    if (!['phone', 'whatsapp', 'in_person'].includes(channel)) {
      return fail(422, { message: 'Canal de contato inválido' })
    }
    if (!['confirmed', 'no_answer', 'cancelled'].includes(result)) {
      return fail(422, { message: 'Resultado do contato inválido' })
    }
    if (!attemptedAtRaw) {
      return fail(422, { message: 'Informe a data e hora da tentativa' })
    }

    await db.insert(contactAttempts).values({
      referralId,
      appointmentId: apptId,
      channel: channel as 'phone' | 'whatsapp' | 'in_person',
      result: result as 'confirmed' | 'no_answer' | 'cancelled',
      notes,
      attemptedAt: new Date(attemptedAtRaw),
      whatsappDeadline: whatsappDeadlineRaw ? new Date(whatsappDeadlineRaw) : null,
      contactedBy: user.appId,
    })

    return { success: true }
  },
}
