<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  // Rótulo de cada número de consulta
  const APPOINTMENT_LABELS: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega Definitiva',
  }

  function getLabel(n: number): string {
    return APPOINTMENT_LABELS[n] ?? `Consulta ${n}`
  }

  // Formata 'YYYY-MM-DD' → 'DD/MM/AAAA' com nome do dia da semana
  function formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' })
    const formatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${formatted}`
  }

  // Formata 'HH:MM:SS' → 'HH:MM'
  function formatTime(t: string): string {
    return t.slice(0, 5)
  }

  // Cor e texto do badge de resultado
  const outcomeConfig = {
    attended: { label: 'Compareceu', cls: 'bg-green-100 text-green-800' },
    absent: { label: 'Faltou', cls: 'bg-red-100 text-red-800' },
    refused: { label: 'Recusado', cls: 'bg-orange-100 text-orange-800' },
  }

  // Status da custódia da prótese (relevante a partir da consulta 2)
  function getProsthesisStatus(appt: {
    appointmentNumber: number
    prosthesisReadyAt: Date | null
    prosthesisReceivedAt: Date | null
  }): { label: string; cls: string } | null {
    if (appt.appointmentNumber < 2) return null
    if (appt.prosthesisReceivedAt) return { label: 'Recebida na unidade', cls: 'bg-blue-100 text-blue-800' }
    if (appt.prosthesisReadyAt) return { label: 'Prótese pronta', cls: 'bg-teal-100 text-teal-800' }
    return { label: 'Aguardando confecção', cls: 'bg-gray-100 text-gray-600' }
  }

  // Agrupa os schedules por data para facilitar a renderização
  let groupsByDate = $derived(() => {
    const map = new Map<string, typeof data.scheduleGroups>()
    for (const s of data.scheduleGroups) {
      if (!map.has(s.scheduledDate)) map.set(s.scheduledDate, [])
      map.get(s.scheduledDate)!.push(s)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  })

  // Total de consultas pendentes de resultado (para o subtítulo)
  let pendingCount = $derived(
    data.scheduleGroups.reduce(
      (acc, s) => acc + s.appointments.filter((a) => a.outcome === null).length,
      0
    )
  )

  // Verifica se uma data é hoje, passada ou futura
  function getDateClass(dateStr: string): 'past' | 'today' | 'future' {
    if (dateStr < data.today) return 'past'
    if (dateStr === data.today) return 'today'
    return 'future'
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-lg font-semibold text-gray-900">Minha Agenda</h1>
    <p class="text-sm text-gray-500">
      {#if pendingCount > 0}
        {pendingCount} consulta{pendingCount !== 1 ? 's' : ''} pendente{pendingCount !== 1 ? 's' : ''} de resultado
      {:else}
        Nenhuma consulta pendente de resultado
      {/if}
    </p>
  </header>

  <div class="mx-auto max-w-4xl px-6 py-6 space-y-8">
    {#if data.scheduleGroups.length === 0}
      <!-- Estado vazio -->
      <div class="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center">
        <p class="text-sm text-gray-400">Nenhuma visita agendada a partir de hoje.</p>
      </div>
    {:else}
      {#each groupsByDate() as [date, schedules]}
        <!-- Separador de data -->
        <div>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide
            {getDateClass(date) === 'today' ? 'text-blue-600' : getDateClass(date) === 'past' ? 'text-gray-400' : 'text-gray-500'}">
            {formatDate(date)}{getDateClass(date) === 'today' ? ' — Hoje' : getDateClass(date) === 'past' ? ' — Histórico' : ''}
          </h2>

          <div class="space-y-4">
            {#each schedules as schedule (schedule.scheduleId)}
              <!-- Card de visita -->
              <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <!-- Cabeçalho da visita -->
                <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <span class="font-medium text-gray-800">{schedule.unitName}</span>
                  <span class="text-sm text-gray-500">
                    {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
                  </span>
                </div>

                {#if schedule.appointments.length === 0}
                  <!-- Visita sem consultas agendadas -->
                  <p class="px-4 py-6 text-center text-sm text-gray-400">
                    Nenhuma consulta agendada para esta visita.
                  </p>
                {:else}
                  <!-- Cards de consulta — layout touch-friendly para mobile -->
                  <ul class="divide-y divide-gray-100">
                    {#each schedule.appointments as appt (appt.id)}
                      {@const outcome = appt.outcome ? outcomeConfig[appt.outcome] : null}
                      {@const prosthesis = getProsthesisStatus(appt)}
                      <li class="px-4 py-4">
                        <!-- Linha superior: horário + tipo de consulta -->
                        <div class="mb-1 flex items-center gap-2 text-xs text-gray-500">
                          <span class="font-mono">{formatTime(appt.scheduledTime)}</span>
                          <span class="text-gray-300">·</span>
                          <span>{getLabel(appt.appointmentNumber)}</span>
                        </div>

                        <!-- Nome do paciente -->
                        <p class="text-base font-semibold text-gray-900">{appt.patientName}</p>

                        <!-- Badges de status -->
                        <div class="mt-2 flex flex-wrap gap-2">
                          {#if outcome}
                            <span class="rounded-full px-2.5 py-1 text-xs font-medium {outcome.cls}">
                              {outcome.label}
                            </span>
                          {:else}
                            <span class="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700">
                              Pendente
                            </span>
                          {/if}
                          {#if prosthesis}
                            <span class="rounded-full px-2.5 py-1 text-xs font-medium {prosthesis.cls}">
                              {prosthesis.label}
                            </span>
                          {/if}
                        </div>

                        <!-- Botão de ação — área de toque grande -->
                        <a
                          href="/fila/{appt.referralId}/consulta/{appt.id}"
                          class="mt-3 flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                        >
                          Abrir consulta →
                        </a>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
