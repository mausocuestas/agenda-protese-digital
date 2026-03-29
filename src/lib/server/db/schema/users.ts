import { pgSchema, integer, varchar, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core'
import { estabelecimentos } from './shared'

const proteseSchema = pgSchema('protese')

// Perfis de acesso do sistema
export const userRoleEnum = proteseSchema.enum('user_role', [
  'dentist',      // dentista da unidade — insere encaminhamentos
  'attendant',    // atendente — contata pacientes e agenda consultas
  'coordinator',  // coordenador — acesso total e configurações
  'third_party',  // profissional terceirizado — registra consultas e OS
])

export const users = proteseSchema.table(
  'users',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    role: userRoleEnum('role').notNull(),
    // Unidade padrão sugerida ao dentista no momento do encaminhamento (confirmável antes de salvar)
    defaultUnitId: integer('default_unit_id').references(() => estabelecimentos.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roleIdx: index('users_role_idx').on(table.role),
    defaultUnitIdx: index('users_default_unit_idx').on(table.defaultUnitId),
  })
)

// Relação M:N — dentistas que atuam em mais de uma unidade
export const userUnits = proteseSchema.table(
  'user_units',
  {
    id: integer('id').generatedByDefaultAsIdentity().primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    unitId: integer('unit_id')
      .notNull()
      .references(() => estabelecimentos.id),
  },
  (table) => ({
    userIdx: index('user_units_user_idx').on(table.userId),
    unitIdx: index('user_units_unit_idx').on(table.unitId),
    uniqueUserUnit: unique('user_units_unique').on(table.userId, table.unitId),
  })
)
