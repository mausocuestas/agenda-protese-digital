import type { PageServerLoad, Actions } from './$types'
import { redirect, error, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { appointments, thirdPartySchedules, referrals, patients } from '$lib/server/db/index'
import { eq, isNull, inArray, asc } from 'drizzle-orm'

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

  // Todas as agendas do terceirizado (passadas e futuras) — necessário para lançamentos retroativos
  const schedulesWithUnit = await db.query.thirdPartySchedules.findMany({
    with: { healthUnit: true },
    orderBy: (s, { asc }) => [asc(s.scheduledDate)],
  })

  // Carrega pacientes já agendados em cada data — evita conflito de horário
  type ApptSlot = { scheduledTime: string; patientName: string; appointmentNumber: number }
  const apptsByKey: Record<string, ApptSlot[]> = {}

  if (schedulesWithUnit.length > 0) {
    const dates = [...new Set(schedulesWithUnit.map((s) => s.scheduledDate))]
    const booked = await db
      .select({
        scheduledDate: appointments.scheduledDate,
        healthUnitId: appointments.healthUnitId,
        scheduledTime: appointments.scheduledTime,
        appointmentNumber: appointments.appointmentNumber,
        patientName: patients.fullName,
      })
      .from(appointments)
      .innerJoin(referrals, eq(appointments.referralId, referrals.id))
      .innerJoin(patients, eq(referrals.patientId, patients.id))
      .where(inArray(appointments.scheduledDate, dates))
      .orderBy(asc(appointments.scheduledTime))

    for (const row of booked) {
      const key = `${row.scheduledDate}__${row.healthUnitId}`
      if (!apptsByKey[key]) apptsByKey[key] = []
      apptsByKey[key].push({
        scheduledTime: row.scheduledTime,
        patientName: row.patientName,
        appointmentNumber: row.appointmentNumber,
      })
    }
  }

  return {
    referralId,
    patientName: referral.patient.fullName,
    unitName: referral.healthUnit.estabelecimento,
    nextAppointmentNumber,
    schedules: schedulesWithUnit.map((s) => ({
      id: s.id,
      scheduledDate: s.scheduledDate,
      startTime: s.startTime,
      endTime: s.endTime,
      unitId: s.healthUnitId,
      unitName: s.healthUnit.estabelecimento,
      slots: apptsByKey[`${s.scheduledDate}__${s.healthUnitId}`] ?? [],
    })),
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

    if (isNaN(scheduleId) || !scheduledTime) {
      return fail(422, { message: 'Preencha todos os campos obrigatórios' })
    }

    // Valida se o horário está dentro da janela da agenda
    const schedule = await db.query.thirdPartySchedules.findFirst({
      where: eq(thirdPartySchedules.id, scheduleId),
      with: { healthUnit: true },
    })

    if (!schedule) return fail(422, { message: 'Agenda não encontrada' })

    if (scheduledTime < schedule.startTime || scheduledTime > schedule.endTime) {
      return fail(422, {
        message: `Horário fora da janela do terceirizado (${schedule.startTime.slice(0, 5)}–${schedule.endTime.slice(0, 5)})`,
      })
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
      createdBy: user.appId,
    })

    redirect(302, `/fila/${referralId}`)
  },
}
