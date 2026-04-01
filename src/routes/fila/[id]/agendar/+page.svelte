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

  const apptLabel: Record<number, string> = {
    1: 'Escaneamento',
    2: '1º Ajuste',
    3: '2º Ajuste',
    4: 'Entrega',
  }

  // Agenda selecionada — controla quais slots são exibidos
  let selectedScheduleId = $state<string>('')

  let selectedSchedule = $derived(
    data.schedules.find((s) => s.id === parseInt(selectedScheduleId))
  )

  // Slot selecionado (startTime + duration)
  let selectedSlotTime = $state<string>('')
  let selectedSlotDuration = $state<number>(0)

  // Reseta slot ao trocar de agenda
  $effect(() => {
    if (selectedScheduleId) {
      selectedSlotTime = ''
      selectedSlotDuration = 0
    }
  })

  // Duração esperada para ESTE paciente: usa estimativa anterior ou padrão da agenda
  let patientDuration = $derived(
    data.prevDurationEstimate ?? selectedSchedule?.defaultDuration ?? 60
  )

  function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  function fmtTime(t: string): string {
    return t.substring(0, 5)
  }

  // Verifica se o paciente cabe no slot disponível:
  // Um slot de 30min só aceita paciente de 30min
  // Um slot de 60min aceita qualquer duração
  function slotAcceptsPatient(slotDuration: number): boolean {
    return patientDuration <= slotDuration
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
        ← Voltar para detalhes
      </a>
      <div class="h-5 w-px bg-gray-200"></div>
      <div>
        <h1 class="text-lg font-semibold text-gray-900">Agendar consulta</h1>
        <p class="text-sm text-gray-500">{data.patientName} — {data.unitName}</p>
      </div>
    </div>
  </header>

  <div class="mx-auto max-w-lg p-6">

    <!-- Número da consulta (informativo) -->
    <div class="mb-6 space-y-1.5 rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
      <p class="text-sm text-blue-700">
        Esta será a <strong>consulta nº {data.nextAppointmentNumber}</strong>
        {#if appointmentLabel[data.nextAppointmentNumber]}
          — <strong>{appointmentLabel[data.nextAppointmentNumber]}</strong>
        {/if}
      </p>
      {#if data.prevDurationEstimate}
        <p class="text-sm text-indigo-700">
          O protético estimou <strong>
            {data.prevDurationEstimate === 60 ? '1 hora' : '30 minutos'}
          </strong> para confecção desta peça — apenas slots compatíveis estão disponíveis.
        </p>
      {/if}
    </div>

    <!-- Erro do servidor -->
    {#if form?.message}
      <div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {form.message}
      </div>
    {/if}

    {#if data.schedules.length === 0}
      <div class="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center">
        <p class="text-sm font-medium text-gray-600">Nenhuma agenda do terceirizado disponível</p>
        <p class="mt-1 text-sm text-gray-400">
          O coordenador precisa cadastrar as visitas do protético antes de agendar consultas.
        </p>
      </div>
    {:else}
      <form method="POST" use:enhance class="space-y-5 rounded-lg border border-gray-200 bg-white px-6 py-6">

        <!-- Inputs ocultos — preenchidos ao selecionar um slot -->
        <input type="hidden" name="scheduleId" value={selectedScheduleId} />
        <input type="hidden" name="scheduledTime" value={selectedSlotTime} />
        <input type="hidden" name="scheduledDuration" value={selectedSlotDuration} />

        <!-- Seleção de data e unidade -->
        <div>
          <label for="scheduleId" class="block text-sm font-medium text-gray-700">
            Data e local da visita do protético <span class="text-red-500">*</span>
          </label>
          <select
            id="scheduleId"
            required
            bind:value={selectedScheduleId}
            class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="" disabled selected>Selecione uma data disponível</option>
            {#each data.schedules as s (s.id)}
              <option value={s.id}>
                {fmtDate(s.scheduledDate)} — {s.unitName}
                ({fmtTime(s.startTime)}–{fmtTime(s.endTime)})
              </option>
            {/each}
          </select>
        </div>

        <!-- Grid de slots — aparece ao selecionar uma data -->
        {#if selectedSchedule}
          <div>
            <p class="mb-2 text-sm font-medium text-gray-700">
              Horário <span class="text-red-500">*</span>
            </p>
            <p class="mb-3 text-xs text-gray-400">
              Janela: {fmtTime(selectedSchedule.startTime)}–{fmtTime(selectedSchedule.endTime)}
              {#if selectedSchedule.lunchStart && selectedSchedule.lunchEnd}
                · Almoço: {fmtTime(selectedSchedule.lunchStart)}–{fmtTime(selectedSchedule.lunchEnd)}
              {/if}
            </p>

            {#if selectedSchedule.slots.length === 0}
              <p class="text-sm text-gray-400">Nenhum slot gerado para esta agenda.</p>
            {:else}
              <div class="space-y-1.5">
                {#each selectedSchedule.slots as slot}
                  {@const isOccupied = slot.status === 'occupied'}
                  {@const compatible = !isOccupied && slotAcceptsPatient(slot.duration)}
                  {@const isSelected = selectedSlotTime === slot.startTime && selectedSlotDuration === slot.duration}

                  {#if isOccupied}
                    <!-- Slot ocupado — não clicável -->
                    <div class="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 opacity-60">
                      <div class="flex items-center gap-3">
                        <span class="w-12 font-mono text-sm text-gray-400">{slot.startTime}</span>
                        <span class="text-sm text-gray-400">
                          {slot.patientName}
                          <span class="ml-1 text-xs text-gray-300">
                            ({apptLabel[slot.appointmentNumber ?? 0] ?? `Consulta ${slot.appointmentNumber}`})
                          </span>
                        </span>
                      </div>
                      <span class="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500">
                        {slot.duration}min
                      </span>
                    </div>
                  {:else if compatible}
                    <!-- Slot disponível e compatível — clicável -->
                    <button
                      type="button"
                      onclick={() => {
                        selectedSlotTime = slot.startTime
                        selectedSlotDuration = slot.duration
                      }}
                      class="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors {isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'}"
                    >
                      <div class="flex items-center gap-3">
                        <span class="w-12 font-mono text-sm {isSelected ? 'text-blue-700 font-semibold' : 'text-gray-700'}">
                          {slot.startTime}
                        </span>
                        <span class="text-sm {isSelected ? 'text-blue-700' : 'text-gray-500'}">
                          até {slot.endTime}
                        </span>
                      </div>
                      <span class="rounded px-1.5 py-0.5 text-xs {isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}">
                        {slot.duration}min
                      </span>
                    </button>
                  {:else}
                    <!-- Slot livre mas incompatível (30min disponível, paciente precisa de 1h) -->
                    <div
                      class="flex items-center justify-between rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-2"
                      title="Slot de {slot.duration}min — incompatível com consulta de {patientDuration}min"
                    >
                      <div class="flex items-center gap-3">
                        <span class="w-12 font-mono text-sm text-gray-300">{slot.startTime}</span>
                        <span class="text-xs text-gray-300">Disponível — incompatível com esta consulta</span>
                      </div>
                      <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-300">
                        {slot.duration}min
                      </span>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Botões -->
        <div class="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <a
            href="/fila/{data.referralId}"
            class="rounded-md px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Cancelar
          </a>
          <button
            type="submit"
            disabled={!selectedSlotTime}
            class="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
          >
            Confirmar agendamento
          </button>
        </div>

      </form>
    {/if}
  </div>
</div>
