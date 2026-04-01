import type { PageServerLoad, Actions } from './$types'
import { redirect, error, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { appointments, thirdPartySchedules, referrals, patients } from '$lib/server/db/index'
import { eq, isNull, inArray, asc, and } from 'drizzle-orm'
import { generateSlots, validateSlot } from '$lib/slots'

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')

  // Apenas atendentes e coordenadores podem agendar
  if (user.role !== 'attendant' && user.role !== 'coordinator') {
    error(403, 'Sem permissão para agendar consultas')
  }

  const referralId = parseInt(params.id, 10)
  if (isNaN(referralId)) error(400, 'ID inválido')

  const referral = await db.query.referrals.findFirst({
    where: (r, { and, eq: eqOp }) =>
      and(eqOp(r.id, referralId), isNull(r.deletedAt)),
    with: {
      patient: true,
      healthUnit: true,
      appointments: {
        orderBy: (a, { asc }) => [asc(a.appointmentNumber)],
      },
    },
  })

  if (!referral) error(404, 'Encaminhamento não encontrado')

  if (referral.status !== 'active') {
    error(422, 'Encaminhamento não está ativo — agendamento bloqueado')
  }

  // Controle de acesso por unidade (coordenador vê tudo)
  if (user.role !== 'coordinator' && referral.healthUnitId !== user.defaultUnitId) {
    error(403, 'Acesso negado')
  }

  // Próximo número de consulta
  const nextAppointmentNumber = referral.appointments.length + 1

  // Estimativa de duração informada pelo terceirizado na última consulta com comparecimento
  const lastAttended = referral.appointments
    .filter((a) => a.outcome === 'attended')
    .at(-1)
  const prevDurationEstimate = lastAttended?.nextDurationEstimate ?? null

  // Todas as agendas do terceirizado (passadas e futuras) — necessário para lançamentos retroativos
  const schedulesRaw = await db.query.thirdPartySchedules.findMany({
    with: { healthUnit: true },
    orderBy: (s, { asc }) => [asc(s.scheduledDate)],
  })

  // Carrega consultas já agendadas em cada data com duração ocupada
  type BookedAppt = {
    scheduledDate: string
    healthUnitId: number
    scheduledTime: string
    scheduledDuration: number | null
    appointmentNumber: number
    patientName: string
  }

  let booked: BookedAppt[] = []

  if (schedulesRaw.length > 0) {
    const dates = [...new Set(schedulesRaw.map((s) => s.scheduledDate))]
    booked = await db
      .select({
        scheduledDate: appointments.scheduledDate,
        healthUnitId: appointments.healthUnitId,
        scheduledTime: appointments.scheduledTime,
        scheduledDuration: appointments.scheduledDuration,
        appointmentNumber: appointments.appointmentNumber,
        patientName: patients.fullName,
      })
      .from(appointments)
      .innerJoin(referrals, eq(appointments.referralId, referrals.id))
      .innerJoin(patients, eq(referrals.patientId, patients.id))
      .where(inArray(appointments.scheduledDate, dates))
      .orderBy(asc(appointments.scheduledTime))
  }

  // Agrupa consultas por chave data__unidade
  const apptsByKey: Record<string, BookedAppt[]> = {}
  for (const row of booked) {
    const key = `${row.scheduledDate}__${row.healthUnitId}`
    if (!apptsByKey[key]) apptsByKey[key] = []
    apptsByKey[key].push(row)
  }

  // Gera os slots disponíveis para cada agenda
  const schedules = schedulesRaw.map((s) => {
    const existingAppts = apptsByKey[`${s.scheduledDate}__${s.healthUnitId}`] ?? []
    const slots = generateSlots({
      startTime: s.startTime,
      endTime: s.endTime,
      lunchStart: s.lunchStart,
      lunchEnd: s.lunchEnd,
      defaultDuration: s.defaultDuration,
      existingAppointments: existingAppts.map((a) => ({
        scheduledTime: a.scheduledTime,
        scheduledDuration: a.scheduledDuration,
        patientName: a.patientName,
        appointmentNumber: a.appointmentNumber,
      })),
    })

    return {
      id: s.id,
      scheduledDate: s.scheduledDate,
      startTime: s.startTime,
      endTime: s.endTime,
      lunchStart: s.lunchStart,
      lunchEnd: s.lunchEnd,
      defaultDuration: s.defaultDuration,
      unitId: s.healthUnitId,
      unitName: s.healthUnit.estabelecimento,
      slots,
    }
  })

  return {
    referralId,
    patientName: referral.patient.fullName,
    unitName: referral.healthUnit.estabelecimento,
    nextAppointmentNumber,
    prevDurationEstimate,
    schedules,
  }
}

export const actions: Actions = {
  default: async ({ request, locals, params }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (user.role !== 'attendant' && user.role !== 'coordinator') {
      return fail(403, { message: 'Sem permissão' })
    }

    const referralId = parseInt(params.id, 10)
    if (isNaN(referralId)) return fail(400, { message: 'ID inválido' })

    const formData = await request.formData()
    const scheduleId = parseInt(formData.get('scheduleId') as string, 10)
    const scheduledTime = (formData.get('scheduledTime') as string)?.trim()
    const scheduledDuration = parseInt(formData.get('scheduledDuration') as string, 10)

    if (isNaN(scheduleId) || !scheduledTime || isNaN(scheduledDuration)) {
      return fail(422, { message: 'Selecione um slot de horário' })
    }

    // Carrega a agenda para validação
    const schedule = await db.query.thirdPartySchedules.findFirst({
      where: eq(thirdPartySchedules.id, scheduleId),
      with: { healthUnit: true },
    })

    if (!schedule) return fail(422, { message: 'Agenda não encontrada' })

    // Normaliza horário para HH:MM antes de comparar (banco retorna HH:MM:SS)
    const timeHHMM = scheduledTime.slice(0, 5)

    // Valida janela + almoço usando a função utilitária
    const validationError = validateSlot(
      timeHHMM,
      scheduledDuration,
      schedule.startTime,
      schedule.endTime,
      schedule.lunchStart,
      schedule.lunchEnd,
    )
    if (validationError) return fail(422, { message: validationError })

    // Verifica conflito de horário na mesma data/unidade
    const conflict = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.scheduledDate, schedule.scheduledDate),
          eq(appointments.healthUnitId, schedule.healthUnitId),
          eq(appointments.scheduledTime, scheduledTime),
        )
      )
      .limit(1)

    if (conflict.length > 0) {
      return fail(422, { message: 'Já existe uma consulta agendada para este horário' })
    }

    // Conta consultas existentes para determinar o número
    const existing = await db.query.appointments.findMany({
      where: eq(appointments.referralId, referralId),
    })
    const appointmentNumber = existing.length + 1

    await db.insert(appointments).values({
      referralId,
      appointmentNumber,
      healthUnitId: schedule.healthUnitId,
      scheduledDate: schedule.scheduledDate,
      scheduledTime,
      scheduledDuration,
      createdBy: user.appId,
    })

    redirect(302, `/fila/${referralId}`)
  },
}
