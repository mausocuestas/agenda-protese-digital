<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let showForm = $state(false)
  // ID da visita cujo painel de gestão está aberto (null = nenhum)
  let managingScheduleId = $state<number | null>(null)
  // ID do slot sendo editado no painel
  let editingSlotId = $state<number | null>(null)
  // ID da visita sendo editada (data/horário)
  let editingScheduleId = $state<number | null>(null)

  // Fecha formulário de criação após sucesso
  $effect(() => {
    if (form && 'success' in form && form.success) showForm = false
  })

  // Fecha edição de visita após salvar com sucesso
  $effect(() => {
    if (form && 'editSuccess' in form && form.editSuccess) editingScheduleId = null
  })

  // Fecha edição de slot após salvar
  $effect(() => {
    if (form && 'slotEdited' in form && form.slotEdited) editingSlotId = null
  })

  // "2026-04-15" → "15/04/2026"
  function formatDate(d: string) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  // "08:00:00" → "08:00"
  function formatTime(t: string) {
    return t.slice(0, 5)
  }

  // Rótulo da consulta pelo número sequencial
  const apptLabel: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega',
  }

  // Classe de badge pelo desfecho registrado
  const outcomeClass: Record<string, string> = {
    attended: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    refused: 'bg-orange-100 text-orange-700',
  }

  const outcomeLabel: Record<string, string> = {
    attended: 'Compareceu',
    absent: 'Faltou',
    refused: 'Recusado',
  }

  function toggleManage(id: number) {
    managingScheduleId = managingScheduleId === id ? null : id
    editingSlotId = null
    editingScheduleId = null
  }
