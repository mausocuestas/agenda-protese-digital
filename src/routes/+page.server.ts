import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  referrals,
  appointments,
  conformityAssessments,
  coordinationApprovals,
  satisfactionCalls,
  systemConfigs,
  thirdPartySchedules,
} from '$lib/server/db/index'
import { and, eq, isNull, isNotNull, inArray, gte, lte, count, sql } from 'drizzle-orm'
import { timeToMinutes } from '$lib/slots'

// Retorna segunda e domingo da semana atual (ISO: semana começa na segunda)
function getWeekBoundaries(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const day = now.getDay() // 0 = domingo
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(now)
  mon.setDate(now.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { weekStart: fmt(mon), weekEnd: fmt(sun) }
}

// Calcula quantos slots cabem em uma agenda com base na duração padrão e no almoço
function scheduleSlots(s: {
  startTime: string
  endTime: string
  lunchStart: string | null
  lunchEnd: string | null
  defaultDuration: number
}): number {
  let total = timeToMinutes(s.endTime) - timeToMinutes(s.startTime)
  if (s.lunchStart && s.lunchEnd) {
    total -= timeToMinutes(s.lunchEnd) - timeToMinutes(s.lunchStart)
  }
  return Math.max(0, Math.floor(total / s.defaultDuration))
}

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
  const delayConfig = await db.query.systemConfigs.findFirst({
    where: (c, { eq: eqFn }) => eqFn(c.key, 'delay_days'),
    columns: { value: true },
  })
  const delayDays = parseInt(delayConfig?.value ?? '180', 10)

  // Data de corte: hoje - delayDays
  const delayCutoff = (() => {
    const d = new Date()
    d.setDate(d.getDate() - delayDays)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  let filaCount = 0
  let delayedCount = 0
  if (canSeeFila) {
    const [rowTotal] = await db
      .select({ count: count() })
      .from(referrals)
      .where(
        and(
          inArray(referrals.status, ['active', 'pending_reassessment']),
          isNull(referrals.deletedAt),
          unitId ? eq(referrals.healthUnitId, unitId) : undefined
        )
      )
    filaCount = Number(rowTotal?.count ?? 0)

    const [rowDelayed] = await db
      .select({ count: count() })
      .from(referrals)
      .where(
        and(
          inArray(referrals.status, ['active', 'pending_reassessment']),
          isNull(referrals.deletedAt),
          lte(referrals.introductionDate, delayCutoff),
          unitId ? eq(referrals.healthUnitId, unitId) : undefined
        )
      )
    delayedCount = Number(rowDelayed?.count ?? 0)
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

  // ── Capacidade semanal — visível apenas para o coordenador ─────────────────────
  let weekCapacity = 0
  let weekOccupied = 0
  if (canApprove) {
    const { weekStart, weekEnd } = getWeekBoundaries()

    // Total de slots disponíveis nas agendas configuradas para esta semana
    const schedules = await db.query.thirdPartySchedules.findMany({
      where: and(
        gte(thirdPartySchedules.scheduledDate, weekStart),
        lte(thirdPartySchedules.scheduledDate, weekEnd)
      ),
      columns: {
        startTime: true,
        endTime: true,
        lunchStart: true,
        lunchEnd: true,
        defaultDuration: true,
      },
    })
    weekCapacity = schedules.reduce((sum, s) => sum + scheduleSlots(s), 0)

    // Slots já ocupados por agendamentos confirmados ou pendentes esta semana
    const [occRow] = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          gte(appointments.scheduledDate, weekStart),
          lte(appointments.scheduledDate, weekEnd)
        )
      )
    weekOccupied = Math.min(Number(occRow?.count ?? 0), weekCapacity)
  }
  const weekAvailable = Math.max(0, weekCapacity - weekOccupied)

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
    delayedCount,
    delayDays,
    awaitingReadyCount,
    awaitingReceivalCount,
    awaitingConformityCount,
    awaitingApprovalCount,
    awaitingSatisfactionCount,
    pendingUnitAppointmentsCount,
    weekCapacity,
    weekOccupied,
    weekAvailable,
    chartMonths,
    referralsByMonth,
    deliveriesByMonth,
  }
}
