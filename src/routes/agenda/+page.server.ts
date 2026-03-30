import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { thirdPartySchedules, estabelecimentos, appointments, referrals, patients } from '$lib/server/db/index'
import { eq, asc, inArray } from 'drizzle-orm'

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

  // Carrega os agendamentos dos pacientes agrupados por data+unidade
  type ApptSlot = { scheduledTime: string; patientName: string; appointmentNumber: number; outcome: string | null }
  const apptsByKey: Record<string, ApptSlot[]> = {}

  if (canSeePatients && rawSchedules.length > 0) {
    const dates = [...new Set(rawSchedules.map((s) => s.scheduledDate))]
    const apptRows = await db
      .select({
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
        scheduledTime: row.scheduledTime,
        patientName: row.patientName,
        appointmentNumber: row.appointmentNumber,
        outcome: row.outcome,
      })
    }
  }

  const schedules = rawSchedules.map((s) => ({
    ...s,
    slots: apptsByKey[`${s.scheduledDate}__${s.unitId}`] ?? [],
  }))

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
      // Violação de unique (mesma unidade, mesma data)
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
}
