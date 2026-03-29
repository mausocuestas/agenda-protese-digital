<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  // ID do item com formulário expandido em cada seção
  let expandedConformity = $state<number | null>(null)
  let expandedSatisfaction = $state<number | null>(null)

  // Controles do formulário de conformidade — reiniciados ao fechar
  let adaptationOk = $state(true)
  let occlusionOk = $state(true)
  let materialOk = $state(true)
  let finalVerdict = $state<'approved' | 'refused'>('approved')

  function openConformity(appointmentId: number) {
    expandedConformity = appointmentId
    adaptationOk = true
    occlusionOk = true
    materialOk = true
    finalVerdict = 'approved'
  }

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

  const verdictLabel: Record<string, string> = {
    approved: 'Aprovada',
    refused: 'Recusada',
  }

  const verdictColor: Record<string, string> = {
    approved: 'bg-green-100 text-green-800',
    refused: 'bg-red-100 text-red-800',
  }

  const resultLabel: Record<string, string> = {
    great: 'Ótimo',
    reasonable: 'Razoável',
    difficulties: 'Com dificuldades',
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-lg font-semibold text-gray-900">Qualidade Pós-Entrega</h1>
    <p class="text-sm text-gray-500">
      Conformidade · Aprovação da coordenação · Ligação de satisfação
    </p>
  </header>

  <div class="mx-auto max-w-3xl space-y-8 p-6">

    <!-- Feedback global -->
    {#if form?.message}
      <div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {form.message}
      </div>
    {:else if form?.success}
      <div class="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        Registrado com sucesso.
      </div>
    {/if}

    <!-- ─── Seção 1: Avaliação de conformidade (dentista/coordenador) ─── -->
    {#if data.canAssessConformity}
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Aguardando avaliação de conformidade</h2>
            <p class="text-sm text-gray-500">
              4ª consultas realizadas onde o dentista ainda não registrou o parecer
            </p>
          </div>
          <span class="rounded-full bg-orange-100 px-2.5 py-1 text-sm font-medium text-orange-800">
            {data.awaitingConformity.length}
          </span>
        </div>

        {#if data.awaitingConformity.length === 0}
          <div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
            <p class="text-sm text-gray-400">Nenhuma avaliação pendente.</p>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {#each data.awaitingConformity as item (item.appointmentId)}
              <li class="px-5 py-4">
                <!-- Linha principal -->
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <a
                        href="/fila/{item.referralId}"
                        class="font-medium text-gray-900 hover:underline"
                      >
                        {item.patientName}
                      </a>
                      <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Entrega definitiva
                      </span>
                    </div>
                    <p class="mt-0.5 text-sm text-gray-500">
                      {item.unitName}
                      {#if item.attendedAt}
                        · realizada em {fmtDateTime(item.attendedAt)}
                      {/if}
                    </p>
                  </div>
                  <button
                    type="button"
                    onclick={() =>
                      expandedConformity === item.appointmentId
                        ? (expandedConformity = null)
                        : openConformity(item.appointmentId)}
                    class="shrink-0 rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                  >
                    {expandedConformity === item.appointmentId ? 'Cancelar' : 'Avaliar'}
                  </button>
                </div>

                <!-- Formulário expandido -->
                {#if expandedConformity === item.appointmentId}
                  <form
                    method="POST"
                    action="?/assess_conformity"
                    use:enhance
                    class="mt-4 space-y-4 rounded-lg border border-orange-100 bg-orange-50 p-4"
                  >
                    <input type="hidden" name="appointmentId" value={item.appointmentId} />
                    <input type="hidden" name="referralId" value={item.referralId} />

                    <!-- Adaptação -->
                    <fieldset class="space-y-1">
                      <legend class="text-sm font-medium text-gray-800">Adaptação</legend>
                      <div class="flex gap-4">
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="adaptationOk"
                            value="true"
                            checked={adaptationOk}
                            onchange={() => (adaptationOk = true)}
                          />
                          Conforme
                        </label>
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="adaptationOk"
                            value="false"
                            checked={!adaptationOk}
                            onchange={() => (adaptationOk = false)}
                          />
                          Não conforme
                        </label>
                      </div>
                      {#if !adaptationOk}
                        <textarea
                          name="adaptationNotes"
                          rows="2"
                          placeholder="Descreva o problema de adaptação..."
                          required
                          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                        ></textarea>
                      {/if}
                    </fieldset>

                    <!-- Oclusão -->
                    <fieldset class="space-y-1">
                      <legend class="text-sm font-medium text-gray-800">Oclusão</legend>
                      <div class="flex gap-4">
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="occlusionOk"
                            value="true"
                            checked={occlusionOk}
                            onchange={() => (occlusionOk = true)}
                          />
                          Conforme
                        </label>
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="occlusionOk"
                            value="false"
                            checked={!occlusionOk}
                            onchange={() => (occlusionOk = false)}
                          />
                          Não conforme
                        </label>
                      </div>
                      {#if !occlusionOk}
                        <textarea
                          name="occlusionNotes"
                          rows="2"
                          placeholder="Descreva o problema de oclusão..."
                          required
                          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                        ></textarea>
                      {/if}
                    </fieldset>

                    <!-- Material -->
                    <fieldset class="space-y-1">
                      <legend class="text-sm font-medium text-gray-800">Material</legend>
                      <div class="flex gap-4">
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="materialOk"
                            value="true"
                            checked={materialOk}
                            onchange={() => (materialOk = true)}
                          />
                          Conforme
                        </label>
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="materialOk"
                            value="false"
                            checked={!materialOk}
                            onchange={() => (materialOk = false)}
                          />
                          Não conforme
                        </label>
                      </div>
                      {#if !materialOk}
                        <textarea
                          name="materialNotes"
                          rows="2"
                          placeholder="Descreva o problema de material..."
                          required
                          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                        ></textarea>
                      {/if}
                    </fieldset>

                    <!-- Parecer final -->
                    <fieldset class="space-y-1">
                      <legend class="text-sm font-medium text-gray-800">Parecer final</legend>
                      <div class="flex gap-4">
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="finalVerdict"
                            value="approved"
                            checked={finalVerdict === 'approved'}
                            onchange={() => (finalVerdict = 'approved')}
                          />
                          Aprovada
                        </label>
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="finalVerdict"
                            value="refused"
                            checked={finalVerdict === 'refused'}
                            onchange={() => (finalVerdict = 'refused')}
                          />
                          Recusada (retorna para ajuste)
                        </label>
                      </div>
                      {#if finalVerdict === 'refused'}
                        <textarea
                          name="refusalReason"
                          rows="2"
                          placeholder="Motivo da recusa (obrigatório)..."
                          required
                          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-red-400 focus:outline-none"
                        ></textarea>
                      {/if}
                    </fieldset>

                    <div class="flex justify-end">
                      <button
                        type="submit"
                        class="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                      >
                        Registrar avaliação
                      </button>
                    </div>
                  </form>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ─── Seção 2: Aprovação da coordenação (apenas coordenador) ─── -->
    {#if data.canApprove}
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Aguardando aprovação da coordenação</h2>
            <p class="text-sm text-gray-500">
              Conformidade avaliada — registre o número da NF para liberar o pagamento
            </p>
          </div>
          <span class="rounded-full bg-purple-100 px-2.5 py-1 text-sm font-medium text-purple-800">
            {data.awaitingApproval.length}
          </span>
        </div>

        {#if data.awaitingApproval.length === 0}
          <div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
            <p class="text-sm text-gray-400">Nenhuma aprovação pendente.</p>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {#each data.awaitingApproval as item (item.conformityId)}
              <li class="flex items-center justify-between gap-4 px-5 py-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <a
                      href="/fila/{item.referralId}"
                      class="font-medium text-gray-900 hover:underline"
                    >
                      {item.patientName}
                    </a>
                    <span
                      class="rounded px-2 py-0.5 text-xs font-medium {verdictColor[item.finalVerdict]}"
                    >
                      {verdictLabel[item.finalVerdict]}
                    </span>
                  </div>
                  <p class="mt-0.5 text-sm text-gray-500">
                    {item.unitName} · avaliada em {fmtDateTime(item.assessedAt)}
                  </p>
                </div>
                <!-- Formulário inline com NF -->
                <form
                  method="POST"
                  action="?/approve_coordination"
                  use:enhance
                  class="flex shrink-0 items-center gap-2"
                >
                  <input type="hidden" name="referralId" value={item.referralId} />
                  <input
                    type="text"
                    name="invoiceNumber"
                    placeholder="NF ex: NF-2024-001"
                    required
                    maxlength="50"
                    class="w-36 rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-purple-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    class="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    Aprovar
                  </button>
                </form>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ─── Seção 3: Ligação de satisfação (atendente/coordenador) ─── -->
    {#if data.canCallSatisfaction}
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Aguardando ligação de satisfação</h2>
            <p class="text-sm text-gray-500">
              Prótese aprovada e NF registrada — ligar para o paciente (30–60 dias após a entrega)
            </p>
          </div>
          <span class="rounded-full bg-teal-100 px-2.5 py-1 text-sm font-medium text-teal-800">
            {data.awaitingSatisfaction.length}
          </span>
        </div>

        {#if data.awaitingSatisfaction.length === 0}
          <div class="rounded-lg border border-gray-200 bg-white px-5 py-8 text-center">
            <p class="text-sm text-gray-400">Nenhuma ligação pendente.</p>
          </div>
        {:else}
          <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {#each data.awaitingSatisfaction as item (item.approvalId)}
              <li class="px-5 py-4">
                <!-- Linha principal -->
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0">
                    <a
                      href="/fila/{item.referralId}"
                      class="font-medium text-gray-900 hover:underline"
                    >
                      {item.patientName}
                    </a>
                    <p class="mt-0.5 text-sm text-gray-500">
                      {item.unitName} · tel: {item.patientPhone}
                    </p>
                    <p class="mt-0.5 text-xs text-gray-400">
                      Aprovado em {fmtDateTime(item.approvedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onclick={() =>
                      expandedSatisfaction === item.approvalId
                        ? (expandedSatisfaction = null)
                        : (expandedSatisfaction = item.approvalId)}
                    class="shrink-0 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    {expandedSatisfaction === item.approvalId ? 'Cancelar' : 'Registrar ligação'}
                  </button>
                </div>

                <!-- Formulário expandido -->
                {#if expandedSatisfaction === item.approvalId}
                  <form
                    method="POST"
                    action="?/register_satisfaction_call"
                    use:enhance
                    class="mt-4 space-y-4 rounded-lg border border-teal-100 bg-teal-50 p-4"
                  >
                    <input type="hidden" name="referralId" value={item.referralId} />

                    <!-- Resultado -->
                    <fieldset class="space-y-2">
                      <legend class="text-sm font-medium text-gray-800">Como o paciente está?</legend>
                      <label class="flex items-center gap-2 text-sm">
                        <input type="radio" name="result" value="great" required />
                        Ótimo — se adaptou bem
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input type="radio" name="result" value="reasonable" />
                        Razoável — ainda se acostumando
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input type="radio" name="result" value="difficulties" />
                        Com dificuldades — precisa de retorno à unidade
                      </label>
                    </fieldset>

                    <!-- Precisa de consulta na unidade -->
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="needsUnitAppointment" value="true" />
                      Marcar pendência de consulta na unidade
                    </label>

                    <!-- Observações -->
                    <div>
                      <label class="block text-sm font-medium text-gray-800">
                        Observações (opcional)
                      </label>
                      <textarea
                        name="notes"
                        rows="2"
                        placeholder="Informações relevantes da ligação..."
                        class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-teal-400 focus:outline-none"
                      ></textarea>
                    </div>

                    <div class="flex justify-end">
                      <button
                        type="submit"
                        class="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                      >
                        Registrar ligação
                      </button>
                    </div>
                  </form>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <!-- ─── Seção 4: Pendências de consulta na unidade ─── -->
    {#if data.canCallSatisfaction && data.pendingUnitAppointments.length > 0}
      <section>
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Consultas na unidade pendentes</h2>
            <p class="text-sm text-gray-500">
              Pacientes que precisam de retorno à unidade — marque quando o agendamento for feito
            </p>
          </div>
          <span class="rounded-full bg-red-100 px-2.5 py-1 text-sm font-medium text-red-800">
            {data.pendingUnitAppointments.length}
          </span>
        </div>

        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {#each data.pendingUnitAppointments as item (item.satisfactionCallId)}
            <li class="flex items-center justify-between gap-4 px-5 py-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <a
                    href="/fila/{item.referralId}"
                    class="font-medium text-gray-900 hover:underline"
                  >
                    {item.patientName}
                  </a>
                  <span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {resultLabel[item.result]}
                  </span>
                </div>
                <p class="mt-0.5 text-sm text-gray-500">
                  {item.unitName} · tel: {item.patientPhone}
                </p>
                <p class="mt-0.5 text-xs text-gray-400">
                  Ligação em {fmtDateTime(item.calledAt)}
                </p>
              </div>
              <form method="POST" action="?/resolve_unit_appointment" use:enhance class="shrink-0">
                <input type="hidden" name="satisfactionCallId" value={item.satisfactionCallId} />
                <button
                  type="submit"
                  class="rounded-md bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
                >
                  Consulta agendada
                </button>
              </form>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Estado vazio: role sem acesso a nenhuma seção -->
    {#if !data.canAssessConformity && !data.canApprove && !data.canCallSatisfaction}
      <div class="rounded-lg border border-gray-200 bg-white px-5 py-12 text-center">
        <p class="text-sm text-gray-400">Sem permissão para visualizar esta área.</p>
      </div>
    {/if}

  </div>
</div>
