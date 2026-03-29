-- Seed de dados para teste do ciclo completo
-- Aplique via: mcp__Neon__run_sql_transaction (cada bloco é um statement separado)
-- Pré-requisito: users, patients, referrals, prosthesis_types já populados

-- ============================================================
-- MAPA DO CICLO
-- referral 1,2   → Fila (sem consultas)
-- referral 4     → Custódia → awaitingReady    (terceirizado/coord)
-- referral 5     → Custódia → awaitingReceival (atendente/coord)
-- referral 3     → Qualidade → awaitingConformity (dentista unit17/coord)
-- referral 6     → Qualidade → awaitingApproval   (coord)
-- referral 8     → Qualidade → awaitingSatisfaction (atendente/coord)
-- referral 10    → Qualidade → pendingUnitAppointments (atendente/coord)
-- ============================================================

-- Referral 3 (unit 17, Antônio) → 4 consultas → awaitingConformity
INSERT INTO protese.appointments
  (referral_id, appointment_number, health_unit_id, scheduled_date, scheduled_time,
   outcome, attended_at,
   prosthesis_ready_at, prosthesis_ready_by, prosthesis_received_at, prosthesis_received_by,
   created_by, created_at, updated_at)
VALUES
  (3, 1, 17, '2025-06-10', '08:00', 'attended', '2025-06-10 08:30:00+00', NULL, NULL, NULL, NULL, 4, NOW(), NOW()),
  (3, 2, 17, '2025-07-10', '08:00', 'attended', '2025-07-10 08:30:00+00', '2025-07-20 10:00:00+00', 5, '2025-07-25 14:00:00+00', 4, 4, NOW(), NOW()),
  (3, 3, 17, '2025-08-10', '08:00', 'attended', '2025-08-10 08:30:00+00', '2025-08-20 10:00:00+00', 5, '2025-08-25 14:00:00+00', 4, 4, NOW(), NOW()),
  (3, 4, 17, '2025-09-10', '08:00', 'attended', '2025-09-10 08:30:00+00', '2025-09-20 10:00:00+00', 5, '2025-09-25 14:00:00+00', 4, 4, NOW(), NOW());

-- Referral 4 (unit 12, Benedita) → 2ª consulta attended, sem prosthesisReadyAt → awaitingReady
INSERT INTO protese.appointments
  (referral_id, appointment_number, health_unit_id, scheduled_date, scheduled_time,
   outcome, attended_at, created_by, created_at, updated_at)
VALUES
  (4, 1, 12, '2025-08-01', '09:00', 'attended', '2025-08-01 09:30:00+00', 4, NOW(), NOW()),
  (4, 2, 12, '2025-09-05', '09:00', 'attended', '2025-09-05 09:30:00+00', 4, NOW(), NOW());

-- Referral 5 (unit 16, Luiz) → prosthesisReadyAt set, sem prosthesisReceivedAt → awaitingReceival
INSERT INTO protese.appointments
  (referral_id, appointment_number, health_unit_id, scheduled_date, scheduled_time,
   outcome, attended_at, prosthesis_ready_at, prosthesis_ready_by, created_by, created_at, updated_at)
VALUES
  (5, 1, 16, '2025-07-15', '10:00', 'attended', '2025-07-15 10:30:00+00', NULL, NULL, 4, NOW(), NOW()),
  (5, 2, 16, '2025-08-20', '10:00', 'attended', '2025-08-20 10:30:00+00', '2025-09-01 11:00:00+00', 5, 4, NOW(), NOW());

-- Referral 6 (unit 5, Rosa) → 4 consultas + conformityAssessment → awaitingApproval
INSERT INTO protese.appointments
  (referral_id, appointment_number, health_unit_id, scheduled_date, scheduled_time,
   outcome, attended_at,
   prosthesis_ready_at, prosthesis_ready_by, prosthesis_received_at, prosthesis_received_by,
   created_by, created_at, updated_at)
VALUES
  (6, 1, 5, '2025-05-10', '08:00', 'attended', '2025-05-10 08:30:00+00', NULL, NULL, NULL, NULL, 4, NOW(), NOW()),
  (6, 2, 5, '2025-06-10', '08:00', 'attended', '2025-06-10 08:30:00+00', '2025-06-20 10:00:00+00', 5, '2025-06-25 14:00:00+00', 4, 4, NOW(), NOW()),
  (6, 3, 5, '2025-07-15', '08:00', 'attended', '2025-07-15 08:30:00+00', '2025-07-25 10:00:00+00', 5, '2025-07-30 14:00:00+00', 4, 4, NOW(), NOW()),
  (6, 4, 5, '2025-08-20', '08:00', 'attended', '2025-08-20 08:30:00+00', '2025-08-30 10:00:00+00', 5, '2025-09-04 14:00:00+00', 4, 4, NOW(), NOW());

