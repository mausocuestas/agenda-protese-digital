import {
  pgSchema,
  integer,
  varchar,
  boolean,
  text,
  date,
  timestamp,
  index,
  unique,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/pg-core'
import { estabelecimentos } from './shared'
import { users } from './users'

const proteseSchema = pgSchema('protese')

// Status do encaminhamento ao longo do fluxo
export const referralStatusEnum = proteseSchema.enum('referral_status', [
  'active',               // aguardando agendamento ou em confecção
  'pending_reassessment', // fila há mais de 6 meses — bloqueado para agendamento até reavaliação
  'suspended',            // impedimento temporário (viagem, doença, tratamento paralelo)
  'inactive',             // encerrado definitivamente
])

// Motivo de inativação — obrigatório quando status = 'inactive'
export const inactivationReasonEnum = proteseSchema.enum('inactivation_reason', [
  'dropout',     // desistência
  'death',       // óbito
  'cancellation',// cancelamento administrativo
])

// Lookup dos 9 tipos de prótese — populado via seed
export const prosthesisTypes = proteseSchema.table('prosthesis_types', {
  id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
})

// Cadastro permanente do paciente — não muda entre encaminhamentos
export const patients = proteseSchema.table(
  'patients',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    cpf: varchar('cpf', { length: 11 }).notNull().unique(),
    birthDate: date('birth_date', { mode: 'string' }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    healthUnitId: integer('health_unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    healthUnitIdx: index('patients_health_unit_idx').on(table.healthUnitId),
    // Busca por nome no formulário de novo encaminhamento
    fullNameIdx: index('patients_full_name_idx').on(table.fullName),
  })
)

// Encaminhamento/caso — uma instância do processo por paciente
// Um paciente pode ter N encaminhamentos ao longo do tempo
export const referrals = proteseSchema.table(
  'referrals',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    patientId: integer('patient_id')
      .notNull()
      .references(() => patients.id),
    // Unidade no momento do encaminhamento (pode diferir da unidade atual do paciente)
    healthUnitId: integer('health_unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
    // Início do relógio de espera — preservado mesmo após reavaliação
    introductionDate: date('introduction_date', { mode: 'string' }).notNull(),
    status: referralStatusEnum('status').notNull().default('active'),
    // Preenchido somente quando status = 'inactive'
    inactivationReason: inactivationReasonEnum('inactivation_reason'),
    // Vínculo com encaminhamento anterior em caso de quebra ou perda da prótese
    previousReferralId: integer('previous_referral_id'),
    // Número da OS fornecido pela empresa terceirizada (letras + números)
    serviceOrderNumber: varchar('service_order_number', { length: 50 }),
    // Flags manuais de prioridade — idoso e atrasado são computados, não armazenados
    hasOmbudsmanFlag: boolean('has_ombudsman_flag').notNull().default(false),
    hasAccidentFlag: boolean('has_accident_flag').notNull().default(false),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    patientIdx: index('referrals_patient_idx').on(table.patientId),
    healthUnitIdx: index('referrals_health_unit_idx').on(table.healthUnitId),
    statusIdx: index('referrals_status_idx').on(table.status),
    introductionDateIdx: index('referrals_introduction_date_idx').on(table.introductionDate),
    createdByIdx: index('referrals_created_by_idx').on(table.createdBy),
    // Índice composto — query principal da fila de agendamento por unidade
    statusUnitIdx: index('referrals_status_unit_idx').on(table.status, table.healthUnitId),
    // FK auto-referencial para rastrear histórico de quebra/perda
    previousReferralFk: foreignKey({
      columns: [table.previousReferralId],
      foreignColumns: [table.id],
      name: 'referrals_previous_referral_fk',
    }),
  })
)

// N:N — um encaminhamento pode ter até ~2 tipos de prótese (estrutura suporta mais)
export const referralProsthesisTypes = proteseSchema.table(
  'referral_prosthesis_types',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .references(() => referrals.id, { onDelete: 'cascade' }),
    prosthesisTypeId: integer('prosthesis_type_id')
      .notNull()
      .references(() => prosthesisTypes.id),
  },
  (table) => ({
    referralIdx: index('rpt_referral_idx').on(table.referralId),
    prosthesisTypeIdx: index('rpt_prosthesis_type_idx').on(table.prosthesisTypeId),
    uniqueReferralType: unique('rpt_referral_type_unique').on(
      table.referralId,
      table.prosthesisTypeId
    ),
  })
)

// Histórico imutável de observações — dentistas, atendentes e coordenadores inserem notas
// O "porquê" de ser tabela e não campo text: rastreabilidade de quem escreveu o quê e quando
export const referralNotes = proteseSchema.table(
  'referral_notes',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .references(() => referrals.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    referralIdx: index('referral_notes_referral_idx').on(table.referralId),
    createdByIdx: index('referral_notes_created_by_idx').on(table.createdBy),
  })
)

// Mapeamento de responsabilidade entre unidades para controle de visibilidade da fila
// Centro-UBS (id 12) → 8 unidades designadas; Imperial-USF (id 17) → 8 unidades designadas
// Mantido em protese (não em shared) pois é específico do fluxo de próteses
export const unitResponsibilities = proteseSchema.table(
  'unit_responsibilities',
  {
    responsibleUnitId: integer('responsible_unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
    designatedUnitId: integer('designated_unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.responsibleUnitId, table.designatedUnitId] }),
    responsibleUnitIdx: index('unit_resp_responsible_idx').on(table.responsibleUnitId),
    designatedUnitIdx: index('unit_resp_designated_idx').on(table.designatedUnitId),
  })
)
