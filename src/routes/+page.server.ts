import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  referrals,
  appointments,
  conformityAssessments,
  coordinationApprovals,
  satisfactionCalls,
} from '$lib/server/db/index'
import { and, eq, isNull, isNotNull, inArray, gte, count } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Não-coordenadores ficam limitados à própria unidade
  const unitId = user.role !== 'coordinator' ? (user.defaultUnitId ?? null) : null

  // Visibilidade por seção (mesma lógica das telas específicas)
  const canSeeFila = ['dentist', 'attendant', 'coordinator'].includes(user.role)
  const canSeeAwaitingReady = ['third_party', 'coordinator'].includes(user.role)
  const canSeeAwaitingReceival = ['attendant', 'coordinator'].includes(user.role)
  const canAssessConformity = ['dentist', 'coordinator'].includes(user.role)
  const canApprove = user.role === 'coordinator'
  const canCallSatisfaction = ['attendant', 'coordinator'].includes(user.role)

  // ── Fila ────────────────────────────────────────────────────────────────────
  let filaCount = 0
  if (canSeeFila) {
    const [row] = await db
      .select({ count: count() })
      .from(referrals)
      .where(
        and(
          inArray(referrals.status, ['active', 'pending_reassessment']),
          isNull(referrals.deletedAt),
          unitId ? eq(referrals.healthUnitId, unitId) : undefined
        )
      )
    filaCount = Number(row?.count ?? 0)
  }

  // ── Custódia — aguardando confecção ─────────────────────────────────────────
  let awaitingReadyCount = 0
  if (canSeeAwaitingReady) {
    const [row] = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          gte(appointments.appointmentNumber, 2),
          eq(appointments.outcome, 'attended'),
          isNull(appointments.prosthesisReadyAt),
          unitId ? eq(appointments.healthUnitId, unitId) : undefined
        )
      )
    awaitingReadyCount = Number(row?.count ?? 0)
  }

  // ── Custódia — prontas para receber ─────────────────────────────────────────
  let awaitingReceivalCount = 0
  if (canSeeAwaitingReceival) {
    const [row] = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          gte(appointments.appointmentNumber, 2),
          isNotNull(appointments.prosthesisReadyAt),
          isNull(appointments.prosthesisReceivedAt),
          unitId ? eq(appointments.healthUnitId, unitId) : undefined
        )
      )
    awaitingReceivalCount = Number(row?.count ?? 0)
  }

  // ── Qualidade — avaliação de conformidade pendente ───────────────────────────
  // Dataset pequeno → findMany + filter em JS (mesma estratégia da tela /qualidade)
  let awaitingConformityCount = 0
  if (canAssessConformity) {
    const fourthAppts = await db.query.appointments.findMany({
      where: and(
        eq(appointments.appointmentNumber, 4),
        eq(appointments.outcome, 'attended'),
        unitId ? eq(appointments.healthUnitId, unitId) : undefined
      ),
      with: { conformityAssessment: true },
      columns: { id: true },
    })
    awaitingConformityCount = fourthAppts.filter((a) => !a.conformityAssessment).length
  }

  // ── Qualidade — aprovação da coordenação pendente ────────────────────────────
  let awaitingApprovalCount = 0
  if (canApprove) {
    const assessments = await db.query.conformityAssessments.findMany({
      with: { referral: { with: { coordinationApproval: true }, columns: { id: true } } },
      columns: { id: true },
    })
    awaitingApprovalCount = assessments.filter((ca) => !ca.referral.coordinationApproval).length
  }

  // ── Qualidade — ligação de satisfação pendente ───────────────────────────────
  let awaitingSatisfactionCount = 0
  if (canCallSatisfaction) {
    const approvals = await db.query.coordinationApprovals.findMany({
      with: { referral: { with: { satisfactionCall: true }, columns: { id: true } } },
      columns: { id: true },
    })
    awaitingSatisfactionCount = approvals.filter((cap) => !cap.referral.satisfactionCall).length
  }

  // ── Qualidade — consultas na unidade pendentes ───────────────────────────────
  let pendingUnitAppointmentsCount = 0
  if (canCallSatisfaction) {
    const [row] = await db
      .select({ count: count() })
      .from(satisfactionCalls)
      .where(
        and(
          eq(satisfactionCalls.needsUnitAppointment, true),
          eq(satisfactionCalls.isUnitAppointmentResolved, false)
        )
      )
    pendingUnitAppointmentsCount = Number(row?.count ?? 0)
  }

  return {
    canSeeFila,
    canSeeAwaitingReady,
    canSeeAwaitingReceival,
    canAssessConformity,
    canApprove,
    canCallSatisfaction,
    filaCount,
    awaitingReadyCount,
    awaitingReceivalCount,
    awaitingConformityCount,
    awaitingApprovalCount,
    awaitingSatisfactionCount,
    pendingUnitAppointmentsCount,
  }
}
