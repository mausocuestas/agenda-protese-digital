import type { RequestHandler } from './$types'
import { json } from '@sveltejs/kit'
import { db } from '$lib/server/db/client'
import { referrals, systemConfigs } from '$lib/server/db/index'
import { eq, and, isNull, lt, inArray, sql } from 'drizzle-orm'
import { CRON_SECRET } from '$env/static/private'

// Disparado diariamente pelo Vercel Cron (vercel.json) — ou por qualquer serviço externo.
// Para executar manualmente: GET /api/jobs/reassessment
//   com header: Authorization: Bearer <CRON_SECRET>
export const GET: RequestHandler = async ({ request }) => {
  // Rejeita chamadas sem o token correto
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Lê o limiar configurado pelo coordenador (padrão: 6 meses)
  const configRow = await db.query.systemConfigs.findFirst({
    where: eq(systemConfigs.key, 'reassessment_months'),
  })
  const months = parseInt(configRow?.value ?? '6', 10)

  // Encaminhamentos ativos que não foram atualizados em mais de N meses
  // updatedAt reflete a última movimentação real do caso (agendamento, edição, etc.)
  const candidates = await db
    .select({ id: referrals.id })
    .from(referrals)
    .where(
      and(
        eq(referrals.status, 'active'),
        isNull(referrals.deletedAt),
        lt(referrals.updatedAt, sql`NOW() - (${months} * INTERVAL '1 month')`)
      )
    )

  const affected = candidates.length

  if (affected > 0) {
    const ids = candidates.map((r) => r.id)
    await db
      .update(referrals)
      .set({ status: 'pending_reassessment', updatedAt: new Date() })
      .where(
        and(
          eq(referrals.status, 'active'), // garante idempotência se chamado duas vezes
          inArray(referrals.id, ids)
        )
      )
  }

  return json({ affected, months, ranAt: new Date().toISOString() })
}
