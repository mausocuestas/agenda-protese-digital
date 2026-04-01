/**
 * Seed de dados iniciais — agenda-protese-digital
 *
 * O que faz:
 *   1. Insere os 7 tipos de prótese padrão (ON CONFLICT DO NOTHING)
 *   2. Insere os 8 parâmetros de sistema (ON CONFLICT DO NOTHING)
 *   3. Recria os 18 vínculos de unit_responsibilities conforme o discovery v2
 *      (Centro-UBS: própria + 8 designadas; Imperial-USF: própria + 8 designadas)
 *
 * Execução:
 *   pnpm db:seed
 *
 * Requerimento:
 *   DATABASE_URL no ambiente (via .env ou .env.local)
 */

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não definida. Verifique seu arquivo .env ou .env.local')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function seed() {
  console.log('🌱 Iniciando seed...\n')

  // ─── 1. Tipos de prótese ─────────────────────────────────────────────────────
  // Nomes conforme uso já consolidado no banco (ON CONFLICT garante idempotência)
  const prosthesisTypes = [
    'Prótese Total Superior',
    'Prótese Total Inferior',
    'Prótese Parcial Superior Removível',
    'Prótese Parcial Inferior Removível',
    'Placa de Mordida',
    'Prótese Temporária',
    'Reembasamento e Conserto',
  ]

  for (const name of prosthesisTypes) {
    await sql`
      INSERT INTO protese.prosthesis_types (name)
      VALUES (${name})
      ON CONFLICT (name) DO NOTHING
    `
  }
  console.log(`✅ prosthesis_types — ${prosthesisTypes.length} tipos verificados`)

  // ─── 2. Parâmetros do sistema ────────────────────────────────────────────────
  // Requer um usuário coordinator existente para satisfazer a FK updated_by
  const [coordinator] = await sql`
    SELECT id FROM protese.users
    WHERE role = 'coordinator' AND is_active = true
    LIMIT 1
  `

  let seedUserId: number
  if (coordinator) {
    seedUserId = coordinator.id as number
  } else {
    // Ambiente vazio: cria usuário placeholder só para o seed funcionar
    const [created] = await sql`
      INSERT INTO protese.users (name, email, role, is_active)
      VALUES ('Sistema', 'sistema@saude.atibaia.sp.gov.br', 'coordinator', true)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `
    seedUserId = created.id as number
    console.log('ℹ️  Usuário "Sistema" criado como placeholder para updated_by')
  }

  const configs: [string, string][] = [
    ['reassessment_months',     '6'],   // meses até status pending_reassessment
    ['default_interval_days',   '14'],  // intervalo padrão entre consultas (dias)
    ['removable_first_interval', '21'], // intervalo maior para próteses removíveis
    ['monthly_goal',            '20'],  // meta mensal de atendimentos
    ['contact_max_attempts',    '5'],   // tentativas máximas antes de liberar vaga
    ['contact_flag_attempts',   '3'],   // tentativas para alerta amarelo
    ['whatsapp_deadline_hours', '24'],  // prazo de resposta WhatsApp (horas)
    ['elderly_age_threshold',   '80'],  // idade mínima para flag ⚠️ Idoso
    ['delay_days',              '180'], // dias na fila para flag ATR Atrasado
  ]

  for (const [key, value] of configs) {
    await sql`
      INSERT INTO protese.system_configs (key, value, updated_by)
      VALUES (${key}, ${value}, ${seedUserId})
      ON CONFLICT (key) DO NOTHING
    `
  }
  console.log(`✅ system_configs — ${configs.length} parâmetros verificados`)

  // ─── 3. Vínculos de unidade responsável ─────────────────────────────────────
  // Fonte: docs/agenda-protese-descoberta-v2.md — seção "Unidades Responsáveis"
  //
  // Centro - UBS (id 12): própria + 8 unidades designadas
  // Imperial - USF (id 17): própria + 8 unidades designadas
  //
  // Cada unidade responsável vê seus próprios pacientes + os das unidades designadas
  // Lógica de visibilidade: JOIN unit_responsibilities WHERE responsible_unit_id = <id>

  await sql`DELETE FROM protese.unit_responsibilities`

  const unitLinks: [number, number][] = [
    // Centro - UBS (12) ─────────────────────────────────
    [12, 12],  // Centro - UBS (própria)
    [12,  3],  // Alvinópolis - UBS
    [12,  5],  // Boa Vista - USF
    [12,  6],  // Cachoeira - USF
    [12, 13],  // CEO (Centro de Especialidades Odontológicas)
    [12, 16],  // Flamenguinho - UBS
    [12, 18],  // Itapetinga - USF
    [12, 23],  // Portão - USF
    [12, 33],  // Tanque - USF
    // Imperial - USF (17) ────────────────────────────────
    [17, 17],  // Imperial - USF (própria)
    [17, 15],  // Cerejeiras - USF
    [17, 20],  // Maracanã - USF
    [17, 25],  // Rio Abaixo - USF
    [17, 26],  // Rio Acima - USF
    [17, 27],  // Rosário - USF
    [17, 30],  // Santa Clara - USF
    [17, 31],  // São José - USF
    [17, 35],  // Usina - USF
  ]

  for (const [responsibleUnitId, designatedUnitId] of unitLinks) {
    await sql`
      INSERT INTO protese.unit_responsibilities (responsible_unit_id, designated_unit_id)
      VALUES (${responsibleUnitId}, ${designatedUnitId})
    `
  }
  console.log(
    `✅ unit_responsibilities — ${unitLinks.length} vínculos inseridos` +
    ` (Centro: 9, Imperial: 9)`
  )

  console.log('\n🎉 Seed concluído com sucesso!')
}

seed().catch((err) => {
  console.error('\n❌ Seed falhou:', err.message ?? err)
  process.exit(1)
})
