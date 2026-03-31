// Contagens de pendências por seção — usadas pelos badges da navegação
// Reflete exatamente o mesmo filtro das páginas fila, custódia e qualidade

import { db } from '$lib/server/db/client'
import {
  referrals,
  appointments,
  conformityAssessments,
  coordinationApprovals,
  satisfactionCalls,
} from '$lib/server/db/index'
import { and, count, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { AppUser } from '$lib/auth/types'

export type NotificationCounts = {
  fila: number
  custodia: number
  qualidade: number
}

export async function getNotificationCounts(user: AppUser): Promise<NotificationCounts> {
  let filaCount = 0
  let custodiaCount = 0
  let qualidadeCount = 0

  // ─── Fila ─────────────────────────────────────────────────────────────────
  // Encaminhamentos ativos/pendentes visíveis para o role do usuário
  if (['dentist', 'attendant', 'coordinator'].includes(user.role)) {
    const unitFilter =
      user.role !== 'coordinator' && user.defaultUnitId
        ? eq(referrals.healthUnitId, user.defaultUnitId)
        : undefined

    const result = await db
      .select({ total: count() })
      .from(referrals)
      .where(
        and(
          inArray(referrals.status, ['active', 'pending_reassessment']),
          isNull(referrals.deletedAt),
          unitFilter
        )
      )

    filaCount = result[0]?.total ?? 0
  }

  // ─── Custódia ─────────────────────────────────────────────────────────────
  const custodiaUnitFilter =
    user.role !== 'coordinator' && user.defaultUnitId
      ? eq(appointments.healthUnitId, user.defaultUnitId)
      : undefined

  // Terceirizado e coordenador: próteses aguardando marcação como pronta
  if (user.role === 'third_party' || user.role === 'coordinator') {
    const result = await db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          gte(appointments.appointmentNumber, 2),
          eq(appointments.outcome, 'attended'),
          isNull(appointments.prosthesisReadyAt),
          custodiaUnitFilter
        )
      )
    custodiaCount += result[0]?.total ?? 0
  }

  // Atendente e coordenador: próteses prontas aguardando recebimento
  if (user.role === 'attendant' || user.role === 'coordinator') {
    const result = await db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          gte(appointments.appointmentNumber, 2),
          isNotNull(appointments.prosthesisReadyAt),
          isNull(appointments.prosthesisReceivedAt),
          custodiaUnitFilter
        )
      )
    custodiaCount += result[0]?.total ?? 0
  }

  // ─── Qualidade ────────────────────────────────────────────────────────────
  const qualUnitFilter =
    user.role !== 'coordinator' && user.defaultUnitId
      ? eq(appointments.healthUnitId, user.defaultUnitId)
      : undefined

  // Dentista + coordenador: 4ªs consultas sem avaliação de conformidade
  if (user.role === 'dentist' || user.role === 'coordinator') {
    const rawFourth = await db.query.appointments.findMany({
      where: and(
        eq(appointments.appointmentNumber, 4),
        eq(appointments.outcome, 'attended'),
        qualUnitFilter
      ),
      with: { conformityAssessment: true },
      columns: { id: true },
    })
    qualidadeCount += rawFourth.filter((a) => !a.conformityAssessment).length
  }

  // Coordenador: avaliações sem aprovação da coordenação
  if (user.role === 'coordinator') {
    const rawAssessments = await db.query.conformityAssessments.findMany({
      with: {
        referral: {
          with: { coordinationApproval: true },
          columns: { id: true },
        },
      },
      columns: { id: true },
    })
    qualidadeCount += rawAssessments.filter((ca) => !ca.referral.coordinationApproval).length
  }

  // Atendente + coordenador: aprovações sem ligação de satisfação
  if (user.role === 'attendant' || user.role === 'coordinator') {
    const rawApprovals = await db.query.coordinationApprovals.findMany({
      with: {
        referral: {
          with: { satisfactionCall: true },
          columns: { id: true },
        },
      },
      columns: { id: true },
    })
    qualidadeCount += rawApprovals.filter((cap) => !cap.referral.satisfactionCall).length

    // Ligações com consulta na unidade pendente
    const result = await db
      .select({ total: count() })
      .from(satisfactionCalls)
      .where(
        and(
          eq(satisfactionCalls.needsUnitAppointment, true),
          eq(satisfactionCalls.isUnitAppointmentResolved, false)
        )
      )
    qualidadeCount += result[0]?.total ?? 0
  }

  return { fila: filaCount, custodia: custodiaCount, qualidade: qualidadeCount }
}
