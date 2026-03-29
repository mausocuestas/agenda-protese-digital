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

  const channelLabel: Record<string, string> = {
    phone: 'Telefone',
    whatsapp: 'WhatsApp',
    in_person: 'Pessoalmente',
  }

  const contactResultLabel: Record<string, string> = {
    confirmed: 'Confirmou presença',
    no_answer: 'Sem resposta',
    cancelled: 'Desmarcou',
  }

  const contactResultClass: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800',
    no_answer: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  // Controles de estado local
  let selectedOutcome = $state('')
  let showContactForm = $state(false)
  let selectedChannel = $state('phone')

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

  // Data/hora local no formato datetime-local (YYYY-MM-DDTHH:MM)
  function nowLocal(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d}T${hh}:${mm}`
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-center gap-4">
      <a
        href="/fila/{data.referralId}"
        class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      >
        ← Voltar
      </a>
      <div class="h-5 w-px bg-gray-200"></div>
      <div>
        <h1 class="text-lg font-semibold text-gray-900">
          {appointmentLabel[data.appointment.appointmentNumber] ??
            `Consulta ${data.appointment.appointmentNumber}`}
        </h1>
        <p class="text-sm text-gray-500">{data.patientName} — {data.unitName}</p>
      </div>
    </div>
  </header>

  <div class="mx-auto max-w-2xl space-y-6 p-6">

    <!-- Mensagem de erro ou sucesso (ação genérica) -->
    {#if form?.message}
      <div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {form.message}
      </div>
    {:else if form?.success}
      <div class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Operação realizada com sucesso.
      </div>
    {/if}

    <!-- Detalhes da consulta -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Detalhes</h2>
      </div>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4">
        <div>
          <dt class="text-xs text-gray-500">Nº da consulta</dt>
          <dd class="mt-0.5 font-medium text-gray-900">
            {data.appointment.appointmentNumber}
            {#if appointmentLabel[data.appointment.appointmentNumber]}
              <span class="font-normal text-gray-500">
                — {appointmentLabel[data.appointment.appointmentNumber]}
              </span>
            {/if}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Data</dt>
          <dd class="mt-0.5 text-gray-900">{fmtDate(data.appointment.scheduledDate)}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Horário</dt>
          <dd class="mt-0.5 text-gray-900">{fmtTime(data.appointment.scheduledTime)}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Local</dt>
          <dd class="mt-0.5 text-gray-900">{data.appointment.unitName}</dd>
        </div>
        <div>
          <dt class="text-xs text-gray-500">Telefone</dt>
          <dd class="mt-0.5 text-gray-900">{data.patientPhone}</dd>
        </div>
        <div class="col-span-2 sm:col-span-3">
          <dt class="text-xs text-gray-500">Agendado por</dt>
          <dd class="mt-0.5 text-gray-900">
            {data.appointment.createdByName}
            <span class="text-gray-400">em {fmtDateTime(data.appointment.createdAt)}</span>
          </dd>
        </div>
      </dl>
    </section>

    <!-- Resultado da consulta -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Resultado</h2>
      </div>

      {#if data.appointment.outcome}
        <!-- Resultado já registrado — somente leitura -->
        <div class="px-5 py-4">
          <div class="flex items-center gap-3">
            <span
              class="rounded-full px-3 py-1 text-sm font-medium {outcomeClass[
                data.appointment.outcome
              ]}"
            >
              {outcomeLabel[data.appointment.outcome]}
            </span>
            {#if data.appointment.attendedAt}
              <span class="text-sm text-gray-500">{fmtDateTime(data.appointment.attendedAt)}</span>
            {/if}
          </div>
          {#if data.appointment.refusedReason}
            <p class="mt-2 text-sm text-orange-700">Motivo: {data.appointment.refusedReason}</p>
          {/if}
          {#if data.appointment.nextDurationEstimate}
            <p class="mt-2 text-sm text-gray-600">
              Estimativa para próxima peça:
              <strong>{data.appointment.nextDurationEstimate} minutos</strong>
            </p>
          {/if}
        </div>

      {:else if data.canEditOutcome}
        <!-- Formulário de registro de resultado -->
        <form
          method="POST"
          action="?/register_outcome"
          use:enhance
          class="space-y-5 px-5 py-4"
        >
          <fieldset>
            <legend class="text-sm font-medium text-gray-700">
              O paciente compareceu à consulta? <span class="text-red-500">*</span>
            </legend>
            <div class="mt-3 space-y-2.5">
              <label class="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="outcome"
                  value="attended"
                  bind:group={selectedOutcome}
                />
                <span class="text-sm text-gray-800">Compareceu</span>
              </label>
              <label class="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="outcome"
                  value="absent"
                  bind:group={selectedOutcome}
                />
                <span class="text-sm text-gray-800">Faltou (sem avisar)</span>
              </label>
              <label class="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="outcome"
                  value="refused"
                  bind:group={selectedOutcome}
                />
                <span class="text-sm text-gray-800">Recusado pelo protético</span>
              </label>
            </div>
          </fieldset>

          {#if selectedOutcome === 'refused'}
            <div>
              <label for="refusedReason" class="block text-sm font-medium text-gray-700">
                Motivo da recusa <span class="text-red-500">*</span>
              </label>
              <textarea
                id="refusedReason"
                name="refusedReason"
                rows="2"
                required
                placeholder="Descreva o motivo..."
                class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              ></textarea>
            </div>
          {/if}

          {#if selectedOutcome === 'attended'}
            <div>
              <p class="text-sm font-medium text-gray-700">
                Estimativa para confecção da próxima peça
              </p>
              <div class="mt-2 flex gap-5">
                <label class="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="nextDurationEstimate" value="30" />
                  <span class="text-sm text-gray-800">30 min</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="nextDurationEstimate" value="60" />
                  <span class="text-sm text-gray-800">60 min</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2">
                  <input type="radio" name="nextDurationEstimate" value="" checked />
                  <span class="text-sm text-gray-500">Não informado</span>
                </label>
              </div>
            </div>
          {/if}

          <div class="flex justify-end border-t border-gray-100 pt-4">
            <button
              type="submit"
              disabled={!selectedOutcome}
              class="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
            >
              Salvar resultado
            </button>
          </div>
        </form>

      {:else}
        <p class="px-5 py-6 text-sm text-gray-400">Resultado ainda não registrado.</p>
      {/if}
    </section>

    <!-- Custódia da prótese (consultas 2, 3 e 4) -->
    {#if data.hasProsthesisCustody}
      <section class="rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-5 py-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Custódia da prótese
          </h2>
        </div>
        <div class="divide-y divide-gray-100">

          <!-- Passo 1: terceirizado marca como pronta -->
          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-medium text-gray-900">Prótese pronta (protético)</p>
              {#if data.appointment.prosthesisReadyAt}
                <p class="mt-0.5 text-xs text-gray-500">
                  {fmtDateTime(data.appointment.prosthesisReadyAt)}
                </p>
              {:else}
                <p class="mt-0.5 text-xs text-gray-400">Aguardando confecção</p>
              {/if}
            </div>
            {#if data.appointment.prosthesisReadyAt}
              <span class="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                Pronta
              </span>
            {:else if data.canMarkReady}
              <form method="POST" action="?/mark_prosthesis_ready" use:enhance>
                <button
                  type="submit"
                  class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Marcar como pronta
                </button>
              </form>
            {:else}
              <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-400">Pendente</span>
            {/if}
          </div>

          <!-- Passo 2: atendente confirma recebimento -->
          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-medium text-gray-900">Recebida na unidade (atendente)</p>
              {#if data.appointment.prosthesisReceivedAt}
                <p class="mt-0.5 text-xs text-gray-500">
                  {fmtDateTime(data.appointment.prosthesisReceivedAt)}
                </p>
              {:else}
                <p class="mt-0.5 text-xs text-gray-400">
                  {data.appointment.prosthesisReadyAt
                    ? 'Aguardando confirmação'
                    : 'Depende do passo anterior'}
                </p>
              {/if}
            </div>
            {#if data.appointment.prosthesisReceivedAt}
              <span class="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                Recebida
              </span>
            {:else if data.canConfirmReceived}
              <form method="POST" action="?/confirm_received" use:enhance>
                <button
                  type="submit"
                  class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Confirmar recebimento
                </button>
              </form>
            {:else}
              <span class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-400">Pendente</span>
            {/if}
          </div>

        </div>
      </section>
    {/if}

    <!-- Tentativas de contato -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Tentativas de contato ({data.contactAttempts.length})
        </h2>
        <button
          type="button"
          onclick={() => (showContactForm = !showContactForm)}
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          {showContactForm ? 'Cancelar' : '+ Registrar'}
        </button>
      </div>

      {#if showContactForm}
        <form
          method="POST"
          action="?/add_contact"
          use:enhance={() => {
            return async ({ result, update }) => {
              await update()
              if (result.type === 'success') showContactForm = false
            }
          }}
          class="space-y-4 border-b border-gray-100 px-5 py-4"
        >
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="channel" class="block text-sm font-medium text-gray-700">
                Canal <span class="text-red-500">*</span>
              </label>
              <select
                id="channel"
                name="channel"
                required
                bind:value={selectedChannel}
                class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              >
                <option value="phone">Telefone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="in_person">Pessoalmente</option>
              </select>
            </div>
            <div>
              <label for="result" class="block text-sm font-medium text-gray-700">
                Resultado <span class="text-red-500">*</span>
              </label>
              <select
                id="result"
                name="result"
                required
                class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              >
                <option value="confirmed">Confirmou presença</option>
                <option value="no_answer">Sem resposta</option>
                <option value="cancelled">Desmarcou</option>
              </select>
            </div>
          </div>

          <div>
            <label for="attemptedAt" class="block text-sm font-medium text-gray-700">
              Data e hora da tentativa <span class="text-red-500">*</span>
            </label>
            <input
              id="attemptedAt"
              name="attemptedAt"
              type="datetime-local"
              required
              value={nowLocal()}
              class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            />
          </div>

          {#if selectedChannel === 'whatsapp'}
            <div>
              <label for="whatsappDeadline" class="block text-sm font-medium text-gray-700">
                Prazo de resposta
              </label>
              <input
                id="whatsappDeadline"
                name="whatsappDeadline"
                type="datetime-local"
                class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
              />
            </div>
          {/if}

          <div>
            <label for="notes" class="block text-sm font-medium text-gray-700">
              Observações
            </label>
            <textarea
              id="notes"
              name="notes"
              rows="2"
              placeholder="Com quem falou, horário de preferência, etc."
              class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
            ></textarea>
          </div>

          <div class="flex justify-end">
            <button
              type="submit"
              class="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              Salvar tentativa
            </button>
          </div>
        </form>
      {/if}

      {#if data.contactAttempts.length === 0 && !showContactForm}
        <p class="px-5 py-6 text-sm text-gray-400">Nenhuma tentativa de contato registrada.</p>
      {:else if data.contactAttempts.length > 0}
        <ul class="divide-y divide-gray-100">
          {#each data.contactAttempts as attempt (attempt.id)}
            <li class="px-5 py-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {channelLabel[attempt.channel]} — {fmtDateTime(attempt.attemptedAt)}
                  </p>
                  {#if attempt.notes}
                    <p class="mt-0.5 text-sm text-gray-600">{attempt.notes}</p>
                  {/if}
                  {#if attempt.whatsappDeadline}
                    <p class="mt-0.5 text-xs text-gray-400">
                      Prazo: {fmtDateTime(attempt.whatsappDeadline)}
                    </p>
                  {/if}
                  <p class="mt-1 text-xs text-gray-400">{attempt.contactedByName}</p>
                </div>
                <span
                  class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium {contactResultClass[
                    attempt.result
                  ]}"
                >
                  {contactResultLabel[attempt.result]}
                </span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

  </div>
</div>
