<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  const appointmentLabel: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega definitiva',
  }

  function fmtDate(iso: string): string {
    const [y, m, d] = iso.substring(0, 10).split('-')
    return `${d}/${m}/${y}`
  }

  function fmtTime(t: string): string {
    return t.substring(0, 5)
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

  <div class="mx-auto max-w-3xl space-y-8 p-6">

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

    <!-- Seção 1: Aguardando marcação como pronta (terceirizado/coordenador) -->
    {#if data.canSeeAwaitingReady}
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Aguardando confecção</h2>
            <p class="text-sm text-gray-500">
              Consultas realizadas onde a prótese ainda não foi marcada como pronta
            </p>
          </div>
          <span class="rounded-full bg-yellow-100 px-2.5 py-1 text-sm font-medium text-yellow-800">
            {data.awaitingReady.length}
          </span>
        </div>

        {#if data.awaitingReady.length === 0}
          <div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
            <p class="text-sm text-gray-400">Nenhuma prótese aguardando confecção.</p>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {#each data.awaitingReady as appt (appt.id)}
              <li class="flex items-center justify-between gap-4 px-5 py-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
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
                  <p class="mt-0.5 truncate text-sm text-gray-500">
                    {appt.unitName} · {fmtDate(appt.scheduledDate)} às {fmtTime(appt.scheduledTime)}
                  </p>
                  {#if appt.attendedAt}
                    <p class="mt-0.5 text-xs text-gray-400">
                      Compareceu em {fmtDateTime(appt.attendedAt)}
                    </p>
                  {/if}
                </div>
                <form method="POST" action="?/mark_prosthesis_ready" use:enhance class="shrink-0">
                  <input type="hidden" name="apptId" value={appt.id} />
                  <button
                    type="submit"
                    class="rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700"
                  >
                    Marcar pronta
                  </button>
                </form>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- Seção 2: Próteses prontas aguardando recebimento (atendente/coordenador) -->
    {#if data.canSeeAwaitingReceival}
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Prontas para receber</h2>
            <p class="text-sm text-gray-500">
              Próteses marcadas como prontas pelo protético, aguardando confirmação de recebimento
            </p>
          </div>
          <span class="rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-800">
            {data.awaitingReceival.length}
          </span>
        </div>

        {#if data.awaitingReceival.length === 0}
          <div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
            <p class="text-sm text-gray-400">Nenhuma prótese aguardando recebimento.</p>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {#each data.awaitingReceival as appt (appt.id)}
              <li class="flex items-center justify-between gap-4 px-5 py-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
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
                  <p class="mt-0.5 truncate text-sm text-gray-500">
                    {appt.unitName} · {fmtDate(appt.scheduledDate)} às {fmtTime(appt.scheduledTime)}
                  </p>
                  {#if appt.prosthesisReadyAt}
                    <p class="mt-0.5 text-xs text-gray-400">
                      Pronta em {fmtDateTime(appt.prosthesisReadyAt)}
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
      </section>
    {/if}

    <!-- Estado vazio para roles sem acesso a nenhuma seção -->
    {#if !data.canSeeAwaitingReady && !data.canSeeAwaitingReceival}
      <div class="rounded-lg border border-gray-200 bg-white px-5 py-12 text-center">
        <p class="text-sm text-gray-400">Sem permissão para visualizar custódias.</p>
      </div>
    {/if}

  </div>
</div>
