// Ponto único de entrada para o schema do banco de dados
// Importar daqui em vez de dos arquivos individuais

export { estabelecimentos } from './schema/shared'

export { userRoleEnum, users, userUnits } from './schema/users'

export {
  referralStatusEnum,
  inactivationReasonEnum,
  prosthesisTypes,
  patients,
  referrals,
  referralProsthesisTypes,
  referralNotes,
  unitResponsibilities,
} from './schema/referrals'

export {
  appointmentOutcomeEnum,
  contactChannelEnum,
  contactResultEnum,
  appointments,
  contactAttempts,
} from './schema/appointments'

export {
  finalVerdictEnum,
  satisfactionResultEnum,
  conformityAssessments,
  coordinationApprovals,
  satisfactionCalls,
} from './schema/quality'

export { systemConfigs, thirdPartySchedules } from './schema/config'
