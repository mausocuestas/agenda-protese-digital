import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { patients, referrals, appointments, estabelecimentos } from '$lib/server/db/index'
import { eq, isNull, asc, count, desc } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Visão geral de pacientes disponível para coordenador e atendente
  const allowedRoles = ['coordinator', 'attendant']
  if (!allowedRoles.includes(user.role)) redirect(302, '/fila')

  // Todos os pacientes ativos (sem soft delete), com unidade de saúde
  const allPatients = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      cpf: patients.cpf,
      phone: patients.phone,
      healthUnitId: patients.healthUnitId,
      unitName: estabelecimentos.estabelecimento,
    })
    .from(patients)
    .leftJoin(estabelecimentos, eq(patients.healthUnitId, estabelecimentos.id))
    .where(isNull(patients.deletedAt))
    .orderBy(asc(patients.fullName))

  if (allPatients.length === 0) {
    return { patients: [] }
  }

  // Todos os encaminhamentos (sem soft delete), mais recente por paciente via ordenação
  const allReferrals = await db
    .select({
      id: referrals.id,
      patientId: referrals.patientId,
      healthUnitId: referrals.healthUnitId,
      status: referrals.status,
      inactivationReason: referrals.inactivationReason,
      introductionDate: referrals.introductionDate,
    })
    .from(referrals)
    .where(isNull(referrals.deletedAt))
    .orderBy(desc(referrals.createdAt))

  // Contagem de consultas com desfecho por encaminhamento
  const apptCountRows = await db
    .select({ referralId: appointments.referralId, total: count() })
    .from(appointments)
    .groupBy(appointments.referralId)

  const apptCountMap = Object.fromEntries(apptCountRows.map((r) => [r.referralId, r.total]))

  // Próximo agendamento por encaminhamento (sem desfecho, mais próximo)
  const nextApptRows = await db
    .select({
      referralId: appointments.referralId,
      scheduledDate: appointments.scheduledDate,
    })
    .from(appointments)
    .where(isNull(appointments.outcome))
    .orderBy(asc(appointments.scheduledDate))

  // Guarda apenas o próximo agendamento por referral (primeiro sem desfecho)
  const nextApptMap: Record<number, string> = {}
  for (const row of nextApptRows) {
    if (!(row.referralId in nextApptMap)) {
      nextApptMap[row.referralId] = row.scheduledDate
    }
  }

  // Mapa: patientId → encaminhamento mais recente (allReferrals já está em desc)
  const latestReferralByPatient: Record<number, (typeof allReferrals)[0]> = {}
  for (const r of allReferrals) {
    if (!(r.patientId in latestReferralByPatient)) {
      latestReferralByPatient[r.patientId] = r
    }
  }

  const patientList = allPatients.map((p) => {
    const referral = latestReferralByPatient[p.id]

    if (!referral) {
      return {
        id: p.id,
        fullName: p.fullName,
        cpf: p.cpf,
        phone: p.phone,
        unitName: p.unitName ?? '—',
        referralId: null as number | null,
        status: null as string | null,
        inactivationReason: null as string | null,
        introductionDate: null as string | null,
        appointmentCount: 0,
        nextAppointmentDate: null as string | null,
      }
    }

    return {
      id: p.id,
      fullName: p.fullName,
      cpf: p.cpf,
      phone: p.phone,
      unitName: p.unitName ?? '—',
      referralId: referral.id,
      status: referral.status,
      inactivationReason: referral.inactivationReason ?? null,
      introductionDate: referral.introductionDate,
      appointmentCount: apptCountMap[referral.id] ?? 0,
      nextAppointmentDate: nextApptMap[referral.id] ?? null,
    }
  })

  // Ordena por próxima consulta decrescente (nulos ao final)
  patientList.sort((a, b) => {
    if (a.nextAppointmentDate && b.nextAppointmentDate) {
      return a.nextAppointmentDate < b.nextAppointmentDate ? 1 : -1
    }
    if (a.nextAppointmentDate) return -1
    if (b.nextAppointmentDate) return 1
    return 0
  })

  return { patients: patientList }
}
