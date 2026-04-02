import type { PageServerLoad, Actions } from './$types'
import { redirect, fail } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import {
  patients,
  referrals,
  referralProsthesisTypes,
  prosthesisTypes,
  referralNotes,
  appointments,
  estabelecimentos,
} from '$lib/server/db/index'
import { eq, desc, isNull, and } from 'drizzle-orm'

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user
  if (!user) redirect(302, '/login')
  if (!['dentist', 'coordinator'].includes(user.role)) redirect(302, '/fila')

  const allTypes = await db
    .select({ id: prosthesisTypes.id, name: prosthesisTypes.name })
    .from(prosthesisTypes)
    .orderBy(prosthesisTypes.name)

  // Coordenador escolhe a unidade; dentista fica fixo na sua
  const allUnits =
    user.role === 'coordinator'
      ? await db
          .select({ id: estabelecimentos.id, name: estabelecimentos.estabelecimento })
          .from(estabelecimentos)
          .where(eq(estabelecimentos.isActive, true))
          .orderBy(estabelecimentos.estabelecimento)
      : []

  return { prosthesisTypes: allTypes, units: allUnits }
}

export const actions: Actions = {
  // Etapa 1: localiza paciente pelo CPF (sem criar nada)
  search_patient: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')

    const data = await request.formData()
    const cpf = (data.get('cpf') as string)?.replace(/\D/g, '')

    if (!cpf || cpf.length !== 11) {
      return fail(400, { searchError: 'CPF deve ter 11 dígitos.' })
    }

    const patient = await db.query.patients.findFirst({
      where: (p, { eq: eqOp }) => eqOp(p.cpf, cpf),
    })

    // Retorna o paciente (ou null) — o cliente decide o que exibir
    return { patient: patient ?? null, cpf }
  },

  // Etapa 2: cria o encaminhamento (e o paciente, se novo)
  create: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')
    if (!['dentist', 'coordinator'].includes(user.role)) {
      return fail(403, { createError: 'Sem permissão.' })
    }

    const data = await request.formData()

    // Paciente existente → patientId preenchido; novo → campos manuais
    const patientId = data.get('patientId') ? Number(data.get('patientId')) : null
    const cpf = (data.get('cpf') as string)?.replace(/\D/g, '')
    const fullName = (data.get('fullName') as string)?.trim()
    const birthDate = data.get('birthDate') as string
    const phone = (data.get('phone') as string)?.trim()

    const healthUnitId =
      user.role === 'coordinator'
        ? Number(data.get('healthUnitId'))
        : user.defaultUnitId

    if (!healthUnitId) {
      return fail(400, { createError: 'Unidade de saúde não definida para este usuário.' })
    }

    const introductionDate = data.get('introductionDate') as string
    const selectedTypes = data.getAll('prosthesisTypeIds').map(Number).filter(Boolean)
    const hasOmbudsmanFlag = data.get('hasOmbudsmanFlag') === 'on'
    const hasAccidentFlag = data.get('hasAccidentFlag') === 'on'
    const note = (data.get('note') as string)?.trim() || null

    if (!introductionDate) {
      return fail(400, { createError: 'Data de introdução obrigatória.' })
    }
    if (selectedTypes.length === 0) {
      return fail(400, { createError: 'Selecione ao menos um tipo de prótese.' })
    }
    if (selectedTypes.length > 2) {
      return fail(400, { createError: 'Selecione no máximo 2 tipos de prótese.' })
    }

    let finalPatientId = patientId

    if (!finalPatientId) {
      // Novo paciente: valida campos e verifica duplicata de CPF
      if (!cpf || cpf.length !== 11 || !fullName || !birthDate || !phone) {
        return fail(400, { createError: 'Preencha todos os dados do paciente.' })
      }

      const existing = await db.query.patients.findFirst({
        where: (p, { eq: eqOp }) => eqOp(p.cpf, cpf),
        columns: { id: true },
      })
      if (existing) {
        return fail(409, {
          createError: 'Já existe um paciente com esse CPF. Volte e busque novamente.',
        })
      }

      const inserted = await db
        .insert(patients)
        .values({ cpf, fullName, birthDate, phone, healthUnitId })
        .returning({ id: patients.id })
      finalPatientId = inserted[0]!.id
    }

    const insertedReferral = await db
      .insert(referrals)
      .values({
        patientId: finalPatientId,
        healthUnitId,
        introductionDate,
        status: 'active',
        hasOmbudsmanFlag,
        hasAccidentFlag,
        createdBy: user.id,
      })
      .returning({ id: referrals.id })

    const referralId = insertedReferral[0]!.id

    await db.insert(referralProsthesisTypes).values(
      selectedTypes.map((typeId) => ({ referralId, prosthesisTypeId: typeId }))
    )

    if (note) {
      await db.insert(referralNotes).values({
        referralId,
        body: note,
        createdBy: user.id,
      })
    }

    redirect(302, `/fila/${referralId}`)
  },

  // Carrega histórico de encaminhamentos de um paciente (para o modal sem sair da tela)
  patient_history: async ({ request, locals }) => {
    const user = locals.user
    if (!user) redirect(302, '/login')

    const data = await request.formData()
    const patientId = Number(data.get('patientId'))
    if (!patientId) return fail(400, { historyError: 'ID inválido.' })

    const patientReferrals = await db
      .select({
        id: referrals.id,
        introductionDate: referrals.introductionDate,
        status: referrals.status,
        inactivationReason: referrals.inactivationReason,
        hasOmbudsmanFlag: referrals.hasOmbudsmanFlag,
        hasAccidentFlag: referrals.hasAccidentFlag,
      })
      .from(referrals)
      .where(and(eq(referrals.patientId, patientId), isNull(referrals.deletedAt)))
      .orderBy(desc(referrals.introductionDate))

    const history = await Promise.all(
      patientReferrals.map(async (ref) => {
        const types = await db
          .select({ name: prosthesisTypes.name })
          .from(referralProsthesisTypes)
          .innerJoin(
            prosthesisTypes,
            eq(referralProsthesisTypes.prosthesisTypeId, prosthesisTypes.id)
          )
          .where(eq(referralProsthesisTypes.referralId, ref.id))

        const appts = await db
          .select({
            appointmentNumber: appointments.appointmentNumber,
            scheduledDate: appointments.scheduledDate,
            outcome: appointments.outcome,
          })
          .from(appointments)
          .where(eq(appointments.referralId, ref.id))
          .orderBy(appointments.appointmentNumber)

        return { ...ref, types, appointments: appts }
      })
    )

    return { history }
  },
}
