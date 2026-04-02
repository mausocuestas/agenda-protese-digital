import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  estabelecimentos,
  appointments,
  referrals,
  patients,
  prosthesisTypes,
  referralProsthesisTypes,
  conformityAssessments,
  satisfactionCalls,
} from '$lib/server/db/index'
import { and, eq, isNotNull, gte, count, desc, sql } from 'drizzle-orm'

// Calcula a data de corte (YYYY-MM-DD) baseada no período selecionado
function getCutoff(period: string): string | null {
  const d = new Date()
  switch (period) {
    case '3m':
      d.setMonth(d.getMonth() - 3)
      break
    case '12m':
      d.setMonth(d.getMonth() - 12)
      break
    case 'ano':
      d.setMonth(0)
      d.setDate(1)
      break
    case 'tudo':
      return null
    default: // '6m'
      d.setMonth(d.getMonth() - 6)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')
  if (user.role !== 'coordinator') redirect(302, '/')

  const period = url.searchParams.get('periodo') ?? '6m'
  const cutoff = getCutoff(period)

  // ── 1. Atendimentos por unidade ─────────────────────────────────────────────
  // Usa join Drizzle com a tabela shared.estabelecimentos (cross-schema gerenciado pelo ORM)
  const atendimentosPorUnidadeRaw = await db
    .select({
      name: estabelecimentos.estabelecimento,
      count: count(),
    })
    .from(appointments)
    .innerJoin(estabelecimentos, eq(estabelecimentos.id, appointments.healthUnitId))
    .where(
      and(
        eq(appointments.outcome, 'attended'),
        cutoff ? gte(appointments.scheduledDate, cutoff) : undefined
      )
    )
    .groupBy(estabelecimentos.id, estabelecimentos.estabelecimento)
    .orderBy(desc(count()))

  const atendimentosPorUnidade = atendimentosPorUnidadeRaw.map((r) => ({
    name: r.name,
    count: Number(r.count),
  }))

  // ── 2. Próteses entregues por tipo ──────────────────────────────────────────
  // Entrega = consulta com prosthesisReceivedAt preenchido
  const protesesPorTipoRaw = await db
    .select({
      name: prosthesisTypes.name,
      count: count(),
    })
    .from(appointments)
    .innerJoin(
      referralProsthesisTypes,
      eq(referralProsthesisTypes.referralId, appointments.referralId)
    )
    .innerJoin(prosthesisTypes, eq(prosthesisTypes.id, referralProsthesisTypes.prosthesisTypeId))
    .where(
      and(
        isNotNull(appointments.prosthesisReceivedAt),
        cutoff ? gte(appointments.scheduledDate, cutoff) : undefined
      )
    )
    .groupBy(prosthesisTypes.id, prosthesisTypes.name)
    .orderBy(desc(count()))

  const protesesPorTipo = protesesPorTipoRaw.map((r) => ({
    name: r.name,
    count: Number(r.count),
  }))

  // ── 3. Próteses entregues por faixa etária ──────────────────────────────────
  // Idade calculada no momento da entrega (scheduled_date vs birth_date)
  // AGE() retorna interval; EXTRACT(YEAR) dá a parte em anos
  const rawIdade = await db.execute(sql`
    SELECT
      CASE
        WHEN EXTRACT(YEAR FROM AGE(a.scheduled_date::date, p.birth_date::date)) < 40 THEN 'Menos de 40'
        WHEN EXTRACT(YEAR FROM AGE(a.scheduled_date::date, p.birth_date::date)) < 60 THEN '40 a 59'
        WHEN EXTRACT(YEAR FROM AGE(a.scheduled_date::date, p.birth_date::date)) < 80 THEN '60 a 79'
        ELSE '80 ou mais'
      END AS age_group,
      COUNT(*)::int AS count
    FROM protese.appointments a
    JOIN protese.referrals r ON a.referral_id = r.id
    JOIN protese.patients p ON r.patient_id = p.id
    WHERE a.prosthesis_received_at IS NOT NULL
    ${cutoff ? sql`AND a.scheduled_date >= ${cutoff}::date` : sql``}
    GROUP BY age_group
    ORDER BY MIN(EXTRACT(YEAR FROM AGE(a.scheduled_date::date, p.birth_date::date)))
  `)

  type IdadeRow = { age_group: string; count: number }
  const protesesPorIdade = (rawIdade.rows as IdadeRow[]).map((r) => ({
    ageGroup: r.age_group,
    count: Number(r.count),
  }))

  // ── 4. Satisfação pós-entrega ───────────────────────────────────────────────
  const satisfacaoRaw = await db
    .select({ result: satisfactionCalls.result, count: count() })
    .from(satisfactionCalls)
    .where(cutoff ? gte(satisfactionCalls.calledAt, new Date(cutoff)) : undefined)
    .groupBy(satisfactionCalls.result)

  const satisfacao = {
    great: Number(satisfacaoRaw.find((r) => r.result === 'great')?.count ?? 0),
    reasonable: Number(satisfacaoRaw.find((r) => r.result === 'reasonable')?.count ?? 0),
    difficulties: Number(satisfacaoRaw.find((r) => r.result === 'difficulties')?.count ?? 0),
  }

  // ── 5. Não conformidades por critério ───────────────────────────────────────
  // Conta quantas avaliações tiveram cada critério marcado como false (não ok)
  const [naoConformRow] = await db
    .select({
      adaptation: sql<number>`SUM(CASE WHEN NOT adaptation_ok THEN 1 ELSE 0 END)::int`,
      occlusion: sql<number>`SUM(CASE WHEN NOT occlusion_ok THEN 1 ELSE 0 END)::int`,
      material: sql<number>`SUM(CASE WHEN NOT material_ok THEN 1 ELSE 0 END)::int`,
    })
    .from(conformityAssessments)
    .where(cutoff ? gte(conformityAssessments.assessedAt, new Date(cutoff)) : undefined)

  const naoConformidades = {
    adaptation: Number(naoConformRow?.adaptation ?? 0),
    occlusion: Number(naoConformRow?.occlusion ?? 0),
    material: Number(naoConformRow?.material ?? 0),
  }

  // ── 6. Recusas por fase ─────────────────────────────────────────────────────
  // Consulta recusada pelo terceirizado — agrupa por número da consulta (1-5+)
  const recusasRaw = await db
    .select({ phase: appointments.appointmentNumber, count: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.outcome, 'refused'),
        cutoff ? gte(appointments.scheduledDate, cutoff) : undefined
      )
    )
    .groupBy(appointments.appointmentNumber)
    .orderBy(appointments.appointmentNumber)

  const recusasPorFase = recusasRaw.map((r) => ({
    phase: r.phase,
    count: Number(r.count),
  }))

  // ── 7. Tempo médio ──────────────────────────────────────────────────────────
  // Espera: dias entre a introdução do encaminhamento e a 1ª consulta atendida
  const rawEspera = await db.execute(sql`
    SELECT ROUND(AVG(a.scheduled_date::date - r.introduction_date::date))::int AS avg_days
    FROM protese.appointments a
    JOIN protese.referrals r ON a.referral_id = r.id
    WHERE a.appointment_number = 1
      AND a.outcome = 'attended'
      ${cutoff ? sql`AND a.scheduled_date >= ${cutoff}::date` : sql``}
  `)

  // Conclusão: dias entre a introdução e o recebimento físico da prótese
  const rawConclusao = await db.execute(sql`
    SELECT ROUND(AVG(a.prosthesis_received_at::date - r.introduction_date::date))::int AS avg_days
    FROM protese.appointments a
    JOIN protese.referrals r ON a.referral_id = r.id
    WHERE a.prosthesis_received_at IS NOT NULL
      ${cutoff ? sql`AND a.prosthesis_received_at::date >= ${cutoff}::date` : sql``}
  `)

  type AvgRow = { avg_days: number | null }
  const avgWaitDays =
    rawEspera.rows.length > 0 ? (Number((rawEspera.rows[0] as AvgRow).avg_days) || null) : null
  const avgCompletionDays =
    rawConclusao.rows.length > 0
      ? (Number((rawConclusao.rows[0] as AvgRow).avg_days) || null)
      : null

  return {
    period,
    atendimentosPorUnidade,
    protesesPorTipo,
    protesesPorIdade,
    satisfacao,
    naoConformidades,
    recusasPorFase,
    avgWaitDays,
    avgCompletionDays,
  }
}
