<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  // Aba ativa — "ready" prioriza ação, "sent" urgência de trânsito, "history" consulta
  let activeTab = $state<'ready' | 'sent' | 'history'>('ready')

  function fmtDate(iso: string): string {
    const [y, m, d] = iso.substring(0, 10).split('-')
    return `${d}/${m}/${y}`
  }

  function fmtDateTime(iso: string): string {
    const dt = new Date(iso)
    return (
      dt.toLocaleDateString('pt-BR') +
      ' às ' +
      dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    )
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-lg font-semibold text-gray-900">Custódia de Próteses</h1>
    <p class="text-sm text-gray-500">Rastreamento do ciclo laboratório → unidade → paciente</p>
  </header>

  <!-- Abas de navegação -->
  <div class="border-b border-gray-200 bg-white px-6">
    <nav class="-mb-px flex gap-6" aria-label="Abas de custódia">
      <button
        onclick={() => (activeTab = 'ready')}
        class="border-b-2 py-3 text-sm font-medium transition-colors
          {activeTab === 'ready'
            ? 'border-yellow-500 text-yellow-700'
            : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        Em Produção
        {#if data.awaitingReady.length > 0}
          <span class="ml-1.5 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
            {data.awaitingReady.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => (activeTab = 'sent')}
        class="border-b-2 py-3 text-sm font-medium transition-colors
          {activeTab === 'sent'
            ? 'border-orange-500 text-orange-700'
            : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        Enviadas — Aguardando UBS
        {#if data.awaitingReceival.length > 0}
          <span class="ml-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
            {data.awaitingReceival.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => (activeTab = 'history')}
        class="border-b-2 py-3 text-sm font-medium transition-colors
          {activeTab === 'history'
            ? 'border-green-500 text-green-700'
            : 'border-transparent text-gray-500 hover:text-gray-700'}"
      >
        Histórico Recebidas
      </button>
    </nav>
  </div>

  <div class="mx-auto max-w-3xl space-y-4 p-6">

    <!-- Mensagem de feedback -->
    {#if form?.message}
      <div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {form.message}
      </div>
    {:else if form?.success}
      <div class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Registrado com sucesso.
      </div>
    {/if}

    <!-- ABA 1: Em Produção / Devendo -->
    {#if activeTab === 'ready'}
      {#if !data.canSeeAwaitingReady}
        <div class="rounded-lg border border-gray-200 bg-white px-5 py-10 text-center">
          <p class="text-sm text-gray-400">Sem permissão para esta seção.</p>
        </div>
      {:else if data.awaitingReady.length === 0}
        <div class="rounded-lg border border-gray-200 bg-white px-5 py-10 text-center">
          <p class="text-sm text-gray-400">Nenhuma prótese em produção no momento.</p>
        </div>
      {:else}
        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {#each data.awaitingReady as appt (appt.id)}
            <li class="px-5 py-4">
              <div class="flex items-start justify-between gap-4">
                <!-- Dados do paciente -->
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <a
                      href="/fila/{appt.referralId}/consulta/{appt.id}"
                      class="font-medium text-gray-900 hover:underline"
                    >
                      {appt.patientName}
                    </a>
                    <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {appt.appointmentLabel}
                    </span>
                  </div>
                  <p class="mt-0.5 text-sm text-gray-500">
                    {appt.unitName} · {fmtDate(appt.scheduledDate)}
                  </p>
                  {#if appt.attendedAt}
                    <p class="mt-0.5 text-xs text-gray-400">
                      Última consulta: {fmtDateTime(appt.attendedAt)}
                    </p>
                  {/if}

                  <!-- OS: mostra se preenchida, input se vazia e usuário pode inserir -->
                  {#if appt.serviceOrderNumber}
                    <p class="mt-1.5 text-sm font-medium text-gray-700">
                      OS: <span class="font-mono">{appt.serviceOrderNumber}</span>
                      {#if data.isCoordinator}
                        <!-- Coordenador pode editar OS já inserida -->
                        <span class="ml-2 text-xs text-gray-400">(editável pelo coordenador)</span>
                      {/if}
                    </p>
                    {#if data.isCoordinator}
                      <form method="POST" action="?/set_service_order" use:enhance class="mt-2 flex gap-2">
                        <input type="hidden" name="apptId" value={appt.id} />
                        <input
                          type="text"
                          name="serviceOrderNumber"
                          value={appt.serviceOrderNumber}
                          class="rounded-md border border-gray-300 px-2 py-1 text-xs font-mono w-36"
                          placeholder="Nº da OS"
                        />
                        <button type="submit" class="rounded-md bg-gray-600 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700">
                          Salvar
                        </button>
                      </form>
                    {/if}
                  {:else if data.canSeeAwaitingReady}
                    <!-- Terceirizado insere OS pela primeira vez -->
                    <form method="POST" action="?/set_service_order" use:enhance class="mt-2 flex gap-2">
                      <input type="hidden" name="apptId" value={appt.id} />
                      <input
                        type="text"
                        name="serviceOrderNumber"
                        class="rounded-md border border-gray-300 px-2 py-1 text-xs font-mono w-36"
                        placeholder="Nº da OS"
                        required
                      />
                      <button type="submit" class="rounded-md bg-gray-700 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800">
                        Inserir OS
                      </button>
                    </form>
                  {/if}
                </div>

                <!-- Ação: marcar como pronta -->
                <form method="POST" action="?/mark_prosthesis_ready" use:enhance class="shrink-0">
                  <input type="hidden" name="apptId" value={appt.id} />
                  <button
                    type="submit"
                    class="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
                  >
                    Pronta p/ envio
                  </button>
                </form>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <!-- ABA 2: Enviadas — Aguardando recebimento UBS -->
    {#if activeTab === 'sent'}
      {#if !data.canSeeAwaitingReceival}
        <div class="rounded-lg border border-gray-200 bg-white px-5 py-10 text-center">
          <p class="text-sm text-gray-400">Sem permissão para esta seção.</p>
        </div>
      {:else if data.awaitingReceival.length === 0}
        <div class="rounded-lg border border-gray-200 bg-white px-5 py-10 text-center">
          <p class="text-sm text-gray-400">Nenhuma prótese aguardando recebimento na UBS.</p>
        </div>
      {:else}
        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {#each data.awaitingReceival as appt (appt.id)}
            <li class="flex items-center justify-between gap-4 px-5 py-4">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <a
                    href="/fila/{appt.referralId}/consulta/{appt.id}"
                    class="font-medium text-gray-900 hover:underline"
                  >
                    {appt.patientName}
                  </a>
                  <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {appt.appointmentLabel}
                  </span>
                  {#if appt.serviceOrderNumber}
                    <span class="rounded bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-700">
                      OS {appt.serviceOrderNumber}
                    </span>
                  {/if}
                </div>
                <p class="mt-0.5 text-sm text-gray-500">{appt.unitName}</p>
                {#if appt.prosthesisReadyAt}
                  <p class="mt-0.5 text-xs text-gray-400">
                    Enviada em {fmtDateTime(appt.prosthesisReadyAt)}
                  </p>
                {/if}
              </div>
              <form method="POST" action="?/confirm_received" use:enhance class="shrink-0">
                <input type="hidden" name="apptId" value={appt.id} />
                <button
                  type="submit"
                  class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Confirmar recebimento
                </button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <!-- ABA 3: Histórico — Recebidas pela UBS -->
    {#if activeTab === 'history'}
      {#if data.received.length === 0}
        <div class="rounded-lg border border-gray-200 bg-white px-5 py-10 text-center">
          <p class="text-sm text-gray-400">Nenhuma prótese recebida no histórico.</p>
        </div>
      {:else}
        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {#each data.received as appt (appt.id)}
            <li class="px-5 py-4">
              <div class="flex flex-wrap items-center gap-2">
                <a
                  href="/fila/{appt.referralId}/consulta/{appt.id}"
                  class="font-medium text-gray-900 hover:underline"
                >
                  {appt.patientName}
                </a>
                <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {appt.appointmentLabel}
                </span>
                {#if appt.serviceOrderNumber}
                  <span class="rounded bg-gray-50 px-2 py-0.5 text-xs font-mono text-gray-500">
                    OS {appt.serviceOrderNumber}
                  </span>
                {/if}
              </div>
              <p class="mt-0.5 text-sm text-gray-500">{appt.unitName}</p>
              <div class="mt-1 flex flex-wrap gap-4 text-xs text-gray-400">
                {#if appt.prosthesisReadyAt}
                  <span>Enviada: {fmtDateTime(appt.prosthesisReadyAt)}</span>
                {/if}
                <span>Recebida: {fmtDateTime(appt.prosthesisReceivedAt)}</span>
                {#if appt.receivedByName}
                  <span>por {appt.receivedByName}</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

  </div>
</div>
