import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  appointments,
  conformityAssessments,
  coordinationApprovals,
  satisfactionCalls,
} from '$lib/server/db/index'
import { and, eq } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Dentista e coordenador avaliam conformidade
  const canAssessConformity = user.role === 'dentist' || user.role === 'coordinator'
  // Apenas coordenador aprova e emite NF
  const canApprove = user.role === 'coordinator'
  // Atendente e coordenador fazem a ligação de satisfação
  const canCallSatisfaction = user.role === 'attendant' || user.role === 'coordinator'

  // Filtro de unidade para dentista/atendente — coordenador vê tudo
  const unitFilter =
    user.role !== 'coordinator' && user.defaultUnitId
      ? eq(appointments.healthUnitId, user.defaultUnitId)
      : undefined

  // Seção 1: 4ª consultas realizadas sem avaliação de conformidade
  // Busca todas e filtra em JS — dataset pequeno (~dezenas de registros por vez)
  const rawFourth = canAssessConformity
    ? await db.query.appointments.findMany({
        where: and(
          eq(appointments.appointmentNumber, 4),
          eq(appointments.outcome, 'attended'),
          unitFilter
        ),
        with: {
          referral: {
            with: {
              patient: true,
              conformityAssessment: true,
            },
          },
          healthUnit: true,
          conformityAssessment: true,
        },
        orderBy: (a, { asc }) => [asc(a.attendedAt)],
      })
    : []

  const awaitingConformity = rawFourth.filter((a) => !a.conformityAssessment)

  // Seção 2: avaliações de conformidade registradas, sem aprovação da coordenação
  const rawAssessments = canApprove
    ? await db.query.conformityAssessments.findMany({
        with: {
          referral: {
            with: {
              patient: true,
              healthUnit: true,
              coordinationApproval: true,
            },
          },
        },
        orderBy: (ca, { asc }) => [asc(ca.assessedAt)],
      })
    : []

  const awaitingApproval = rawAssessments.filter((ca) => !ca.referral.coordinationApproval)

  // Seção 3: aprovações registradas, sem ligação de satisfação
  const rawApprovals = canCallSatisfaction
    ? await db.query.coordinationApprovals.findMany({
        with: {
          referral: {
            with: {
              patient: true,
              healthUnit: true,
              satisfactionCall: true,
            },
          },
        },
        orderBy: (cap, { asc }) => [asc(cap.approvedAt)],
      })
    : []

  const awaitingSatisfaction = rawApprovals.filter((cap) => !cap.referral.satisfactionCall)

  // Seção 4: ligações com pendência de consulta na unidade não resolvida
  const pendingUnitAppointments = canCallSatisfaction
    ? await db.query.satisfactionCalls.findMany({
        where: and(
          eq(satisfactionCalls.needsUnitAppointment, true),
          eq(satisfactionCalls.isUnitAppointmentResolved, false)
        ),
        with: {
          referral: {
            with: {
              patient: true,
              healthUnit: true,
            },
          },
        },
        orderBy: (sc, { asc }) => [asc(sc.calledAt)],
      })
    : []

  return {
    canAssessConformity,
    canApprove,
    canCallSatisfaction,
    awaitingConformity: awaitingConformity.map((a) => ({
      appointmentId: a.id,
      referralId: a.referralId,
      scheduledDate: a.scheduledDate,
      attendedAt: a.attendedAt?.toISOString() ?? null,
      patientName: a.referral.patient.fullName,
      patientPhone: a.referral.patient.phone,
      unitName: a.healthUnit.estabelecimento,
    })),
    awaitingApproval: awaitingApproval.map((ca) => ({
      conformityId: ca.id,
      referralId: ca.referralId,
      appointmentId: ca.appointmentId,
      finalVerdict: ca.finalVerdict,
      assessedAt: ca.assessedAt.toISOString(),
      isVisibleToThirdParty: ca.isVisibleToThirdParty,
      patientName: ca.referral.patient.fullName,
      unitName: ca.referral.healthUnit.estabelecimento,
    })),
    awaitingSatisfaction: awaitingSatisfaction.map((cap) => ({
      approvalId: cap.id,
      referralId: cap.referralId,
      approvedAt: cap.approvedAt.toISOString(),
      patientName: cap.referral.patient.fullName,
      patientPhone: cap.referral.patient.phone,
      unitName: cap.referral.healthUnit.estabelecimento,
    })),
    pendingUnitAppointments: pendingUnitAppointments.map((sc) => ({
      satisfactionCallId: sc.id,
      referralId: sc.referralId,
      calledAt: sc.calledAt.toISOString(),
      result: sc.result,
      patientName: sc.referral.patient.fullName,
      patientPhone: sc.referral.patient.phone,
      unitName: sc.referral.healthUnit.estabelecimento,
    })),
  }
}

