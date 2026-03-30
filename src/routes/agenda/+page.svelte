<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let showForm = $state(false)

  // Fecha o formulário após criação bem-sucedida
  $effect(() => {
    if (form && 'success' in form && form.success) showForm = false
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
          {#if data.isCoordinator}
            <th class="px-4 py-3"></th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#each data.schedules as schedule (schedule.id)}
          <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">{formatDate(schedule.scheduledDate)}</td>
            <td class="px-4 py-3 text-gray-700">{schedule.unitName}</td>
            <td class="px-4 py-3 text-gray-600">
              {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}
            </td>
            {#if data.isCoordinator}
              <td class="px-4 py-3 text-right">
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
              </td>
            {/if}
          </tr>
        {:else}
          <tr>
            <td
              colspan={data.isCoordinator ? 4 : 3}
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
