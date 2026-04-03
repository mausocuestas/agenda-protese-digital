import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  thirdPartySchedules,
  estabelecimentos,
  appointments,
  referrals,
  patients,
  prosthesisTypes,
  referralProsthesisTypes,
} from '$lib/server/db/index'
import { eq, desc, asc, inArray, isNull, and, count, ne } from 'drizzle-orm'
import { timeToMinutes, generateSlots } from '$lib/slots'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  const allowedRoles = ['attendant', 'coordinator', 'third_party']
  if (!allowedRoles.includes(user.role)) redirect(302, '/fila')

  // Visitas ordenadas por data decrescente (mais recente primeiro)
  const rawSchedules = await db
    .select({
      id: thirdPartySchedules.id,
      scheduledDate: thirdPartySchedules.scheduledDate,
      startTime: thirdPartySchedules.startTime,
      endTime: thirdPartySchedules.endTime,
      lunchStart: thirdPartySchedules.lunchStart,
      lunchEnd: thirdPartySchedules.lunchEnd,
      defaultDuration: thirdPartySchedules.defaultDuration,
      unitId: thirdPartySchedules.healthUnitId,
      unitName: estabelecimentos.estabelecimento,
    })
    .from(thirdPartySchedules)
    .innerJoin(estabelecimentos, eq(thirdPartySchedules.healthUnitId, estabelecimentos.id))
    .orderBy(desc(thirdPartySchedules.scheduledDate), asc(estabelecimentos.estabelecimento))

  const canSeePatients = user.role === 'coordinator' || user.role === 'attendant'
  const canManageSlots = user.role === 'coordinator' || user.role === 'attendant'
  const canEditSchedule = user.role === 'coordinator'

  // Tipo estendido de slot — inclui dados do agendamento para o modal de detalhes
  type ExtendedSlot = {
    startTime: string
    endTime: string
    duration: number
    status: 'available' | 'occupied'
    patientName?: string
    appointmentNumber?: number
    appointmentId?: number
    referralId?: number
    outcome?: string | null
  }

  // Mapa de agendamentos por data+unidade com scheduledDuration
  type ApptRow = {
    id: number
    referralId: number
    scheduledDate: string
    healthUnitId: number
    scheduledTime: string
    scheduledDuration: number | null
    appointmentNumber: number
    patientName: string
    outcome: string | null
  }
  const apptsByKey: Record<string, ApptRow[]> = {}

  if (canSeePatients && rawSchedules.length > 0) {
    const dates = [...new Set(rawSchedules.map((s) => s.scheduledDate))]
    const apptRows = await db
      .select({
        id: appointments.id,
        referralId: appointments.referralId,
        scheduledDate: appointments.scheduledDate,
        healthUnitId: appointments.healthUnitId,
        scheduledTime: appointments.scheduledTime,
        scheduledDuration: appointments.scheduledDuration,
        appointmentNumber: appointments.appointmentNumber,
        patientName: patients.fullName,
        outcome: appointments.outcome,
      })
      .from(appointments)
      .innerJoin(referrals, eq(appointments.referralId, referrals.id))
      .innerJoin(patients, eq(referrals.patientId, patients.id))
      .where(inArray(appointments.scheduledDate, dates))
      .orderBy(asc(appointments.scheduledTime))

    for (const row of apptRows) {
      const key = `${row.scheduledDate}__${row.healthUnitId}`
      if (!apptsByKey[key]) apptsByKey[key] = []
      apptsByKey[key].push(row)
    }
  }

  // Encaminhamentos elegíveis por unidade — para o formulário de adição de paciente
  type EligibleReferral = {
    referralId: number
    patientName: string
    healthUnitId: number
    nextApptNumber: number
  }
  const eligibleByUnit: Record<number, EligibleReferral[]> = {}

  if (canManageSlots && rawSchedules.length > 0) {
    const activeReferrals = await db
      .select({
        referralId: referrals.id,
        patientName: patients.fullName,
        healthUnitId: referrals.healthUnitId,
      })
      .from(referrals)
      .innerJoin(patients, eq(referrals.patientId, patients.id))
      .where(and(eq(referrals.status, 'active'), isNull(referrals.deletedAt)))
      .orderBy(asc(patients.fullName))

    const apptCountRows = await db
      .select({ referralId: appointments.referralId, total: count() })
      .from(appointments)
      .groupBy(appointments.referralId)

    const apptCountMap = Object.fromEntries(apptCountRows.map((r) => [r.referralId, r.total]))

    for (const r of activeReferrals) {
      if (!eligibleByUnit[r.healthUnitId]) eligibleByUnit[r.healthUnitId] = []
      eligibleByUnit[r.healthUnitId].push({
        referralId: r.referralId,
        patientName: r.patientName,
        healthUnitId: r.healthUnitId,
        nextApptNumber: (apptCountMap[r.referralId] ?? 0) + 1,
      })
    }
  }

  // Constrói grid de slots por visita usando generateSlots()
  const schedules = rawSchedules.map((s) => {
    const key = `${s.scheduledDate}__${s.unitId}`
    const slotsForSchedule = apptsByKey[key] ?? []

    // Monta o grid usando a lógica centralizada em slots.ts
    const rawGrid = generateSlots({
      startTime: s.startTime,
      endTime: s.endTime,
      lunchStart: s.lunchStart ?? null,
      lunchEnd: s.lunchEnd ?? null,
      defaultDuration: s.defaultDuration,
      existingAppointments: slotsForSchedule.map((a) => ({
        scheduledTime: a.scheduledTime,
        scheduledDuration: a.scheduledDuration,
        patientName: a.patientName,
        appointmentNumber: a.appointmentNumber,
      })),
    })

    // Estende os slots ocupados com appointmentId, referralId e outcome
    const apptByStartTime = new Map(
      slotsForSchedule.map((a) => [a.scheduledTime.slice(0, 5), a])
    )
    const slotGrid: ExtendedSlot[] = rawGrid.map((slot) => {
      if (slot.status !== 'occupied') return slot
      const appt = apptByStartTime.get(slot.startTime)
      return {
        ...slot,
        appointmentId: appt?.id,
        referralId: appt?.referralId,
        outcome: appt?.outcome ?? null,
      }
    })

    const bookedReferralIds = new Set(slotsForSchedule.map((sl) => sl.referralId))
    const eligible = (eligibleByUnit[s.unitId] ?? []).filter(
      (r) => !bookedReferralIds.has(r.referralId)
    )

    return { ...s, slotGrid, eligible }
  })

  // Mapa de dados do paciente para o modal de detalhes — apenas coord/atendente
  type PatientModalData = {
    patientName: string
    cpf: string
    birthDate: string
    phone: string
    prosthesisTypes: string[]
    history: Array<{
      appointmentId: number
      appointmentNumber: number
      scheduledDate: string
      scheduledTime: string
      outcome: string | null
      unitName: string
    }>
  }
  const patientMap: Record<number, PatientModalData> = {}

  if (canSeePatients) {
    const occupiedReferralIds = new Set<number>()
    for (const s of schedules) {
      for (const slot of s.slotGrid) {
        if (slot.status === 'occupied' && slot.referralId != null) {
          occupiedReferralIds.add(slot.referralId)
        }
      }
    }
    const occupiedList = [...occupiedReferralIds]

    if (occupiedList.length > 0) {
      const patientInfoRows = await db
        .select({
          referralId: referrals.id,
          patientName: patients.fullName,
          cpf: patients.cpf,
          birthDate: patients.birthDate,
          phone: patients.phone,
        })
        .from(referrals)
        .innerJoin(patients, eq(referrals.patientId, patients.id))
        .where(inArray(referrals.id, occupiedList))

      const prosthesisRows = await db
        .select({
          referralId: referralProsthesisTypes.referralId,
          typeName: prosthesisTypes.name,
        })
        .from(referralProsthesisTypes)
        .innerJoin(prosthesisTypes, eq(referralProsthesisTypes.prosthesisTypeId, prosthesisTypes.id))
        .where(inArray(referralProsthesisTypes.referralId, occupiedList))

      const historyRows = await db
        .select({
          appointmentId: appointments.id,
          referralId: appointments.referralId,
          appointmentNumber: appointments.appointmentNumber,
          scheduledDate: appointments.scheduledDate,
          scheduledTime: appointments.scheduledTime,
          outcome: appointments.outcome,
          unitName: estabelecimentos.estabelecimento,
        })
        .from(appointments)
        .innerJoin(estabelecimentos, eq(appointments.healthUnitId, estabelecimentos.id))
        .where(inArray(appointments.referralId, occupiedList))
        .orderBy(asc(appointments.scheduledDate), asc(appointments.scheduledTime))

      const prosthesisByReferral: Record<number, string[]> = {}
      for (const row of prosthesisRows) {
        if (!prosthesisByReferral[row.referralId]) prosthesisByReferral[row.referralId] = []
        prosthesisByReferral[row.referralId].push(row.typeName)
      }

      const historyByReferral: Record<
        number,
        PatientModalData['history']
      > = {}
      for (const row of historyRows) {
        if (!historyByReferral[row.referralId]) historyByReferral[row.referralId] = []
        historyByReferral[row.referralId].push({
          appointmentId: row.appointmentId,
          appointmentNumber: row.appointmentNumber,
          scheduledDate: row.scheduledDate,
          scheduledTime: row.scheduledTime,
          outcome: row.outcome,
          unitName: row.unitName,
        })
      }

      for (const p of patientInfoRows) {
        patientMap[p.referralId] = {
          patientName: p.patientName,
          cpf: p.cpf,
          birthDate: p.birthDate,
          phone: p.phone,
          prosthesisTypes: prosthesisByReferral[p.referralId] ?? [],
          history: historyByReferral[p.referralId] ?? [],
        }
      }
    }
  }

  // Unidades ativas — apenas para o formulário de nova visita do coordenador
  let units: { id: number; name: string }[] = []
  if (user.role === 'coordinator') {
    units = await db
      .select({ id: estabelecimentos.id, name: estabelecimentos.estabelecimento })
      .from(estabelecimentos)
      .where(eq(estabelecimentos.isActive, true))
      .orderBy(estabelecimentos.estabelecimento)
  }

  return {
    schedules,
    patientMap,
    units,
    isCoordinator: user.role === 'coordinator',
    canSeePatients,
    canManageSlots,
    canEditSchedule,
  }
}

