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
  // Todos os perfis podem ver o histórico de recebidas
  const canSeeHistory = true

  // Filtro de unidade — não-coordenador só vê sua unidade
  const unitFilter =
    user.role !== 'coordinator' && user.defaultUnitId
      ? eq(appointments.healthUnitId, user.defaultUnitId)
      : undefined

  // Custódia começa na consulta 1 (escaneamento): após comparecer, a peça vai pro laboratório
  const CUSTODY_FROM_APPT = 1

  // Grupo 1: consulta realizada (attended), custódia ativa, prótese ainda não marcada como pronta
  const awaitingReady = canSeeAwaitingReady
    ? await db.query.appointments.findMany({
        where: and(
          gte(appointments.appointmentNumber, CUSTODY_FROM_APPT),
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

  // Grupo 2: prótese marcada como pronta, mas UBS ainda não confirmou recebimento
  const awaitingReceival = canSeeAwaitingReceival
    ? await db.query.appointments.findMany({
        where: and(
          gte(appointments.appointmentNumber, CUSTODY_FROM_APPT),
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

  // Grupo 3: fluxo completo — prótese recebida pela UBS (histórico)
  const received = canSeeHistory
    ? await db.query.appointments.findMany({
        where: and(
          gte(appointments.appointmentNumber, CUSTODY_FROM_APPT),
          isNotNull(appointments.prosthesisReceivedAt),
          unitFilter
        ),
        with: {
          referral: {
            with: { patient: true, healthUnit: true },
          },
          healthUnit: true,
          prosthesisReceiptConfirmer: true,
        },
        orderBy: (a, { desc }) => [desc(a.prosthesisReceivedAt)],
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
      prosthesisReceivedAt: a.prosthesisReceivedAt?.toISOString() ?? null,
      serviceOrderNumber: a.referral.serviceOrderNumber ?? null,
    }
  }

  function serializeReceived(a: (typeof received)[number]) {
    return {
      id: a.id,
      referralId: a.referralId,
      appointmentNumber: a.appointmentNumber,
      appointmentLabel:
        appointmentLabel[a.appointmentNumber] ?? `Consulta ${a.appointmentNumber}`,
      scheduledDate: a.scheduledDate,
      unitName: a.healthUnit.estabelecimento,
      patientName: a.referral.patient.fullName,
      serviceOrderNumber: a.referral.serviceOrderNumber ?? null,
      prosthesisReadyAt: a.prosthesisReadyAt?.toISOString() ?? null,
      prosthesisReceivedAt: a.prosthesisReceivedAt!.toISOString(),
      receivedByName: a.prosthesisReceiptConfirmer?.name ?? null,
    }
  }

  return {
    canSeeAwaitingReady,
    canSeeAwaitingReceival,
    isCoordinator: user.role === 'coordinator',
    awaitingReady: awaitingReady.map(serializeAppt),
    awaitingReceival: awaitingReceival.map(serializeAppt),
    received: received.map(serializeReceived),
  }
}

export const actions: Actions = {
  // Terceirizado insere ou atualiza o número da OS (apenas coordenador pode alterar após inserção)
  set_service_order: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['coordinator', 'third_party'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const formData = await request.formData()
    const apptId = parseInt(formData.get('apptId') as string, 10)
    const osNumber = (formData.get('serviceOrderNumber') as string)?.trim()

    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })
    if (!osNumber) return fail(422, { message: 'Número da OS é obrigatório' })

    const appt = await db.query.appointments.findFirst({
      where: eq(appointments.id, apptId),
      with: { referral: true },
    })
    if (!appt) return fail(404, { message: 'Consulta não encontrada' })

    // OS já preenchida: apenas coordenador pode alterar
    if (appt.referral.serviceOrderNumber && user.role !== 'coordinator') {
      return fail(403, { message: 'Número da OS já registrado. Somente o coordenador pode alterar.' })
    }

    await db
      .update(referrals)
      .set({ serviceOrderNumber: osNumber, updatedAt: new Date() })
      .where(eq(referrals.id, appt.referralId))

    return { success: true }
  },

  // Terceirizado marca prótese como pronta para envio à UBS
  mark_prosthesis_ready: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['coordinator', 'third_party'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const formData = await request.formData()
    const apptId = parseInt(formData.get('apptId') as string, 10)
    if (isNaN(apptId)) return fail(400, { message: 'ID inválido' })

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
