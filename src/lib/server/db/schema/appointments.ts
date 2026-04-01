import {
  pgSchema,
  integer,
  smallint,
  text,
  date,
  time,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { estabelecimentos } from './shared'
import { users } from './users'
import { referrals } from './referrals'

const proteseSchema = pgSchema('protese')

// Resultado registrado pelo terceirizado no dia da consulta
export const appointmentOutcomeEnum = proteseSchema.enum('appointment_outcome', [
  'attended', // compareceu
  'absent',   // faltou sem avisar — volta ao topo da fila
  'refused',  // recusado pelo terceirizado — motivo obrigatório
])

// Canal de contato usado na tentativa de agendamento
export const contactChannelEnum = proteseSchema.enum('contact_channel', [
  'phone',
  'whatsapp',
  'in_person',
])

// Resultado da tentativa de contato com o paciente
export const contactResultEnum = proteseSchema.enum('contact_result', [
  'confirmed',  // paciente confirmou presença
  'no_answer',  // sem resposta
  'cancelled',  // paciente desmarcou com aviso — sem penalidade
])

export const appointments = proteseSchema.table(
  'appointments',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .references(() => referrals.id),
    // 1 = escaneamento | 2 = 1º ajuste | 3 = 2º ajuste | 4 = entrega definitiva | 5+ = exceção
    appointmentNumber: smallint('appointment_number').notNull(),
    healthUnitId: integer('health_unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
    scheduledDate: date('scheduled_date', { mode: 'string' }).notNull(),
    scheduledTime: time('scheduled_time').notNull(),

    // Preenchido pelo terceirizado no dia da consulta
    outcome: appointmentOutcomeEnum('outcome'),
    // Obrigatório quando outcome = 'refused'
    refusedReason: text('refused_reason'),
    attendedAt: timestamp('attended_at', { withTimezone: true }),
    // Duração ocupada por este agendamento no grid de slots: 30 | 60 minutos
    scheduledDuration: smallint('scheduled_duration'),
    // Estimativa de tempo de confecção da próxima peça: 30 | 60 minutos
    nextDurationEstimate: smallint('next_duration_estimate'),

    // Custódia da prótese — só relevante para consultas 2, 3 e 4
    // Passo 1: terceirizado marca "consulta pronta" após confecção da peça
    prosthesisReadyAt: timestamp('prosthesis_ready_at', { withTimezone: true }),
    prosthesisReadyBy: integer('prosthesis_ready_by').references(() => users.id),
    // Passo 2: atendente ou coordenador confirma recebimento físico na unidade
    // Apenas após confirmação o agendamento do paciente é liberado
    prosthesisReceivedAt: timestamp('prosthesis_received_at', { withTimezone: true }),
    prosthesisReceivedBy: integer('prosthesis_received_by').references(() => users.id),

    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    referralIdx: index('appointments_referral_idx').on(table.referralId),
    healthUnitIdx: index('appointments_health_unit_idx').on(table.healthUnitId),
    scheduledDateIdx: index('appointments_scheduled_date_idx').on(table.scheduledDate),
    // Índice composto — lista do dia por unidade (tela principal do terceirizado)
    unitDateIdx: index('appointments_unit_date_idx').on(table.healthUnitId, table.scheduledDate),
    outcomeIdx: index('appointments_outcome_idx').on(table.outcome),
    createdByIdx: index('appointments_created_by_idx').on(table.createdBy),
    prosthesisReadyByIdx: index('appointments_prosthesis_ready_by_idx').on(table.prosthesisReadyBy),
    prosthesisReceivedByIdx: index('appointments_prosthesis_received_by_idx').on(
      table.prosthesisReceivedBy
    ),
  })
)

// Registro de cada tentativa de contato — histórico completo para auditoria de ouvidoria
export const contactAttempts = proteseSchema.table(
  'contact_attempts',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    referralId: integer('referral_id')
      .notNull()
      .references(() => referrals.id),
    // Quando a tentativa visa agendar uma consulta específica (nullable para contatos gerais)
    appointmentId: integer('appointment_id').references(() => appointments.id),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull(),
    channel: contactChannelEnum('channel').notNull(),
    result: contactResultEnum('result').notNull(),
    // Prazo de aguardo de resposta para contatos via WhatsApp (padrão: 24h)
    whatsappDeadline: timestamp('whatsapp_deadline', { withTimezone: true }),
    // Com quem falou, restrições de horário, outras informações relevantes
    notes: text('notes'),
    contactedBy: integer('contacted_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    referralIdx: index('contact_attempts_referral_idx').on(table.referralId),
    appointmentIdx: index('contact_attempts_appointment_idx').on(table.appointmentId),
    contactedByIdx: index('contact_attempts_contacted_by_idx').on(table.contactedBy),
    // Índice composto — contagem de tentativas por encaminhamento e flag de 3ª/5ª tentativa
    referralAttemptedIdx: index('contact_attempts_referral_attempted_idx').on(
      table.referralId,
      table.attemptedAt
    ),
  })
)
