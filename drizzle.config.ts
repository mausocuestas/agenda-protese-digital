import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/server/db/schema/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Gerencia apenas o schema 'protese' — 'shared' é controlado por outro projeto no workspace
  schemaFilter: ['protese'],
  // Ignora tabelas do MVP antigo que ainda existem no banco (remoção manual pelo usuário)
  tablesFilter: [
    'users', 'user_units',
    'prosthesis_types', 'patients', 'referrals', 'referral_prosthesis_types',
    'referral_notes', 'unit_responsibilities',
    'appointments', 'contact_attempts',
    'conformity_assessments', 'coordination_approvals', 'satisfaction_calls',
    'system_configs', 'third_party_schedules',
  ],
  verbose: true,
  strict: true,
})
