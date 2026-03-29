import { pgSchema, integer, varchar, boolean } from 'drizzle-orm/pg-core'

// Referência parcial à tabela compartilhada — apenas colunas consumidas pelo schema protese.
// NÃO alterar esta tabela por aqui; mudanças estruturais vão para o projeto dono do schema shared.
const sharedSchema = pgSchema('shared')

export const estabelecimentos = sharedSchema.table('estabelecimentos', {
  id: integer('id').primaryKey(),
  estabelecimento: varchar('estabelecimento', { length: 255 }).notNull(),
  nomeOficial: varchar('nome_oficial', { length: 255 }).notNull(),
  tipoEstabelecimento: varchar('tipo_estabelecimento', { length: 50 }).notNull(),
  cnes: integer('cnes'),
  isActive: boolean('is_active').default(true),
})
