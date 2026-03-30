import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  thirdPartySchedules,
  estabelecimentos,
  appointments,
  referrals,
  patients,
} from '$lib/server/db/index'
import { eq, asc, inArray, isNull, and, count } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Apenas roles com acesso à agenda
  const allowedRoles = ['attendant', 'coordinator', 'third_party']
  if (!allowedRoles.includes(user.role)) redirect(302, '/fila')

  // Todas as visitas (passadas e futuras), ordenadas por data e unidade
  const rawSchedules = await db
    .select({
      id: thirdPartySchedules.id,
      scheduledDate: thirdPartySchedules.scheduledDate,
      startTime: thirdPartySchedules.startTime,
      endTime: thirdPartySchedules.endTime,
      unitId: thirdPartySchedules.healthUnitId,
      unitName: estabelecimentos.estabelecimento,
    })
    .from(thirdPartySchedules)
    .innerJoin(estabelecimentos, eq(thirdPartySchedules.healthUnitId, estabelecimentos.id))
    .orderBy(asc(thirdPartySchedules.scheduledDate), asc(estabelecimentos.estabelecimento))

  // Coordenador e atendente veem quais pacientes estão em cada visita
  const canSeePatients = user.role === 'coordinator' || user.role === 'attendant'
  // Coordenador e atendente podem gerenciar slots; coordenador pode editar a visita
  const canManageSlots = user.role === 'coordinator' || user.role === 'attendant'
  const canEditSchedule = user.role === 'coordinator'

  // Carrega os agendamentos dos pacientes agrupados por data+unidade
  type ApptSlot = {
    id: number
    referralId: number
    scheduledTime: string
    patientName: string
    appointmentNumber: number
    outcome: string | null
  }
  const apptsByKey: Record<string, ApptSlot[]> = {}

  if (canSeePatients && rawSchedules.length > 0) {
    const dates = [...new Set(rawSchedules.map((s) => s.scheduledDate))]
    const apptRows = await db
      .select({
        id: appointments.id,
        referralId: appointments.referralId,
        scheduledDate: appointments.scheduledDate,
        healthUnitId: appointments.healthUnitId,
        scheduledTime: appointments.scheduledTime,
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
      apptsByKey[key].push({
        id: row.id,
        referralId: row.referralId,
        scheduledTime: row.scheduledTime,
        patientName: row.patientName,
        appointmentNumber: row.appointmentNumber,
        outcome: row.outcome,
      })
    }
  }

  // Encaminhamentos elegíveis para agendamento — usados no painel de gestão de slots
  // Elegíveis: status 'active', sem soft delete, agrupados por unidade
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

    // Conta consultas existentes por encaminhamento para determinar o próximo número
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

  const schedules = rawSchedules.map((s) => {
    const slots = apptsByKey[`${s.scheduledDate}__${s.unitId}`] ?? []
    // Filtra elegíveis para essa visita: mesma unidade E não já agendados nessa data+unidade
    const bookedReferralIds = new Set(slots.map((sl) => sl.referralId))
    const eligible = (eligibleByUnit[s.unitId] ?? []).filter(
      (r) => !bookedReferralIds.has(r.referralId)
    )
    return { ...s, slots, eligible }
  })

  // Unidades ativas — apenas para o formulário do coordenador
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

  // Edita data e horários de uma visita do protético — apenas coordenador
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

  // Adiciona um paciente à visita diretamente pela tela de agenda — coordenador ou atendente
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

    // Valida se a agenda existe e o horário está dentro da janela
    const schedule = await db.query.thirdPartySchedules.findFirst({
      where: eq(thirdPartySchedules.id, scheduleId),
    })
    if (!schedule) return fail(404, { slotError: 'Visita não encontrada' })

    if (scheduledTime < schedule.startTime || scheduledTime > schedule.endTime) {
      return fail(422, {
        slotError: `Horário fora da janela da visita (${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)})`,
      })
    }

    // Valida se o encaminhamento existe e está ativo
    const referral = await db.query.referrals.findFirst({
      where: (r, { and: andOp, eq: eqOp }) => andOp(eqOp(r.id, referralId), isNull(r.deletedAt)),
    })
    if (!referral) return fail(404, { slotError: 'Encaminhamento não encontrado' })
    if (referral.status !== 'active') {
      return fail(422, { slotError: 'Encaminhamento não está ativo' })
    }

    // Impede duplicidade: mesmo encaminhamento já agendado nessa data+unidade
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

    // Determina o próximo número da consulta
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

  // Altera o horário de um agendamento existente — apenas se sem desfecho
  edit_appointment: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { slotError: 'Não autenticado' })

    const allowed = ['coordinator', 'attendant']
    if (!allowed.includes(user.role)) return fail(403, { slotError: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    const scheduledTime = (data.get('scheduledTime') as string)?.trim()

    if (!id || !scheduledTime) return fail(400, { slotError: 'Dados inválidos' })

    const appt = await db.query.appointments.findFirst({
      where: (a, { eq: eqOp }) => eqOp(a.id, id),
    })
    if (!appt) return fail(404, { slotError: 'Agendamento não encontrado' })
    if (appt.outcome) {
      return fail(400, { slotError: 'Não é possível alterar uma consulta com desfecho registrado' })
    }

    // Valida se o novo horário está dentro da janela da visita correspondente
    const schedule = await db.query.thirdPartySchedules.findFirst({
      where: (s, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(s.scheduledDate, appt.scheduledDate),
          eqOp(s.healthUnitId, appt.healthUnitId)
        ),
    })
    if (schedule && (scheduledTime < schedule.startTime || scheduledTime > schedule.endTime)) {
      return fail(422, {
        slotError: `Horário fora da janela da visita (${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)})`,
      })
    }

    await db
      .update(appointments)
      .set({ scheduledTime, updatedAt: new Date() })
      .where(eq(appointments.id, id))

    return { slotEdited: true }
  },

  // Remove agendamento de um paciente — apenas se ainda não tem desfecho registrado
  remove_appointment: async ({ locals, request }) => {
    const user = locals.user
    if (!user) return fail(401, { error: 'Não autenticado' })

    const allowedRoles = ['coordinator', 'attendant']
    if (!allowedRoles.includes(user.role)) return fail(403, { error: 'Sem permissão' })

    const data = await request.formData()
    const id = parseInt(data.get('id') as string, 10)
    if (!id) return fail(400, { error: 'ID inválido' })

    const appt = await db.query.appointments.findFirst({
      where: (a, { eq: eqFn }) => eqFn(a.id, id),
    })

    if (!appt) return fail(404, { error: 'Agendamento não encontrado' })
    if (appt.outcome) return fail(400, { error: 'Não é possível desmarcar uma consulta com desfecho já registrado' })

    await db.delete(appointments).where(eq(appointments.id, id))
    return { removeSuccess: true }
  },
}