export const actions: Actions = {
  create: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const healthUnitId = parseInt(data.get('healthUnitId') as string, 10)
    const scheduledDate = data.get('scheduledDate') as string
    const startTime = data.get('startTime') as string
    const endTime = data.get('endTime') as string

    if (!healthUnitId || !scheduledDate || !startTime || !endTime) {
      return fail(400, { error: 'Preencha todos os campos' })
    }
    if (startTime >= endTime) {
      return fail(400, { error: 'Horário de início deve ser anterior ao de término' })
    }

    try {
      await db.insert(thirdPartySchedules).values({
        healthUnitId,
        scheduledDate,
        startTime,
        endTime,
        createdBy: user.appId,
      })
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { error: 'Já existe uma visita para essa unidade nessa data' })
      }
      return fail(500, { error: 'Erro ao salvar. Tente novamente.' })
    }

    return { success: true }
  },

  delete: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    if (!id) return fail(400, { error: 'ID inválido' })

    await db.delete(thirdPartySchedules).where(eq(thirdPartySchedules.id, id))
    return { success: true }
  },

  edit_schedule: async ({ locals, request }) => {
    const user = locals.user
    if (!user || user.role !== 'coordinator') return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    const scheduledDate = data.get('scheduledDate') as string
    const startTime = data.get('startTime') as string
    const endTime = data.get('endTime') as string

    if (!id || !scheduledDate || !startTime || !endTime) {
      return fail(400, { error: 'Preencha todos os campos' })
    }
    if (startTime >= endTime) {
      return fail(400, { error: 'Horário de início deve ser anterior ao de término' })
    }

    try {
      await db
        .update(thirdPartySchedules)
        .set({ scheduledDate, startTime, endTime })
        .where(eq(thirdPartySchedules.id, id))
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('unique')) {
        return fail(400, { error: 'Já existe uma visita para essa unidade nessa data' })
      }
      return fail(500, { error: 'Erro ao salvar. Tente novamente.' })
    }

    return { editSuccess: true }
  },

  add_appointment: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { slotError: 'Não autenticado' })

    const allowed = ['coordinator', 'attendant']
    if (!allowed.includes(user.role)) return fail(403, { slotError: 'Sem permissão' })

    const data = await request.formData()
    const scheduleId = parseInt(data.get('scheduleId') as string, 10)
    const referralId = parseInt(data.get('referralId') as string, 10)
    const scheduledTime = (data.get('scheduledTime') as string)?.trim()

    if (!scheduleId || !referralId || !scheduledTime) {
      return fail(400, { slotError: 'Preencha todos os campos' })
    }

    const schedule = await db.query.thirdPartySchedules.findFirst({
      where: eq(thirdPartySchedules.id, scheduleId),
    })
    if (!schedule) return fail(404, { slotError: 'Visita não encontrada' })

    const t = timeToMinutes(scheduledTime)
    if (t < timeToMinutes(schedule.startTime) || t > timeToMinutes(schedule.endTime)) {
      return fail(422, {
        slotError: `Horário fora da janela da visita (${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)})`,
      })
    }

    const referral = await db.query.referrals.findFirst({
      where: (r, { and: andOp, eq: eqOp }) => andOp(eqOp(r.id, referralId), isNull(r.deletedAt)),
    })
    if (!referral) return fail(404, { slotError: 'Encaminhamento não encontrado' })
    if (referral.status !== 'active') {
      return fail(422, { slotError: 'Encaminhamento não está ativo' })
    }

    const duplicate = await db.query.appointments.findFirst({
      where: (a, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(a.referralId, referralId),
          eqOp(a.scheduledDate, schedule.scheduledDate),
          eqOp(a.healthUnitId, schedule.healthUnitId)
        ),
    })
    if (duplicate) {
      return fail(400, { slotError: 'Paciente já agendado nessa data e unidade' })
    }

    const existing = await db.query.appointments.findMany({
      where: (a, { eq: eqOp }) => eqOp(a.referralId, referralId),
    })
    const appointmentNumber = existing.length + 1

    await db.insert(appointments).values({
      referralId,
      appointmentNumber,
      healthUnitId: schedule.healthUnitId,
      scheduledDate: schedule.scheduledDate,
      scheduledTime,
      createdBy: user.appId,
    })

    return { slotAdded: true }
  },

  edit_appointment: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { modalError: 'Não autenticado' })

    const allowed = ['coordinator', 'attendant']
    if (!allowed.includes(user.role)) return fail(403, { modalError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    const scheduledTime = (data.get('scheduledTime') as string)?.trim()

    if (!id || !scheduledTime) return fail(400, { modalError: 'Dados inválidos' })

    const appt = await db.query.appointments.findFirst({
      where: (a, { eq: eqOp }) => eqOp(a.id, id),
    })
    if (!appt) return fail(404, { modalError: 'Agendamento não encontrado' })
    if (appt.outcome) {
      return fail(400, { modalError: 'Não é possível alterar uma consulta com desfecho registrado' })
    }

    const schedule = await db.query.thirdPartySchedules.findFirst({
      where: (s, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(s.scheduledDate, appt.scheduledDate),
          eqOp(s.healthUnitId, appt.healthUnitId)
        ),
    })
    if (schedule) {
      const t2 = timeToMinutes(scheduledTime)
      if (t2 < timeToMinutes(schedule.startTime) || t2 > timeToMinutes(schedule.endTime)) {
        return fail(422, {
          modalError: `Horário fora da janela da visita (${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)})`,
        })
      }
    }

    await db
      .update(appointments)
      .set({ scheduledTime, updatedAt: new Date() })
      .where(eq(appointments.id, id))

    return { editApptSuccess: true }
  },

  remove_appointment: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { modalError: 'Não autenticado' })

    const allowedRoles = ['coordinator', 'attendant']
    if (!allowedRoles.includes(user.role)) return fail(403, { modalError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    if (!id) return fail(400, { modalError: 'ID inválido' })

    const appt = await db.query.appointments.findFirst({
      where: (a, { eq: eqFn }) => eqFn(a.id, id),
    })

    if (!appt) return fail(404, { modalError: 'Agendamento não encontrado' })
    if (appt.outcome) return fail(400, { modalError: 'Não é possível desmarcar uma consulta com desfecho já registrado' })

    await db.delete(appointments).where(eq(appointments.id, id))
    return { removeSuccess: true }
  },

  // Move um agendamento para outra visita (outra data/unidade)
  move_appointment: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { modalError: 'Não autenticado' })

    const allowed = ['coordinator', 'attendant']
    if (!allowed.includes(user.role)) return fail(403, { modalError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('appointmentId') as string, 10)
    const targetScheduleId = parseInt(data.get('targetScheduleId') as string, 10)
    const targetTime = (data.get('targetTime') as string)?.trim()

    if (!id || !targetScheduleId || !targetTime) return fail(400, { modalError: 'Dados inválidos' })

    const appt = await db.query.appointments.findFirst({
      where: (a, { eq: eqFn }) => eqFn(a.id, id),
    })
    if (!appt) return fail(404, { modalError: 'Agendamento não encontrado' })
    if (appt.outcome) return fail(400, { modalError: 'Não é possível mover uma consulta com desfecho registrado' })

    const targetSchedule = await db.query.thirdPartySchedules.findFirst({
      where: (s, { eq: eqFn }) => eqFn(s.id, targetScheduleId),
    })
    if (!targetSchedule) return fail(404, { modalError: 'Visita de destino não encontrada' })

    const t = timeToMinutes(targetTime)
    if (t < timeToMinutes(targetSchedule.startTime) || t > timeToMinutes(targetSchedule.endTime)) {
      return fail(422, {
        modalError: `Horário fora da janela da visita de destino (${targetSchedule.startTime.slice(0, 5)}–${targetSchedule.endTime.slice(0, 5)})`,
      })
    }

    // Verifica duplicidade no destino — excluindo o próprio agendamento
    const duplicates = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.referralId, appt.referralId),
          eq(appointments.scheduledDate, targetSchedule.scheduledDate),
          eq(appointments.healthUnitId, targetSchedule.healthUnitId),
          ne(appointments.id, id)
        )
      )
    if (duplicates.length > 0) {
      return fail(400, { modalError: 'Paciente já agendado nessa data e unidade de destino' })
    }

    await db
      .update(appointments)
      .set({
        scheduledDate: targetSchedule.scheduledDate,
        healthUnitId: targetSchedule.healthUnitId,
        scheduledTime: targetTime,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id))

    return { moveSuccess: true }
  },

  // Troca o paciente de um slot — mantém data, horário e unidade
  swap_patient: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { modalError: 'Não autenticado' })

    const allowed = ['coordinator', 'attendant']
    if (!allowed.includes(user.role)) return fail(403, { modalError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('appointmentId') as string, 10)
    const newReferralId = parseInt(data.get('newReferralId') as string, 10)

    if (!id || !newReferralId) return fail(400, { modalError: 'Dados inválidos' })

    const appt = await db.query.appointments.findFirst({
      where: (a, { eq: eqFn }) => eqFn(a.id, id),
    })
    if (!appt) return fail(404, { modalError: 'Agendamento não encontrado' })
    if (appt.outcome) return fail(400, { modalError: 'Não é possível trocar paciente com desfecho registrado' })

    const newReferral = await db.query.referrals.findFirst({
      where: (r, { and: andOp, eq: eqOp }) => andOp(eqOp(r.id, newReferralId), isNull(r.deletedAt)),
    })
    if (!newReferral) return fail(404, { modalError: 'Encaminhamento não encontrado' })
    if (newReferral.status !== 'active') return fail(422, { modalError: 'Encaminhamento não está ativo' })

    // Verifica se o novo paciente já está nessa data+unidade (excluindo o slot atual)
    const duplicates = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.referralId, newReferralId),
          eq(appointments.scheduledDate, appt.scheduledDate),
          eq(appointments.healthUnitId, appt.healthUnitId),
          ne(appointments.id, id)
        )
      )
    if (duplicates.length > 0) {
      return fail(400, { modalError: 'Este paciente já está agendado nessa data e unidade' })
    }

    // Número da consulta para o novo encaminhamento
    const existingForNew = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.referralId, newReferralId), ne(appointments.id, id)))
    const newAppointmentNumber = existingForNew.length + 1

    await db
      .update(appointments)
      .set({ referralId: newReferralId, appointmentNumber: newAppointmentNumber, updatedAt: new Date() })
      .where(eq(appointments.id, id))

    return { swapSuccess: true }
  },
}
