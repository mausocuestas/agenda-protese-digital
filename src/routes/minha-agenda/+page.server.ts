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
import { eq, gte, asc, inArray } from 'drizzle-orm'

type AppointmentRow = {
  id: number
  referralId: number
  appointmentNumber: number
  scheduledTime: string
  outcome: 'attended' | 'absent' | 'refused' | 'installed' | null
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

  // Janela: 60 dias atrás até o futuro indefinido
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Query 1: visitas do terceirizado dentro da janela (mesma abordagem de /agenda)
  const rawSchedules = await db
    .select({
      scheduleId: thirdPartySchedules.id,
      scheduledDate: thirdPartySchedules.scheduledDate,
      startTime: thirdPartySchedules.startTime,
      endTime: thirdPartySchedules.endTime,
      unitId: thirdPartySchedules.healthUnitId,
      unitName: estabelecimentos.estabelecimento,
    })
    .from(thirdPartySchedules)
    .innerJoin(estabelecimentos, eq(thirdPartySchedules.healthUnitId, estabelecimentos.id))
    .where(gte(thirdPartySchedules.scheduledDate, sixtyDaysAgo))
    .orderBy(asc(thirdPartySchedules.scheduledDate), asc(estabelecimentos.estabelecimento))

  // Sem visitas → retorna vazio imediatamente
  if (rawSchedules.length === 0) {
    return { scheduleGroups: [], today }
  }

  // Query 2: todos os agendamentos nas datas das visitas — mesma estratégia de /agenda
  // (inArray por data é mais robusto que leftJoin multi-coluna com tipos date)
  const dates = [...new Set(rawSchedules.map((s) => s.scheduledDate))]

  const apptRows = await db
    .select({
      id: appointments.id,
      referralId: appointments.referralId,
      scheduledDate: appointments.scheduledDate,
      healthUnitId: appointments.healthUnitId,
      scheduledTime: appointments.scheduledTime,
      appointmentNumber: appointments.appointmentNumber,
      outcome: appointments.outcome,
      prosthesisReadyAt: appointments.prosthesisReadyAt,
      prosthesisReceivedAt: appointments.prosthesisReceivedAt,
      patientName: patients.fullName,
    })
    .from(appointments)
    .innerJoin(referrals, eq(appointments.referralId, referrals.id))
    .innerJoin(patients, eq(referrals.patientId, patients.id))
    .where(inArray(appointments.scheduledDate, dates))
    .orderBy(asc(appointments.scheduledTime))

  // Indexa agendamentos por chave data__unidade — igual a /agenda
  const apptsByKey: Record<string, AppointmentRow[]> = {}
  for (const row of apptRows) {
    const key = `${row.scheduledDate}__${row.healthUnitId}`
    if (!apptsByKey[key]) apptsByKey[key] = []
    apptsByKey[key].push({
      id: row.id,
      referralId: row.referralId,
      appointmentNumber: row.appointmentNumber,
      scheduledTime: row.scheduledTime,
      outcome: row.outcome,
      prosthesisReadyAt: row.prosthesisReadyAt,
      prosthesisReceivedAt: row.prosthesisReceivedAt,
      patientName: row.patientName,
    })
  }

  // Constrói os grupos de visita vinculando os agendamentos correspondentes
  const scheduleGroups: ScheduleGroup[] = rawSchedules.map((s) => ({
    scheduleId: s.scheduleId,
    scheduledDate: s.scheduledDate,
    startTime: s.startTime,
    endTime: s.endTime,
    unitId: s.unitId,
    unitName: s.unitName,
    appointments: apptsByKey[`${s.scheduledDate}__${s.unitId}`] ?? [],
  }))

  return { scheduleGroups, today }
}
