<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { formatQueueTime } from '$lib/utils'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  const canSchedule =
    (data.user?.role === 'attendant' || data.user?.role === 'coordinator') &&
    data.referral.status === 'active'

  // Controla exibição do formulário de edição de dados do paciente
  let editingPatient = $state(false)
  // Controla exibição do formulário de edição do encaminhamento
  let editingReferral = $state(false)
  // Status selecionado no formulário de edição do encaminhamento (para mostrar campo motivo)
  let editReferralStatus = $state(data.referral.status)

  // Controla qual consulta está sendo editada (id da consulta ou null)
  let editingAppointmentId = $state<number | null>(null)
  // Agenda selecionada no formulário de edição de consulta
  let selectedEditScheduleId = $state<string>('')

  let selectedEditSchedule = $derived(
    data.schedules.find((s) => s.id === parseInt(selectedEditScheduleId))
  )

  // Abre o formulário de edição pré-selecionando a agenda atual da consulta
  function openEditForm(appt: { id: number; scheduledDate: string; healthUnitId: number }) {
    if (editingAppointmentId === appt.id) {
      editingAppointmentId = null
      return
    }
    editingAppointmentId = appt.id
    const match = data.schedules.find(
      (s) => s.scheduledDate === appt.scheduledDate && s.unitId === appt.healthUnitId
    )
    selectedEditScheduleId = match ? String(match.id) : ''
  }

  // Fecha os formulários após salvar com sucesso
  $effect(() => {
    if (form && 'updateSuccess' in form && form.updateSuccess) editingPatient = false
  })
  $effect(() => {
    if (form && 'referralUpdated' in form && form.referralUpdated) editingReferral = false
  })
  $effect(() => {
    if (form && 'apptUpdated' in form && form.apptUpdated) editingAppointmentId = null
  })

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
      <div>
        <h1 class="text-lg font-semibold text-gray-900">{data.patient.fullName}</h1>
        <p class="text-sm text-gray-500">{data.referral.unitName}</p>
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
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Dados do paciente</h2>
        {#if data.canEditPatient}
          <button
            onclick={() => (editingPatient = !editingPatient)}
            class="text-xs text-blue-600 hover:text-blue-800"
          >
            {editingPatient ? 'Cancelar' : 'Editar dados'}
          </button>
        {/if}
      </div>

      {#if editingPatient}
        <!-- Formulário de edição inline -->
        <form
          method="POST"
          action="?/update_patient"
          use:enhance
          class="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4"
        >
          <div class="col-span-2 sm:col-span-2">
            <label for="fullName" class="text-xs text-gray-500">Nome completo</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={data.patient.fullName}
              class="mt-0.5 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label for="cpf" class="text-xs text-gray-500">CPF</label>
            <p class="mt-0.5 font-mono text-sm text-gray-400">{maskCpf(data.patient.cpf)}</p>
          </div>
          <div>
            <label for="birthDate" class="text-xs text-gray-500">Data de nascimento</label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              value={data.patient.birthDate}
              class="mt-0.5 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div>
            <label for="phone" class="text-xs text-gray-500">Telefone</label>
            <input
              id="phone"
              name="phone"
              type="text"
              required
              value={data.patient.phone}
              class="mt-0.5 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            />
          </div>
          <div class="col-span-2 sm:col-span-2">
            <label for="healthUnitId" class="text-xs text-gray-500">Unidade de saúde responsável</label>
            <select
              id="healthUnitId"
              name="healthUnitId"
              required
              class="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            >
              {#each data.units as unit (unit.id)}
                <option value={unit.id} selected={unit.id === data.patient.healthUnitId}>
                  {unit.name}
                </option>
              {/each}
            </select>
          </div>
          <div class="col-span-2 flex items-center gap-3 sm:col-span-4">
            <button
              type="submit"
              class="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Salvar alterações
            </button>
            {#if form && 'error' in form && form.error}
              <p class="text-sm text-red-600">{form.error}</p>
            {/if}
          </div>
        </form>
      {:else}
        <!-- Visualização normal -->
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
      {/if}
    </section>

    <!-- Dados do encaminhamento -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Encaminhamento</h2>
        {#if data.canEditReferral}
          <button
            onclick={() => (editingReferral = !editingReferral)}
            class="text-xs text-blue-600 hover:text-blue-800"
          >
            {editingReferral ? 'Cancelar' : 'Editar'}
          </button>
        {/if}
      </div>

      {#if editingReferral}
        <form
          method="POST"
          action="?/update_referral"
          use:enhance
          class="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-4"
        >
          <!-- Status -->
          <div class="col-span-2">
            <label for="refStatus" class="text-xs text-gray-500">Status</label>
            <select
              id="refStatus"
              name="status"
              required
              bind:value={editReferralStatus}
              class="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            >
              <option value="active">Ativo</option>
              <option value="pending_reassessment">Aguardando reavaliação</option>
              <option value="suspended">Suspenso</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <!-- Motivo de inativação — aparece só quando status = inactive -->
          {#if editReferralStatus === 'inactive'}
            <div class="col-span-2">
              <label for="inactivationReason" class="text-xs text-gray-500">Motivo de inativação</label>
              <select
                id="inactivationReason"
                name="inactivationReason"
                required
                class="mt-0.5 w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
              >
                <option value="" disabled selected={!data.referral.inactivationReason}>Selecione...</option>
                <option value="dropout" selected={data.referral.inactivationReason === 'dropout'}>Desistência</option>
                <option value="death" selected={data.referral.inactivationReason === 'death'}>Óbito</option>
                <option value="cancellation" selected={data.referral.inactivationReason === 'cancellation'}>Cancelamento administrativo</option>
              </select>
            </div>
          {/if}

          <!-- Data de entrada -->
          <div>
            <label for="introductionDate" class="text-xs text-gray-500">Data de entrada</label>
            <input
              id="introductionDate"
              name="introductionDate"
              type="date"
              required
              value={data.referral.introductionDate}
              class="mt-0.5 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <!-- Número de OS -->
          <div>
            <label for="serviceOrderNumber" class="text-xs text-gray-500">Número de OS</label>
            <input
              id="serviceOrderNumber"
              name="serviceOrderNumber"
              type="text"
              value={data.referral.serviceOrderNumber ?? ''}
              class="mt-0.5 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-400 focus:outline-none"
            />
          </div>

          <!-- Flags de prioridade — checkbox presente no POST = true, ausente = false -->
          <div class="col-span-2 flex flex-wrap gap-4">
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="hasOmbudsmanFlag"
                value="on"
                checked={data.referral.hasOmbudsmanFlag}
                class="rounded border-gray-300"
              />
              Ouvidoria
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="hasAccidentFlag"
                value="on"
                checked={data.referral.hasAccidentFlag}
                class="rounded border-gray-300"
              />
              Acidente de trabalho
            </label>
          </div>

          <!-- Tipos de prótese -->
          <div class="col-span-2 sm:col-span-4">
            <p class="text-xs text-gray-500">Tipo(s) de prótese</p>
            <div class="mt-1 flex flex-wrap gap-3">
              {#each data.allProsthesisTypes as type (type.id)}
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="prosthesisTypeIds"
                    value={type.id}
                    checked={data.referral.prosthesisTypeIds.includes(type.id)}
                    class="rounded border-gray-300"
                  />
                  {type.name}
                </label>
              {/each}
            </div>
          </div>

          <div class="col-span-2 flex items-center gap-3 sm:col-span-4">
            <button
              type="submit"
              class="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            >
              Salvar alterações
            </button>
            {#if form && 'referralError' in form && form.referralError}
              <p class="text-sm text-red-600">{form.referralError}</p>
            {/if}
          </div>
        </form>
      {:else}
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
      {/if}
    </section>

    <!-- Consultas -->
    <section class="rounded-lg border border-gray-200 bg-white">
      <div class="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Consultas ({data.appointments.length})
        </h2>
        {#if canSchedule}
          <a
            href="/fila/{data.referral.id}/agendar"
            class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            + Agendar consulta
          </a>
        {/if}
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
                  {#if appt.nextDurationEstimate && appt.outcome === 'attended'}
                    <p class="mt-1 text-xs text-indigo-700">
                      Previsão para próxima consulta: <strong>{appt.nextDurationEstimate === 60 ? '1 hora' : '30 min'}</strong>
                    </p>
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
                    {#if data.canEditAppointment}
                      <button
                        onclick={() => openEditForm(appt)}
                        class="text-xs text-blue-600 hover:text-blue-800"
                      >
                        {editingAppointmentId === appt.id ? 'Cancelar edição' : 'Editar'}
                      </button>
                    {/if}
                  {/if}
                  {#if appt.prosthesisReadyAt}
                    <span class="text-xs text-gray-400">Prótese pronta: {fmtDateTime(appt.prosthesisReadyAt)}</span>
                  {/if}
                  {#if appt.prosthesisReceivedAt}
                    <span class="text-xs text-green-700">Recebida na unidade: {fmtDateTime(appt.prosthesisReceivedAt)}</span>
                  {/if}
                </div>
              </div>

              <!-- Formulário de edição inline — visível apenas para a consulta selecionada -->
              {#if editingAppointmentId === appt.id}
                <form
                  method="POST"
                  action="?/update_appointment"
                  use:enhance
                  class="mt-4 space-y-4 border-t border-gray-100 pt-4"
                >
                  <input type="hidden" name="appointmentId" value={appt.id} />

                  <!-- Seleção de agenda (data + unidade) -->
                  <div>
                    <label for="editScheduleId-{appt.id}" class="block text-sm font-medium text-gray-700">
                      Data e local da visita do protético <span class="text-red-500">*</span>
                    </label>
                    {#if data.schedules.length === 0}
                      <p class="mt-1.5 text-sm text-gray-400">Nenhuma agenda cadastrada no momento.</p>
                    {:else}
                      <select
                        id="editScheduleId-{appt.id}"
                        name="scheduleId"
                        required
                        bind:value={selectedEditScheduleId}
                        class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
                      >
                        <option value="" disabled>Selecione uma data disponível</option>
                        {#each data.schedules as s (s.id)}
                          <option value={s.id}>
                            {fmtDate(s.scheduledDate)} — {s.unitName}
                            ({fmtTime(s.startTime)}–{fmtTime(s.endTime)})
                          </option>
                        {/each}
                      </select>
                    {/if}
                  </div>

                  <!-- Horário -->
                  <div>
                    <label for="editTime-{appt.id}" class="block text-sm font-medium text-gray-700">
                      Horário <span class="text-red-500">*</span>
                    </label>
                    {#if selectedEditSchedule}
                      <p class="mt-0.5 text-xs text-gray-500">
                        Janela disponível: {fmtTime(selectedEditSchedule.startTime)} às {fmtTime(selectedEditSchedule.endTime)}
                      </p>
                    {/if}
                    <input
                      id="editTime-{appt.id}"
                      name="scheduledTime"
                      type="time"
                      required
                      value={appt.scheduledTime.substring(0, 5)}
                      min={selectedEditSchedule?.startTime.slice(0, 5)}
                      max={selectedEditSchedule?.endTime.slice(0, 5)}
                      disabled={!selectedEditScheduleId}
                      class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>

                  <!-- Erro -->
                  {#if form && 'apptError' in form && form.apptError}
                    <p class="text-sm text-red-600">{form.apptError}</p>
                  {/if}

                  <!-- Ações -->
                  <div class="flex items-center gap-3">
                    <button
                      type="submit"
                      class="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
                    >
                      Salvar alterações
                    </button>
                    <button
                      type="button"
                      onclick={() => (editingAppointmentId = null)}
                      class="rounded-md px-4 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              {/if}
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