</script>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Agenda do Protético</h1>
        <p class="text-sm text-gray-500">Visitas do terceirizado às unidades de saúde</p>
      </div>
      {#if data.isCoordinator}
        <button
          onclick={() => (showForm = !showForm)}
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : '+ Nova visita'}
        </button>
      {/if}
    </div>
  </header>

  <!-- Formulário de criação — apenas coordenador -->
  {#if data.isCoordinator && showForm}
    <div class="border-b border-gray-200 bg-white px-6 py-4">
      <form
        method="POST"
        action="?/create"
        use:enhance={({ formElement }) =>
          async ({ update }) => {
            await update()
            formElement.reset()
          }}
        class="flex flex-wrap items-end gap-4"
      >
        <div class="flex flex-col gap-1">
          <label for="unit" class="text-xs font-medium text-gray-600">Unidade de saúde</label>
          <select
            id="unit"
            name="healthUnitId"
            required
            class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <option value="">Selecione...</option>
            {#each data.units as unit (unit.id)}
              <option value={unit.id}>{unit.name}</option>
            {/each}
          </select>
        </div>

        <div class="flex flex-col gap-1">
          <label for="scheduledDate" class="text-xs font-medium text-gray-600">Data</label>
          <input
            id="scheduledDate"
            name="scheduledDate"
            type="date"
            required
            class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="startTime" class="text-xs font-medium text-gray-600">Início</label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            required
            class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label for="endTime" class="text-xs font-medium text-gray-600">Término</label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            required
            class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Salvar
        </button>

        {#if form && 'error' in form && form.error}
          <p class="text-sm text-red-600">{form.error}</p>
        {/if}
      </form>
    </div>
  {/if}

  <!-- Tabela de visitas -->
  <div class="overflow-x-auto">
    <table class="w-full border-collapse bg-white text-sm">
      <thead>
        <tr
          class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          <th class="px-4 py-3">Data</th>
          <th class="px-4 py-3">Unidade</th>
          <th class="px-4 py-3">Horário</th>
          {#if data.canSeePatients}
            <th class="px-4 py-3">Pacientes agendados</th>
          {/if}
          {#if data.isCoordinator}
            <th class="px-4 py-3"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each data.schedules as schedule (schedule.id)}
          <!-- Linha principal da visita -->
          <tr
            class="border-b border-gray-100 align-top {managingScheduleId === schedule.id ? 'bg-blue-50' : 'hover:bg-gray-50'}"
          >
            <!-- Data clicável para abrir painel de gestão -->
            <td class="px-4 py-3">
              {#if data.canManageSlots}
                <button
                  onclick={() => toggleManage(schedule.id)}
                  class="font-medium text-blue-600 underline-offset-2 hover:underline"
                  title="Clique para gerenciar pacientes desta visita"
                >
                  {formatDate(schedule.scheduledDate)}
                </button>
              {:else}
                <span class="font-medium text-gray-900">{formatDate(schedule.scheduledDate)}</span>
              {/if}
            </td>
            <td class="px-4 py-3 text-gray-700">{schedule.unitName}</td>
            <td class="px-4 py-3 text-gray-600">
              {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
            </td>

            {#if data.canSeePatients}
              <td class="px-4 py-3">
                {#if schedule.slots.length === 0}
                  <span class="text-xs text-gray-400">Nenhum paciente agendado</span>
                {:else}
                  <ul class="space-y-1">
                    {#each schedule.slots as slot}
                      <li class="flex flex-wrap items-center gap-2 text-sm">
                        <span class="w-10 shrink-0 font-mono text-xs text-gray-500">{formatTime(slot.scheduledTime)}</span>
                        <span class="text-gray-800">{slot.patientName}</span>
                        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                          {apptLabel[slot.appointmentNumber] ?? `Consulta ${slot.appointmentNumber}`}
                        </span>
                        {#if slot.outcome}
                          <span class="rounded px-1.5 py-0.5 text-xs font-medium {outcomeClass[slot.outcome] ?? ''}">
                            {outcomeLabel[slot.outcome] ?? slot.outcome}
                          </span>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                {/if}
              </td>
            {/if}

            {#if data.isCoordinator}
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-3">
                  <!-- Botão editar data/horário da visita -->
                  <button
                    onclick={() => {
                      editingScheduleId = editingScheduleId === schedule.id ? null : schedule.id
                      managingScheduleId = null
                    }}
                    class="text-xs text-gray-400 transition-colors hover:text-gray-700"
                  >
                    {editingScheduleId === schedule.id ? 'Cancelar' : 'Editar visita'}
                  </button>
                  <!-- Botão remover visita -->
                  <form method="POST" action="?/delete" use:enhance>
                    <input type="hidden" name="id" value={schedule.id} />
                    <button
                      type="submit"
                      class="text-xs text-red-500 transition-colors hover:text-red-700"
                      onclick={(e) => {
                        if (!confirm('Remover essa visita?')) e.preventDefault()
                      }}
                    >
                      Remover
                    </button>
                  </form>
                </div>
              </td>
            {/if}
          </tr>

          <!-- Painel de gestão de pacientes — abre ao clicar na data -->
          {#if data.canManageSlots && managingScheduleId === schedule.id}
            <tr class="border-b border-blue-200 bg-blue-50">
              <td
                colspan={data.isCoordinator
                  ? data.canSeePatients ? 5 : 4
                  : data.canSeePatients ? 4 : 3}
                class="px-6 py-4"
              >
                <div class="space-y-4">

                  <!-- Slots existentes com ações de edição e remoção -->
                  {#if schedule.slots.length > 0}
                    <div>
                      <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Pacientes agendados
                      </p>
                      <ul class="space-y-2">
                        {#each schedule.slots as slot}
                          <li class="rounded-md border border-gray-200 bg-white px-3 py-2">
                            {#if editingSlotId === slot.id}
                              <!-- Edição de horário inline -->
                              <form
                                method="POST"
                                action="?/edit_appointment"
                                use:enhance
                                class="flex flex-wrap items-center gap-3"
                              >
                                <input type="hidden" name="id" value={slot.id} />
                                <span class="text-sm font-medium text-gray-800">{slot.patientName}</span>
                                <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                  {apptLabel[slot.appointmentNumber] ?? `Consulta ${slot.appointmentNumber}`}
                                </span>
                                <input
                                  name="scheduledTime"
                                  type="time"
                                  required
                                  value={formatTime(slot.scheduledTime)}
                                  class="rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  class="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onclick={() => (editingSlotId = null)}
                                  class="text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Cancelar
                                </button>
                              </form>
                            {:else}
                              <!-- Visualização do slot -->
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="w-10 shrink-0 font-mono text-xs text-gray-500">
                                  {formatTime(slot.scheduledTime)}
                                </span>
                                <span class="text-sm text-gray-800">{slot.patientName}</span>
                                <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                                  {apptLabel[slot.appointmentNumber] ?? `Consulta ${slot.appointmentNumber}`}
                                </span>
                                {#if slot.outcome}
                                  <span class="rounded px-1.5 py-0.5 text-xs font-medium {outcomeClass[slot.outcome] ?? ''}">
                                    {outcomeLabel[slot.outcome] ?? slot.outcome}
                                  </span>
                                {:else}
                                  <!-- Ações disponíveis apenas sem desfecho -->
                                  <div class="ml-auto flex items-center gap-3">
                                    <button
                                      onclick={() => (editingSlotId = slot.id)}
                                      class="text-xs text-blue-500 transition-colors hover:text-blue-700"
                                    >
                                      Alterar horário
                                    </button>
                                    <form
                                      method="POST"
                                      action="?/remove_appointment"
                                      use:enhance
                                      class="inline"
                                    >
                                      <input type="hidden" name="id" value={slot.id} />
                                      <button
                                        type="submit"
                                        class="text-xs text-red-400 transition-colors hover:text-red-600"
                                        onclick={(e) => {
                                          if (!confirm(`Desmarcar ${slot.patientName}?`)) e.preventDefault()
                                        }}
                                      >
                                        × Desmarcar
                                      </button>
                                    </form>
                                  </div>
                                {/if}
                              </div>
                            {/if}
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}

                  <!-- Formulário de adição de paciente -->
                  <div>
                    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Adicionar paciente
                    </p>
                    {#if schedule.eligible.length === 0}
                      <p class="text-xs text-gray-400">
                        Nenhum paciente ativo pendente de agendamento para esta unidade.
                      </p>
                    {:else}
                      <form
                        method="POST"
                        action="?/add_appointment"
                        use:enhance={({ formElement }) =>
                          async ({ update }) => {
                            await update()
                            formElement.reset()
                          }}
                        class="flex flex-wrap items-end gap-3"
                      >
                        <input type="hidden" name="scheduleId" value={schedule.id} />

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-gray-600">Paciente</label>
                          <select
                            name="referralId"
                            required
                            class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                          >
                            <option value="">Selecione...</option>
                            {#each schedule.eligible as er}
                              <option value={er.referralId}>
                                {er.patientName} — {apptLabel[er.nextApptNumber] ?? `Consulta ${er.nextApptNumber}`}
                              </option>
                            {/each}
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-gray-600">Horário</label>
                          <input
                            name="scheduledTime"
                            type="time"
                            required
                            min={formatTime(schedule.startTime)}
                            max={formatTime(schedule.endTime)}
                            class="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          Agendar
                        </button>

                        {#if form && 'slotError' in form && form.slotError}
                          <p class="text-sm text-red-600">{form.slotError}</p>
                        {/if}
                      </form>
                    {/if}
                  </div>

                </div>
              </td>
            </tr>
          {/if}

          <!-- Linha de edição de data/horário da visita -->
          {#if data.canEditSchedule && editingScheduleId === schedule.id}
            <tr class="border-b border-gray-200 bg-gray-50">
              <td colspan={data.canSeePatients ? 5 : 4} class="px-4 py-3">
                <form
                  method="POST"
                  action="?/edit_schedule"
                  use:enhance
                  class="flex flex-wrap items-end gap-4"
                >
                  <input type="hidden" name="id" value={schedule.id} />

                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-gray-600">Data</label>
                    <input
                      name="scheduledDate"
                      type="date"
                      required
                      value={schedule.scheduledDate}
                      class="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-gray-600">Início</label>
                    <input
                      name="startTime"
                      type="time"
                      required
                      value={formatTime(schedule.startTime)}
                      class="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div class="flex flex-col gap-1">
                    <label class="text-xs font-medium text-gray-600">Término</label>
                    <input
                      name="endTime"
                      type="time"
                      required
                      value={formatTime(schedule.endTime)}
                      class="rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Salvar
                  </button>

                  {#if form && 'error' in form && form.error}
                    <p class="text-sm text-red-600">{form.error}</p>
                  {/if}
                </form>
              </td>
            </tr>
          {/if}
        {:else}
          <tr>
            <td
              colspan={data.isCoordinator
                ? data.canSeePatients ? 5 : 4
                : data.canSeePatients ? 4 : 3}
              class="px-4 py-12 text-center text-sm text-gray-400"
            >
              Nenhuma visita cadastrada.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
