import {
  pgSchema,
  integer,
  boolean,
  text,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users'
import { referrals } from './referrals'
import { appointments } from './appointments'

const proteseSchema = pgSchema('protese')

// Parecer final do dentista na 4ª consulta
// Importante: conformidade e aprovação são independentes —
// o dentista pode registrar não-conformidade e ainda assim aprovar
export const finalVerdictEnum = proteseSchema.enum('final_verdict', [
  'approved', // prótese atende critérios técnicos e contratuais
  'refused',  // prótese retorna para ajuste ou repetição — justificativa obrigatória
])

// Resultado da ligação de satisfação (30–60 dias após instalação)
export const satisfactionResultEnum = proteseSchema.enum('satisfaction_result', [
  'great',        // ótimo, me adaptei bem — caso encerrado
  'reasonable',   // razoável, ainda me acostumando — monitoramento
  'difficulties', // com dificuldades / preciso de consulta na unidade
])

// Avaliação de conformidade realizada pelo dentista na 4ª consulta
// Um por encaminhamento (UNIQUE em referral_id e appointment_id)
export const conformityAssessments = proteseSchema.table(
  'conformity_assessments',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .unique()
      .references(() => referrals.id),
    appointmentId: integer('appointment_id')
      .notNull()
      .unique()
      .references(() => appointments.id),
    adaptationOk: boolean('adaptation_ok').notNull(),
    // Obrigatório quando adaptationOk = false
    adaptationNotes: text('adaptation_notes'),
    occlusionOk: boolean('occlusion_ok').notNull(),
    occlusionNotes: text('occlusion_notes'),
    materialOk: boolean('material_ok').notNull(),
    materialNotes: text('material_notes'),
    finalVerdict: finalVerdictEnum('final_verdict').notNull(),
    // Obrigatório quando finalVerdict = 'refused'
    refusalReason: text('refusal_reason'),
    // Coordenador decide se o terceirizado (representante da empresa) pode visualizar
    isVisibleToThirdParty: boolean('is_visible_to_third_party').notNull().default(false),
    assessedBy: integer('assessed_by')
      .notNull()
      .references(() => users.id),
    assessedAt: timestamp('assessed_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    assessedByIdx: index('conformity_assessments_assessed_by_idx').on(table.assessedBy),
    // Índice para métrica: não-conformidades por critério e recusas por fase
    finalVerdictIdx: index('conformity_assessments_verdict_idx').on(table.finalVerdict),
  })
)

// OK formal da coordenação + número da nota fiscal
// Pré-requisito para pagamento à empresa terceirizada
// Um por encaminhamento (UNIQUE em referral_id)
export const coordinationApprovals = proteseSchema.table(
  'coordination_approvals',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .unique()
      .references(() => referrals.id),
    // NF pode conter letras e números (ex: "NF-2024-001")
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    approvedBy: integer('approved_by')
      .notNull()
      .references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    approvedByIdx: index('coordination_approvals_approved_by_idx').on(table.approvedBy),
  })
)

// Registro da ligação de acompanhamento realizada entre 30 e 60 dias após a instalação
// O caso só é encerrado após este registro
// Um por encaminhamento (UNIQUE em referral_id)
export const satisfactionCalls = proteseSchema.table(
  'satisfaction_calls',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .unique()
      .references(() => referrals.id),
    calledAt: timestamp('called_at', { withTimezone: true }).notNull(),
    result: satisfactionResultEnum('result').notNull(),
    // Sinalização simples — marcação da consulta é feita em outro sistema (agenda da unidade)
    needsUnitAppointment: boolean('needs_unit_appointment').notNull().default(false),
    // Atendente remove quando a consulta na unidade for agendada
    isUnitAppointmentResolved: boolean('is_unit_appointment_resolved').notNull().default(false),
    notes: text('notes'),
    calledBy: integer('called_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    calledByIdx: index('satisfaction_calls_called_by_idx').on(table.calledBy),
    // Índice para badge "🏥 Consulta na Unidade" no dashboard do atendente e coordenador
    needsUnitAppointmentIdx: index('satisfaction_calls_needs_unit_idx').on(
      table.needsUnitAppointment
    ),
  })
)
