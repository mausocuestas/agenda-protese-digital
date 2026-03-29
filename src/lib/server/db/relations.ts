// Relações Drizzle ORM — metadados TypeScript para o query builder (.query.xxx.findMany({ with: {} }))
// Não geram SQL; as FKs reais estão definidas nos arquivos de schema.

import { relations } from 'drizzle-orm'
import {
  estabelecimentos,
  users,
  userUnits,
  patients,
  prosthesisTypes,
  referrals,
  referralProsthesisTypes,
  referralNotes,
  appointments,
  contactAttempts,
  conformityAssessments,
  coordinationApprovals,
  satisfactionCalls,
  systemConfigs,
  thirdPartySchedules,
} from './index'

// ─── Usuários ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  defaultUnit: one(estabelecimentos, {
    fields: [users.defaultUnitId],
    references: [estabelecimentos.id],
  }),
  units: many(userUnits),
  createdReferrals: many(referrals, { relationName: 'referral_creator' }),
  referralNotes: many(referralNotes, { relationName: 'note_creator' }),
  createdAppointments: many(appointments, { relationName: 'appointment_creator' }),
  markedProsthesisReady: many(appointments, { relationName: 'prosthesis_ready_marker' }),
  confirmedProsthesisReceived: many(appointments, { relationName: 'prosthesis_receipt_confirmer' }),
  contactAttempts: many(contactAttempts),
  conformityAssessments: many(conformityAssessments),
  coordinationApprovals: many(coordinationApprovals),
  satisfactionCalls: many(satisfactionCalls),
  systemConfigUpdates: many(systemConfigs),
  thirdPartySchedules: many(thirdPartySchedules),
}))

export const userUnitsRelations = relations(userUnits, ({ one }) => ({
  user: one(users, {
    fields: [userUnits.userId],
    references: [users.id],
  }),
  unit: one(estabelecimentos, {
    fields: [userUnits.unitId],
    references: [estabelecimentos.id],
  }),
}))

// ─── Pacientes e Encaminhamentos ─────────────────────────────────────────────

export const patientsRelations = relations(patients, ({ one, many }) => ({
  healthUnit: one(estabelecimentos, {
    fields: [patients.healthUnitId],
    references: [estabelecimentos.id],
  }),
  referrals: many(referrals),
}))

export const prosthesisTypesRelations = relations(prosthesisTypes, ({ many }) => ({
  referralProsthesisTypes: many(referralProsthesisTypes),
}))

export const referralsRelations = relations(referrals, ({ one, many }) => ({
  patient: one(patients, {
    fields: [referrals.patientId],
    references: [patients.id],
  }),
  healthUnit: one(estabelecimentos, {
    fields: [referrals.healthUnitId],
    references: [estabelecimentos.id],
  }),
  creator: one(users, {
    fields: [referrals.createdBy],
    references: [users.id],
    relationName: 'referral_creator',
  }),
  // Encaminhamento de origem (quebra/perda)
  previousReferral: one(referrals, {
    fields: [referrals.previousReferralId],
    references: [referrals.id],
    relationName: 'referral_chain',
  }),
  // Encaminhamentos subsequentes originados deste (ex: novo processo após perda)
  subsequentReferrals: many(referrals, { relationName: 'referral_chain' }),
  prosthesisTypes: many(referralProsthesisTypes),
  notes: many(referralNotes),
  appointments: many(appointments),
  contactAttempts: many(contactAttempts),
  conformityAssessment: one(conformityAssessments, {
    fields: [referrals.id],
    references: [conformityAssessments.referralId],
  }),
  coordinationApproval: one(coordinationApprovals, {
    fields: [referrals.id],
    references: [coordinationApprovals.referralId],
  }),
  satisfactionCall: one(satisfactionCalls, {
    fields: [referrals.id],
    references: [satisfactionCalls.referralId],
  }),
}))

