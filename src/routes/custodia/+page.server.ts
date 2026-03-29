import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { appointments, referrals } from '$lib/server/db/index'
import { and, eq, isNull, isNotNull, gte } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Terceirizado e coordenador veem próteses aguardando marcação como pronta
  const canSeeAwaitingReady = user.role === 'third_party' || user.role === 'coordinator'
  // Atendente e coordenador veem próteses prontas aguardando recebimento na unidade
  const canSeeAwaitingReceival = user.role === 'attendant' || user.role === 'coordinator'

  // Filtro de unidade — não-coordenador só vê sua unidade
  const unitFilter =
    user.role !== 'coordinator' && user.defaultUnitId
      ? eq(appointments.healthUnitId, user.defaultUnitId)
      : undefined

  // Próteses aguardando marcação: consulta realizada (outcome=attended), custódia ativa, sem prosthesisReadyAt
  const awaitingReady = canSeeAwaitingReady
    ? await db.query.appointments.findMany({
        where: and(
          gte(appointments.appointmentNumber, 2),
          eq(appointments.outcome, 'attended'),
          isNull(appointments.prosthesisReadyAt),
          unitFilter
        ),
        with: {
          referral: {
            with: { patient: true, healthUnit: true },
          },
          healthUnit: true,
        },
        orderBy: (a, { asc }) => [asc(a.attendedAt)],
      })
    : []

  // Próteses prontas aguardando recebimento na unidade
  const awaitingReceival = canSeeAwaitingReceival
    ? await db.query.appointments.findMany({
        where: and(
          gte(appointments.appointmentNumber, 2),
          isNotNull(appointments.prosthesisReadyAt),
          isNull(appointments.prosthesisReceivedAt),
          unitFilter
        ),
        with: {
          referral: {
            with: { patient: true, healthUnit: true },
          },
          healthUnit: true,
        },
        orderBy: (a, { asc }) => [asc(a.prosthesisReadyAt)],
      })
    : []

  const appointmentLabel: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega definitiva',
  }

  function serializeAppt(a: (typeof awaitingReady)[number]) {
    return {
      id: a.id,
      referralId: a.referralId,
      appointmentNumber: a.appointmentNumber,
      appointmentLabel:
        appointmentLabel[a.appointmentNumber] ?? `Consulta ${a.appointmentNumber}`,
      scheduledDate: a.scheduledDate,
      scheduledTime: a.scheduledTime,
      unitName: a.healthUnit.estabelecimento,
      patientName: a.referral.patient.fullName,
      patientPhone: a.referral.patient.phone,
      attendedAt: a.attendedAt?.toISOString() ?? null,
      prosthesisReadyAt: a.prosthesisReadyAt?.toISOString() ?? null,
    }
  }

  return {
    canSeeAwaitingReady,
    canSeeAwaitingReceival,
    awaitingReady: awaitingReady.map(serializeAppt),
    awaitingReceival: awaitingReceival.map(serializeAppt),
  }
}

export const actions: Actions = {
  // Terceirizado marca prótese como pronta
  mark_prosthesis_ready: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['coordinator', 'third_party'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const formData = await request.formData()
    const apptId = parseInt(formData.get('apptId') as string, 10)
    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })

    // Verifica que a prótese ainda não foi marcada como pronta
    const appt = await db.query.appointments.findFirst({
      where: eq(appointments.id, apptId),
    })
    if (!appt) return fail(404, { message: 'Consulta não encontrada' })
    if (appt.prosthesisReadyAt) return fail(422, { message: 'Já marcada como pronta' })

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

  // Atendente confirma recebimento da prótese na unidade
  confirm_received: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['attendant', 'coordinator'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const formData = await request.formData()
    const apptId = parseInt(formData.get('apptId') as string, 10)
    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })

    // Verifica pré-requisitos
    const appt = await db.query.appointments.findFirst({
      where: eq(appointments.id, apptId),
    })
    if (!appt) return fail(404, { message: 'Consulta não encontrada' })
    if (!appt.prosthesisReadyAt) return fail(422, { message: 'Prótese ainda não foi marcada como pronta' })
    if (appt.prosthesisReceivedAt) return fail(422, { message: 'Recebimento já confirmado' })

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
}
