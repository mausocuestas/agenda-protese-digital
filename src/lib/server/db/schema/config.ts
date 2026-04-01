import {
  pgSchema,
  integer,
  smallint,
  varchar,
  text,
  date,
  time,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { estabelecimentos } from './shared'
import { users } from './users'

const proteseSchema = pgSchema('protese')

// Parâmetros configuráveis pelo coordenador
// Chaves conhecidas (exemplos):
//   reassessment_months       → "6"
//   default_interval_days     → "14"
//   removable_first_interval  → "21"
//   monthly_goal              → "20"
//   contact_max_attempts      → "5"
//   contact_flag_attempts     → "3"
//   whatsapp_deadline_hours   → "24"
//   elderly_age_threshold     → "60"
export const systemConfigs = proteseSchema.table(
  'system_configs',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    key: varchar('key', { length: 100 }).notNull().unique(),
    value: text('value').notNull(),
    updatedBy: integer('updated_by')
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    updatedByIdx: index('system_configs_updated_by_idx').on(table.updatedBy),
  })
)

// Agenda semanal do terceirizado — coordenador configura por data e unidade
// O sistema filtra pacientes visíveis para agendamento com base nessa tabela
// Modelado por data (não por semana) para simplificar queries de visibilidade
export const thirdPartySchedules = proteseSchema.table(
  'third_party_schedules',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    healthUnitId: integer('health_unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
    scheduledDate: date('scheduled_date', { mode: 'string' }).notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    // Horário de almoço configurável — null significa sem bloqueio de almoço
    lunchStart: time('lunch_start'),
    lunchEnd: time('lunch_end'),
    // Duração padrão dos slots: 30 ou 60 minutos
    defaultDuration: smallint('default_duration').notNull().default(60),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    healthUnitIdx: index('third_party_schedules_unit_idx').on(table.healthUnitId),
    scheduledDateIdx: index('third_party_schedules_date_idx').on(table.scheduledDate),
    createdByIdx: index('third_party_schedules_created_by_idx').on(table.createdBy),
    // Impede que a mesma unidade apareça duas vezes na mesma data
    uniqueUnitDate: unique('third_party_schedules_unit_date_unique').on(
      table.healthUnitId,
      table.scheduledDate
    ),
  })
)
