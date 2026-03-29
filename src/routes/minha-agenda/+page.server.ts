import type { PageServerLoad } from './$types'
import { redirect } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  thirdPartySchedules,
  estabelecimentos,
  appointments,
  referrals,
  patients,
} from '$lib/server/db/index'
import { eq, gte, asc, and } from 'drizzle-orm'

type AppointmentRow = {
  id: number
  referralId: number
  appointmentNumber: number
  scheduledTime: string
  outcome: 'attended' | 'absent' | 'refused' | null
  prosthesisReadyAt: Date | null
  prosthesisReceivedAt: Date | null
  patientName: string
}

export type ScheduleGroup = {
  scheduleId: number
  scheduledDate: string
  startTime: string
  endTime: string
  unitId: number
  unitName: string
  appointments: AppointmentRow[]
}

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Apenas o terceirizado usa esta tela
  if (user.role !== 'third_party') redirect(302, '/agenda')

  const today = new Date().toISOString().slice(0, 10)

  // Visitas a partir de hoje com consultas agendadas para a mesma unidade+data
  const rows = await db
    .select({
      scheduleId: thirdPartySchedules.id,
      scheduledDate: thirdPartySchedules.scheduledDate,
      startTime: thirdPartySchedules.startTime,
      endTime: thirdPartySchedules.endTime,
      unitId: thirdPartySchedules.healthUnitId,
      unitName: estabelecimentos.estabelecimento,
      appointmentId: appointments.id,
      referralId: appointments.referralId,
      appointmentNumber: appointments.appointmentNumber,
      appointmentDate: appointments.scheduledDate,
      scheduledTime: appointments.scheduledTime,
      outcome: appointments.outcome,
      prosthesisReadyAt: appointments.prosthesisReadyAt,
      prosthesisReceivedAt: appointments.prosthesisReceivedAt,
      patientName: patients.fullName,
    })
    .from(thirdPartySchedules)
    .innerJoin(estabelecimentos, eq(thirdPartySchedules.healthUnitId, estabelecimentos.id))
    .leftJoin(
      appointments,
      // Vincula apenas consultas desta mesma visita (unidade + data coincidentes)
      and(
        eq(appointments.healthUnitId, thirdPartySchedules.healthUnitId),
        eq(appointments.scheduledDate, thirdPartySchedules.scheduledDate)
      )
    )
    .leftJoin(referrals, eq(appointments.referralId, referrals.id))
    .leftJoin(patients, eq(referrals.patientId, patients.id))
    .where(gte(thirdPartySchedules.scheduledDate, today))
    .orderBy(
      asc(thirdPartySchedules.scheduledDate),
      asc(estabelecimentos.estabelecimento),
      asc(appointments.scheduledTime)
    )

  // Agrupa linhas por scheduleId — cada visita recebe a lista das suas consultas
  const groupMap = new Map<number, ScheduleGroup>()

  for (const row of rows) {
    if (!groupMap.has(row.scheduleId)) {
      groupMap.set(row.scheduleId, {
        scheduleId: row.scheduleId,
        scheduledDate: row.scheduledDate,
        startTime: row.startTime,
        endTime: row.endTime,
        unitId: row.unitId,
        unitName: row.unitName,
        appointments: [],
      })
    }

    const group = groupMap.get(row.scheduleId)!

    // Ignora linhas sem consulta (visita sem agendamentos ainda)
    if (row.appointmentId === null || row.patientName === null) continue

    // Evita duplicatas por segurança
    if (!group.appointments.some((a) => a.id === row.appointmentId)) {
      group.appointments.push({
        id: row.appointmentId,
        referralId: row.referralId!,
        appointmentNumber: row.appointmentNumber!,
        scheduledTime: row.scheduledTime!,
        outcome: row.outcome,
        prosthesisReadyAt: row.prosthesisReadyAt,
        prosthesisReceivedAt: row.prosthesisReceivedAt,
        patientName: row.patientName,
      })
    }
  }

  return { scheduleGroups: Array.from(groupMap.values()) }
}
