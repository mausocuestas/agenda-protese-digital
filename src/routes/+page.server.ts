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
import { and, eq, isNull, isNotNull, inArray, gte, count, sql } from 'drizzle-orm'

// Gera os últimos N meses em formato YYYY-MM, do mais antigo ao mais recente
function lastMonths(n: number): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return result
}

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

  // ── Gráficos históricos (últimos 6 meses) — visíveis apenas para coordinator ──
  const chartMonths = lastMonths(6)

  // Data de corte: 1º dia de 6 meses atrás
  const sixMonthsAgo = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 6)
    d.setDate(1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })()

  // Encaminhamentos abertos por mês (introductionDate)
  const referralsByMonthRaw = await db
    .select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${referrals.introductionDate}::date), 'YYYY-MM')`,
      count: count(),
    })
    .from(referrals)
    .where(and(isNull(referrals.deletedAt), gte(referrals.introductionDate, sixMonthsAgo)))
    .groupBy(sql`DATE_TRUNC('month', ${referrals.introductionDate}::date)`)
    .orderBy(sql`DATE_TRUNC('month', ${referrals.introductionDate}::date)`)

  // Entregas realizadas por mês (4ª consulta attended)
  const deliveriesByMonthRaw = await db
    .select({
      month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${appointments.scheduledDate}::date), 'YYYY-MM')`,
      count: count(),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.appointmentNumber, 4),
        eq(appointments.outcome, 'attended'),
        gte(appointments.scheduledDate, sixMonthsAgo)
      )
    )
    .groupBy(sql`DATE_TRUNC('month', ${appointments.scheduledDate}::date)`)
    .orderBy(sql`DATE_TRUNC('month', ${appointments.scheduledDate}::date)`)

  // Garante que todos os meses do intervalo aparecem no array (zeros incluídos)
  const referralsByMonth = chartMonths.map((m) => {
    const found = referralsByMonthRaw.find((r) => r.month === m)
    return Number(found?.count ?? 0)
  })
  const deliveriesByMonth = chartMonths.map((m) => {
    const found = deliveriesByMonthRaw.find((r) => r.month === m)
    return Number(found?.count ?? 0)
  })

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
    chartMonths,
    referralsByMonth,
    deliveriesByMonth,
  }
}