-- Referral 8 (unit 18, Tereza) → 4 consultas + conformity + approval → awaitingSatisfaction
INSERT INTO protese.appointments
  (referral_id, appointment_number, health_unit_id, scheduled_date, scheduled_time,
   outcome, attended_at,
   prosthesis_ready_at, prosthesis_ready_by, prosthesis_received_at, prosthesis_received_by,
   created_by, created_at, updated_at)
VALUES
  (8, 1, 18, '2025-04-05', '08:00', 'attended', '2025-04-05 08:30:00+00', NULL, NULL, NULL, NULL, 4, NOW(), NOW()),
  (8, 2, 18, '2025-05-10', '08:00', 'attended', '2025-05-10 08:30:00+00', '2025-05-20 10:00:00+00', 5, '2025-05-25 14:00:00+00', 4, 4, NOW(), NOW()),
  (8, 3, 18, '2025-06-15', '08:00', 'attended', '2025-06-15 08:30:00+00', '2025-06-25 10:00:00+00', 5, '2025-06-30 14:00:00+00', 4, 4, NOW(), NOW()),
  (8, 4, 18, '2025-07-20', '08:00', 'attended', '2025-07-20 08:30:00+00', '2025-07-30 10:00:00+00', 5, '2025-08-04 14:00:00+00', 4, 4, NOW(), NOW());

-- Referral 10 (unit 25, Conceição) → ciclo completo + satisfactionCall → pendingUnitAppointments
INSERT INTO protese.appointments
  (referral_id, appointment_number, health_unit_id, scheduled_date, scheduled_time,
   outcome, attended_at,
   prosthesis_ready_at, prosthesis_ready_by, prosthesis_received_at, prosthesis_received_by,
   created_by, created_at, updated_at)
VALUES
  (10, 1, 25, '2025-03-01', '08:00', 'attended', '2025-03-01 08:30:00+00', NULL, NULL, NULL, NULL, 4, NOW(), NOW()),
  (10, 2, 25, '2025-04-05', '08:00', 'attended', '2025-04-05 08:30:00+00', '2025-04-15 10:00:00+00', 5, '2025-04-20 14:00:00+00', 4, 4, NOW(), NOW()),
  (10, 3, 25, '2025-05-10', '08:00', 'attended', '2025-05-10 08:30:00+00', '2025-05-20 10:00:00+00', 5, '2025-05-25 14:00:00+00', 4, 4, NOW(), NOW()),
  (10, 4, 25, '2025-06-15', '08:00', 'attended', '2025-06-15 08:30:00+00', '2025-06-25 10:00:00+00', 5, '2025-06-30 14:00:00+00', 4, 4, NOW(), NOW());

-- Avaliações de conformidade (referrals 6, 8, 10 — baseadas no id da 4ª consulta)
INSERT INTO protese.conformity_assessments
  (referral_id, appointment_id, adaptation_ok, occlusion_ok, material_ok,
   final_verdict, is_visible_to_third_party, assessed_by, assessed_at)
SELECT referral_id, id, true, true, true, 'approved', false, 3, attended_at + INTERVAL '2 hours'
FROM protese.appointments
WHERE referral_id IN (6, 8, 10) AND appointment_number = 4;

-- Aprovações de coordenação (referrals 8, 10)
INSERT INTO protese.coordination_approvals (referral_id, invoice_number, approved_by, approved_at)
VALUES
  (8,  'NF-2025-0842', 1, '2025-07-25 14:00:00+00'),
  (10, 'NF-2025-0631', 1, '2025-06-20 14:00:00+00');

-- Ligação de satisfação com pendência (referral 10)
INSERT INTO protese.satisfaction_calls
  (referral_id, called_at, result, needs_unit_appointment, is_unit_appointment_resolved, notes, called_by, created_at)
VALUES
  (10, '2025-07-20 14:00:00+00', 'difficulties', true, false,
   'Paciente relatou dor ao mastigar após instalação. Necessita nova consulta na unidade para ajuste.',
   4, NOW());