export const referralProsthesisTypesRelations = relations(referralProsthesisTypes, ({ one }) => ({
  referral: one(referrals, {
    fields: [referralProsthesisTypes.referralId],
    references: [referrals.id],
  }),
  prosthesisType: one(prosthesisTypes, {
    fields: [referralProsthesisTypes.prosthesisTypeId],
    references: [prosthesisTypes.id],
  }),
}))

export const referralNotesRelations = relations(referralNotes, ({ one }) => ({
  referral: one(referrals, {
    fields: [referralNotes.referralId],
    references: [referrals.id],
  }),
  creator: one(users, {
    fields: [referralNotes.createdBy],
    references: [users.id],
    relationName: 'note_creator',
  }),
}))

// ─── Consultas e Contatos ────────────────────────────────────────────────────

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  referral: one(referrals, {
    fields: [appointments.referralId],
    references: [referrals.id],
  }),
  healthUnit: one(estabelecimentos, {
    fields: [appointments.healthUnitId],
    references: [estabelecimentos.id],
  }),
  creator: one(users, {
    fields: [appointments.createdBy],
    references: [users.id],
    relationName: 'appointment_creator',
  }),
  prosthesisReadyMarker: one(users, {
    fields: [appointments.prosthesisReadyBy],
    references: [users.id],
    relationName: 'prosthesis_ready_marker',
  }),
  prosthesisReceiptConfirmer: one(users, {
    fields: [appointments.prosthesisReceivedBy],
    references: [users.id],
    relationName: 'prosthesis_receipt_confirmer',
  }),
  contactAttempts: many(contactAttempts),
  conformityAssessment: one(conformityAssessments, {
    fields: [appointments.id],
    references: [conformityAssessments.appointmentId],
  }),
}))

export const contactAttemptsRelations = relations(contactAttempts, ({ one }) => ({
  referral: one(referrals, {
    fields: [contactAttempts.referralId],
    references: [referrals.id],
  }),
  appointment: one(appointments, {
    fields: [contactAttempts.appointmentId],
    references: [appointments.id],
  }),
  contactedBy: one(users, {
    fields: [contactAttempts.contactedBy],
    references: [users.id],
  }),
}))

// ─── Qualidade e Encerramento ────────────────────────────────────────────────

export const conformityAssessmentsRelations = relations(conformityAssessments, ({ one }) => ({
  referral: one(referrals, {
    fields: [conformityAssessments.referralId],
    references: [referrals.id],
  }),
  appointment: one(appointments, {
    fields: [conformityAssessments.appointmentId],
    references: [appointments.id],
  }),
  assessedBy: one(users, {
    fields: [conformityAssessments.assessedBy],
    references: [users.id],
  }),
}))

export const coordinationApprovalsRelations = relations(coordinationApprovals, ({ one }) => ({
  referral: one(referrals, {
    fields: [coordinationApprovals.referralId],
    references: [referrals.id],
  }),
  approvedBy: one(users, {
    fields: [coordinationApprovals.approvedBy],
    references: [users.id],
  }),
}))

export const satisfactionCallsRelations = relations(satisfactionCalls, ({ one }) => ({
  referral: one(referrals, {
    fields: [satisfactionCalls.referralId],
    references: [referrals.id],
  }),
  calledBy: one(users, {
    fields: [satisfactionCalls.calledBy],
    references: [users.id],
  }),
}))

// ─── Configuração ────────────────────────────────────────────────────────────

export const systemConfigsRelations = relations(systemConfigs, ({ one }) => ({
  updatedBy: one(users, {
    fields: [systemConfigs.updatedBy],
    references: [users.id],
  }),
}))

export const thirdPartySchedulesRelations = relations(thirdPartySchedules, ({ one }) => ({
  healthUnit: one(estabelecimentos, {
    fields: [thirdPartySchedules.healthUnitId],
    references: [estabelecimentos.id],
  }),
  creator: one(users, {
    fields: [thirdPartySchedules.createdBy],
    references: [users.id],
  }),
}))
