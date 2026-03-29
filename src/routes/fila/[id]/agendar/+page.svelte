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

  // Agenda selecionada — controla a janela de horário exibida
  let selectedScheduleId = $state<string>('')

  let selectedSchedule = $derived(
    data.schedules.find((s) => s.id === parseInt(selectedScheduleId))
  )

  function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  function fmtTime(t: string): string {
    return t.substring(0, 5)
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
    <div class="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
      <p class="text-sm text-blue-700">
        Esta será a <strong>consulta nº {data.nextAppointmentNumber}</strong>
        {#if appointmentLabel[data.nextAppointmentNumber]}
          — <strong>{appointmentLabel[data.nextAppointmentNumber]}</strong>
        {/if}
      </p>
    </div>

    <!-- Erro do servidor -->
    {#if form?.message}
      <div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {form.message}
      </div>
    {/if}

    {#if data.schedules.length === 0}
      <!-- Nenhuma agenda cadastrada -->
      <div class="rounded-lg border border-gray-200 bg-white px-6 py-10 text-center">
        <p class="text-sm font-medium text-gray-600">Nenhuma agenda do terceirizado disponível</p>
        <p class="mt-1 text-sm text-gray-400">
          O coordenador precisa cadastrar as visitas do protético antes de agendar consultas.
        </p>
      </div>
    {:else}
      <form method="POST" use:enhance class="space-y-5 rounded-lg border border-gray-200 bg-white px-6 py-6">

        <!-- Seleção de data e unidade (agenda do terceirizado) -->
        <div>
          <label for="scheduleId" class="block text-sm font-medium text-gray-700">
            Data e local da visita do protético <span class="text-red-500">*</span>
          </label>
          <select
            id="scheduleId"
            name="scheduleId"
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

        <!-- Horário -->
        <div>
          <label for="scheduledTime" class="block text-sm font-medium text-gray-700">
            Horário <span class="text-red-500">*</span>
          </label>
          {#if selectedSchedule}
            <p class="mt-0.5 text-xs text-gray-500">
              Janela disponível: {fmtTime(selectedSchedule.startTime)} às {fmtTime(selectedSchedule.endTime)}
            </p>
          {/if}
          <input
            id="scheduledTime"
            name="scheduledTime"
            type="time"
            required
            min={selectedSchedule?.startTime.slice(0, 5)}
            max={selectedSchedule?.endTime.slice(0, 5)}
            disabled={!selectedScheduleId}
            class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

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
            class="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Confirmar agendamento
          </button>
        </div>

      </form>
    {/if}
  </div>
</div>