export const actions: Actions = {
  // Dentista registra avaliação de conformidade
  assess_conformity: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['dentist', 'coordinator'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const fd = await request.formData()
    const appointmentId = parseInt(fd.get('appointmentId') as string, 10)
    const referralId = parseInt(fd.get('referralId') as string, 10)
    const adaptationOk = fd.get('adaptationOk') === 'true'
    const adaptationNotes = (fd.get('adaptationNotes') as string)?.trim() || null
    const occlusionOk = fd.get('occlusionOk') === 'true'
    const occlusionNotes = (fd.get('occlusionNotes') as string)?.trim() || null
    const materialOk = fd.get('materialOk') === 'true'
    const materialNotes = (fd.get('materialNotes') as string)?.trim() || null
    const finalVerdict = fd.get('finalVerdict') as 'approved' | 'refused'
    const refusalReason = (fd.get('refusalReason') as string)?.trim() || null

    if (isNaN(appointmentId) || isNaN(referralId)) {
      return fail(400, { message: 'IDs inválidos' })
    }
    if (!['approved', 'refused'].includes(finalVerdict)) {
      return fail(400, { message: 'Parecer inválido' })
    }
    if (finalVerdict === 'refused' && !refusalReason) {
      return fail(400, { message: 'Motivo da recusa obrigatório' })
    }
    if (!adaptationOk && !adaptationNotes) {
      return fail(400, { message: 'Observação obrigatória quando adaptação não está conforme' })
    }
    if (!occlusionOk && !occlusionNotes) {
      return fail(400, { message: 'Observação obrigatória quando oclusão não está conforme' })
    }
    if (!materialOk && !materialNotes) {
      return fail(400, { message: 'Observação obrigatória quando material não está conforme' })
    }

    const existing = await db.query.conformityAssessments.findFirst({
      where: eq(conformityAssessments.referralId, referralId),
    })
    if (existing) return fail(422, { message: 'Avaliação já registrada' })

    await db.insert(conformityAssessments).values({
      referralId,
      appointmentId,
      adaptationOk,
      adaptationNotes: adaptationNotes ?? undefined,
      occlusionOk,
      occlusionNotes: occlusionNotes ?? undefined,
      materialOk,
      materialNotes: materialNotes ?? undefined,
      finalVerdict,
      refusalReason: refusalReason ?? undefined,
      isVisibleToThirdParty: false,
      assessedBy: user.appId,
      assessedAt: new Date(),
    })

    return { success: true }
  },

  // Coordenador aprova e registra número da NF
  approve_coordination: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (user.role !== 'coordinator') {
      return fail(403, { message: 'Apenas coordenador pode aprovar' })
    }

    const fd = await request.formData()
    const referralId = parseInt(fd.get('referralId') as string, 10)
    const invoiceNumber = (fd.get('invoiceNumber') as string)?.trim()

    if (isNaN(referralId)) return fail(400, { message: 'ID inválido' })
    if (!invoiceNumber) return fail(400, { message: 'Número da NF obrigatório' })

    const existing = await db.query.coordinationApprovals.findFirst({
      where: eq(coordinationApprovals.referralId, referralId),
    })
    if (existing) return fail(422, { message: 'Aprovação já registrada' })

    await db.insert(coordinationApprovals).values({
      referralId,
      invoiceNumber,
      approvedBy: user.appId,
      approvedAt: new Date(),
    })

    return { success: true }
  },

  // Atendente registra ligação de satisfação do paciente
  register_satisfaction_call: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['attendant', 'coordinator'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const fd = await request.formData()
    const referralId = parseInt(fd.get('referralId') as string, 10)
    const result = fd.get('result') as 'great' | 'reasonable' | 'difficulties'
    const needsUnitAppointment = fd.get('needsUnitAppointment') === 'true'
    const notes = (fd.get('notes') as string)?.trim() || null

    if (isNaN(referralId)) return fail(400, { message: 'ID inválido' })
    if (!['great', 'reasonable', 'difficulties'].includes(result)) {
      return fail(400, { message: 'Resultado inválido' })
    }

    const existing = await db.query.satisfactionCalls.findFirst({
      where: eq(satisfactionCalls.referralId, referralId),
    })
    if (existing) return fail(422, { message: 'Ligação já registrada' })

    await db.insert(satisfactionCalls).values({
      referralId,
      calledAt: new Date(),
      result,
      needsUnitAppointment,
      isUnitAppointmentResolved: false,
      notes: notes ?? undefined,
      calledBy: user.appId,
    })

    return { success: true }
  },

  // Coordenador alterna visibilidade da avaliação de conformidade para o terceirizado
  toggle_third_party_visibility: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (user.role !== 'coordinator') {
      return fail(403, { message: 'Apenas coordenador pode alterar visibilidade' })
    }

    const fd = await request.formData()
    const conformityId = parseInt(fd.get('conformityId') as string, 10)
    if (isNaN(conformityId)) return fail(400, { message: 'ID inválido' })

    const existing = await db.query.conformityAssessments.findFirst({
      where: eq(conformityAssessments.id, conformityId),
    })
    if (!existing) return fail(404, { message: 'Avaliação não encontrada' })

    await db
      .update(conformityAssessments)
      .set({ isVisibleToThirdParty: !existing.isVisibleToThirdParty })
      .where(eq(conformityAssessments.id, conformityId))

    return { success: true }
  },

  // Atendente marca que a consulta na unidade foi agendada
  resolve_unit_appointment: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['attendant', 'coordinator'].includes(user.role)) {
      return fail(403, { message: 'Sem permissão' })
    }

    const fd = await request.formData()
    const satisfactionCallId = parseInt(fd.get('satisfactionCallId') as string, 10)
    if (isNaN(satisfactionCallId)) return fail(400, { message: 'ID inválido' })

    const existing = await db.query.satisfactionCalls.findFirst({
      where: eq(satisfactionCalls.id, satisfactionCallId),
    })
    if (!existing) return fail(404, { message: 'Registro não encontrado' })
    if (existing.isUnitAppointmentResolved) {
      return fail(422, { message: 'Consulta já marcada como resolvida' })
    }

    await db
      .update(satisfactionCalls)
      .set({ isUnitAppointmentResolved: true })
      .where(eq(satisfactionCalls.id, satisfactionCallId))

    return { success: true }
  },
}
