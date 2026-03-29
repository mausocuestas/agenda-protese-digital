<script lang="ts">
  import type { PageData } from './$types'
  import { formatQueueTime } from '$lib/utils'

  let { data }: { data: PageData } = $props()

  const canSchedule =
    (data.user?.role === 'attendant' || data.user?.role === 'coordinator') &&
    data.referral.status === 'active'

  // Formata data ISO para dd/mm/aaaa
  function fmtDate(iso: string): string {
    const [y, m, d] = iso.substring(0, 10).split('-')
    return `${d}/${m}/${y}`
  }

  // Formata hora HH:MM:SS para HH:MM
  function fmtTime(t: string): string {
    return t.substring(0, 5)
  }

  // Formata data+hora ISO para dd/mm/aaaa às HH:MM
  function fmtDateTime(iso: string): string {
    const dt = new Date(iso)
    return dt.toLocaleDateString('pt-BR') + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // Máscara parcial de CPF: 123.***.***-09
  function maskCpf(cpf: string): string {
    return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`
  }

  const statusLabel: Record<string, string> = {
    active: 'Ativo',
    pending_reassessment: 'Aguardando reavaliação',
    suspended: 'Suspenso',
    inactive: 'Inativo',
  }

  const statusClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending_reassessment: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-gray-100 text-gray-700',
    inactive: 'bg-red-100 text-red-800',
  }

  const outcomeLabel: Record<string, string> = {
    attended: 'Compareceu',
    absent: 'Faltou',
    refused: 'Recusado',
  }

  const outcomeClass: Record<string, string> = {
    attended: 'bg-green-100 text-green-800',
    absent: 'bg-red-100 text-red-800',
    refused: 'bg-orange-100 text-orange-800',
  }

  const appointmentLabel: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega definitiva',
  }

  const inactivationLabel: Record<string, string> = {
    dropout: 'Desistência',
    death: 'Óbito',
    cancellation: 'Cancelamento administrativo',
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-center gap-4">
      <a
        href="/fila"
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        ← Voltar para a fila
      </a>
      <div class="h-5 w-px bg-gray-200"></div>
      <div class="flex flex-1 items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">{data.patient.fullName}</h1>
          <p class="text-sm text-gray-500">{data.referral.unitName}</p>
        </div>
        {#if canSchedule}
          <a
            href="/fila/{data.referral.id}/agendar"
            class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            + Agendar consulta
          </a>
        {/if}
      </div>
    </div>
  </header>

  <div class="mx-auto max-w-4xl space-y-6 p-6">

    <!-- Flags de prioridade (se houver) -->
    {#if data.referral.hasOmbudsmanFlag || data.referral.hasAccidentFlag || data.patient.isElderly || data.referral.isDelayed}
      <div class="flex flex-wrap gap-2">
        {#if data.referral.hasOmbudsmanFlag}
          <span class="rounded-md bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">Ouvidoria</span>
        {/if}
        {#if data.referral.hasAccidentFlag}
          <span class="rounded-md bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">Acidente de trabalho</span>
        {/if}
        {#if data.patient.isElderly}
          <span class="rounded-md bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">Idoso (60+)</span>
        {/if}
        {#if data.referral.isDelayed}
          <span class="rounded-md bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700">Atrasado (+180 dias)</span>
        {/if}
      </div>
    {/if}

    <!-- Dados do paciente -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Dados do paciente</h2>
      </div>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
        <div>
          <dt class="text-xs text-gray-500">Nome completo</dt>
          <dd class="mt-0.5 font-medium text-gray-900">{data.patient.fullName}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">CPF</dt>
          <dd class="mt-0.5 font-mono text-gray-900">{maskCpf(data.patient.cpf)}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Data de nascimento</dt>
          <dd class="mt-0.5 text-gray-900">{fmtDate(data.patient.birthDate)} ({data.patient.age} anos)</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Telefone</dt>
          <dd class="mt-0.5 text-gray-900">{data.patient.phone}</dd>
        </div>
      </dl>
    </section>

    <!-- Dados do encaminhamento -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Encaminhamento</h2>
      </div>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
        <div>
          <dt class="text-xs text-gray-500">Status</dt>
          <dd class="mt-0.5">
            <span class="rounded-full px-2.5 py-1 text-xs font-medium {statusClass[data.referral.status]}">
              {statusLabel[data.referral.status]}
            </span>
            {#if data.referral.inactivationReason}
              <span class="mt-1 block text-xs text-gray-500">
                Motivo: {inactivationLabel[data.referral.inactivationReason]}
              </span>
            {/if}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Data de entrada</dt>
          <dd class="mt-0.5 text-gray-900">{fmtDate(data.referral.introductionDate)}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Tempo na fila</dt>
          <dd class="mt-0.5 {data.referral.isDelayed ? 'font-semibold text-purple-700' : 'text-gray-900'}">
            {formatQueueTime(data.referral.daysInQueue)}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Número de OS</dt>
          <dd class="mt-0.5 font-mono text-gray-900">{data.referral.serviceOrderNumber ?? '—'}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-xs text-gray-500">Tipo(s) de prótese</dt>
          <dd class="mt-1 flex flex-wrap gap-1">
            {#each data.referral.prosthesisTypes as type}
              <span class="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-700">{type}</span>
            {/each}
          </dd>
        </div>
        <div class="col-span-2">
          <dt class="text-xs text-gray-500">Cadastrado por</dt>
          <dd class="mt-0.5 text-gray-900">{data.referral.createdByName} <span class="text-gray-400">em {fmtDateTime(data.referral.createdAt)}</span></dd>
        </div>
      </dl>
    </section>

    <!-- Consultas -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Consultas ({data.appointments.length})
        </h2>
      </div>
      {#if data.appointments.length === 0}
        <p class="px-5 py-6 text-sm text-gray-400">Nenhuma consulta agendada.</p>
      {:else}
        <ul class="divide-y divide-gray-100">
          {#each data.appointments as appt (appt.id)}
            <li class="px-5 py-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <a
                    href="/fila/{data.referral.id}/consulta/{appt.id}"
                    class="font-medium text-gray-900 hover:underline"
                  >
                    {appointmentLabel[appt.appointmentNumber] ?? `Consulta ${appt.appointmentNumber}`}
                  </a>
                  <p class="mt-0.5 text-sm text-gray-500">
                    {fmtDate(appt.scheduledDate)} às {fmtTime(appt.scheduledTime)} — {appt.unitName}
                  </p>
                  {#if appt.refusedReason}
                    <p class="mt-1 text-sm text-orange-700">Motivo de recusa: {appt.refusedReason}</p>
                  {/if}
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  {#if appt.outcome}
                    <span class="rounded-full px-2.5 py-1 text-xs font-medium {outcomeClass[appt.outcome]}">
                      {outcomeLabel[appt.outcome]}
                    </span>
                  {:else}
                    <a
                      href="/fila/{data.referral.id}/consulta/{appt.id}"
                      class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-200"
                    >
                      Registrar resultado →
                    </a>
                  {/if}
                  {#if appt.prosthesisReadyAt}
                    <span class="text-xs text-gray-400">Prótese pronta: {fmtDateTime(appt.prosthesisReadyAt)}</span>
                  {/if}
                  {#if appt.prosthesisReceivedAt}
                    <span class="text-xs text-green-700">Recebida na unidade: {fmtDateTime(appt.prosthesisReceivedAt)}</span>
                  {/if}
                </div>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Notas -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Observações ({data.notes.length})
        </h2>
      </div>
      {#if data.notes.length === 0}
        <p class="px-5 py-6 text-sm text-gray-400">Nenhuma observação registrada.</p>
      {:else}
        <ul class="divide-y divide-gray-100">
          {#each data.notes as note (note.id)}
            <li class="px-5 py-4">
              <p class="text-sm text-gray-800">{note.body}</p>
              <p class="mt-1 text-xs text-gray-400">{note.createdByName} — {fmtDateTime(note.createdAt)}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

  </div>
</div>
