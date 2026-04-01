<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let saved = $state(false)
  let editingTypeId = $state<number | null>(null)
  let showAddType = $state(false)

  // Exibe mensagem de sucesso por 3 segundos após salvar parâmetros
  $effect(() => {
    if (form && 'success' in form && form.success) {
      saved = true
      const timer = setTimeout(() => (saved = false), 3000)
      return () => clearTimeout(timer)
    }
  })

  // Fecha edição inline de tipo após salvar
  $effect(() => {
    if (form && 'typeEdited' in form && form.typeEdited) editingTypeId = null
  })

  // Fecha formulário de novo tipo após adicionar
  $effect(() => {
    if (form && 'typeAdded' in form && form.typeAdded) showAddType = false
  })

  // Controla qual unidade responsável está com o select de adição aberto
  let addingForUnit = $state<number | null>(null)

  // Controla a visibilidade do formulário de novo agendamento do terceirizado
  let showAddSchedule = $state(false)

  // Fecha formulário de agendamento após adicionar com sucesso
  $effect(() => {
    if (form && 'scheduleAdded' in form && form.scheduleAdded) {
      showAddSchedule = false
      lunchStartInput = ''
      lunchEndInput = ''
    }
  })

  // Almoço: calcula lunchEnd automaticamente como lunchStart + 1 hora
  let lunchStartInput = $state('')
  let lunchEndInput = $state('')

  $effect(() => {
    if (!lunchStartInput) {
      lunchEndInput = ''
      return
    }
    const [h, m] = lunchStartInput.split(':').map(Number)
    const totalMin = (h ?? 0) * 60 + (m ?? 0) + 60
    const endH = Math.floor(totalMin / 60)
    const endM = totalMin % 60
    lunchEndInput = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  })

  // Formata data YYYY-MM-DD para exibição em pt-BR
  function formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
  }

  // Formata HH:MM:SS (vindo do banco) para HH:MM
  function formatTime(t: string): string {
    return t.slice(0, 5)
  }

  // Verifica se uma data já passou (para destaque visual)
  function isPast(isoDate: string): boolean {
    return isoDate < new Date().toISOString().slice(0, 10)
  }
</script>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-lg font-semibold text-gray-900">Configurações do Sistema</h1>
    <p class="text-sm text-gray-500">Parâmetros operacionais e tipos de prótese</p>
  </header>

  <div class="mx-auto max-w-2xl space-y-8 px-6 py-6">

    <!-- Seção: Parâmetros operacionais -->
    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Parâmetros Operacionais
      </h2>
      <form method="POST" action="?/update" use:enhance class="space-y-3">
        {#each data.configs as config (config.key)}
          <div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div class="flex items-center justify-between gap-4">
              <div class="flex-1">
                <label for={config.key} class="block text-sm font-medium text-gray-800">
                  {config.label}
                </label>
                <p class="mt-0.5 text-xs text-gray-400">{config.description}</p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <input
                  id={config.key}
                  name={config.key}
                  type="number"
                  min={config.min}
                  max={config.max}
                  value={config.value}
                  required
                  class="w-20 rounded-md border border-gray-200 px-2 py-1.5 text-right text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
                <span class="w-20 text-xs text-gray-400">{config.unit}</span>
              </div>
            </div>
          </div>
        {/each}

        <div class="flex items-center gap-4 pt-2">
          <button
            type="submit"
            class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Salvar alterações
          </button>

          {#if saved}
            <p class="text-sm text-green-600">Configurações salvas com sucesso.</p>
          {/if}

          {#if form && 'error' in form && form.error}
            <p class="text-sm text-red-600">{form.error}</p>
          {/if}
        </div>
      </form>
    </section>

    <!-- Seção: Tipos de prótese -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Tipos de Prótese
        </h2>
        <button
          onclick={() => (showAddType = !showAddType)}
          class="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
        >
          {showAddType ? 'Cancelar' : '+ Adicionar tipo'}
        </button>
      </div>

      <!-- Formulário para novo tipo -->
      {#if showAddType}
        <div class="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <form
            method="POST"
            action="?/addType"
            use:enhance={({ formElement }) =>
              async ({ update }) => {
                await update()
                formElement.reset()
              }}
            class="flex items-end gap-3"
          >
            <div class="flex-1">
              <label for="newTypeName" class="mb-1 block text-xs font-medium text-gray-600">
                Nome do novo tipo
              </label>
              <input
                id="newTypeName"
                name="name"
                type="text"
                required
                maxlength="100"
                placeholder="Ex: Prótese Total Superior"
                class="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Adicionar
            </button>
          </form>
        </div>
      {/if}

      {#if form && 'typeError' in form && form.typeError}
        <p class="mb-2 text-sm text-red-600">{form.typeError}</p>
      {/if}

      <!-- Lista de tipos cadastrados -->
      <div class="space-y-2">
        {#each data.prosthesisTypes as type (type.id)}
          <div class="rounded-lg border border-gray-200 bg-white px-4 py-3">
            {#if editingTypeId === type.id}
              <!-- Edição inline -->
              <form
                method="POST"
                action="?/editType"
                use:enhance
                class="flex items-center gap-3"
              >
                <input type="hidden" name="id" value={type.id} />
                <input
                  name="name"
                  type="text"
                  required
                  maxlength="100"
                  value={type.name}
                  class="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
                <button
                  type="submit"
                  class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onclick={() => (editingTypeId = null)}
                  class="text-xs text-gray-400 transition-colors hover:text-gray-600"
                >
                  Cancelar
                </button>
              </form>
            {:else}
              <!-- Visualização com botão de edição -->
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-800">{type.name}</span>
                <button
                  onclick={() => (editingTypeId = type.id)}
                  class="text-xs text-blue-500 transition-colors hover:text-blue-700"
                >
                  Editar
                </button>
              </div>
            {/if}
          </div>
        {:else}
          <p class="text-sm text-gray-400">Nenhum tipo de prótese cadastrado.</p>
        {/each}
      </div>
    </section>

    <!-- Seção: Agenda do Terceirizado -->
    <section>
      <div class="mb-3 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Agenda do Terceirizado
          </h2>
          <p class="mt-0.5 text-xs text-gray-400">
            Dias e unidades em que o terceirizado atende — usados para liberar vagas de agendamento.
          </p>
        </div>
        <button
          onclick={() => (showAddSchedule = !showAddSchedule)}
          class="shrink-0 text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
        >
          {showAddSchedule ? 'Cancelar' : '+ Adicionar dia'}
        </button>
      </div>

      {#if form && 'scheduleError' in form && form.scheduleError}
        <p class="mb-3 text-sm text-red-600">{form.scheduleError}</p>
      {/if}

      <!-- Formulário de novo agendamento -->
      {#if showAddSchedule}
        <div class="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
          <form
            method="POST"
            action="?/addSchedule"
            use:enhance={({ formElement }) =>
              async ({ update }) => {
                await update()
                formElement.reset()
              }}
            class="space-y-3"
          >
            <!-- Linha 1: Data + Unidade -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="scheduledDate" class="mb-1 block text-xs font-medium text-gray-600">
                  Data
                </label>
                <input
                  id="scheduledDate"
                  name="scheduledDate"
                  type="date"
                  required
                  class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label for="scheduleUnit" class="mb-1 block text-xs font-medium text-gray-600">
                  Unidade
                </label>
                <select
                  id="scheduleUnit"
                  name="healthUnitId"
                  required
                  class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {#each data.allUnits as unit (unit.id)}
                    <option value={unit.id}>{unit.label}</option>
                  {/each}
                </select>
              </div>
            </div>

            <!-- Linha 2: Janela de atendimento -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="startTime" class="mb-1 block text-xs font-medium text-gray-600">
                  Início da janela
                </label>
                <input
                  id="startTime"
                  name="startTime"
                  type="time"
                  required
                  class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label for="endTime" class="mb-1 block text-xs font-medium text-gray-600">
                  Fim da janela
                </label>
                <input
                  id="endTime"
                  name="endTime"
                  type="time"
                  required
                  class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
              </div>
            </div>

            <!-- Linha 3: Almoço (opcional) -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="lunchStart" class="mb-1 block text-xs font-medium text-gray-600">
                  Início do almoço <span class="text-gray-400">(opcional)</span>
                </label>
                <input
                  id="lunchStart"
                  name="lunchStart"
                  type="time"
                  bind:value={lunchStartInput}
                  class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                />
              </div>

              <div>
                <label for="lunchEnd" class="mb-1 block text-xs font-medium text-gray-600">
                  Fim do almoço
                  {#if lunchStartInput}
                    <span class="text-gray-400">(calculado automaticamente)</span>
                  {/if}
                </label>
                <input
                  id="lunchEnd"
                  name="lunchEnd"
                  type="time"
                  bind:value={lunchEndInput}
                  disabled={!lunchStartInput}
                  class="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>
            {#if lunchStartInput}
              <p class="text-xs text-gray-400">
                Fim calculado automaticamente como +1h. Ajuste manualmente se necessário.
              </p>
            {/if}

            <!-- Linha 4: Duração padrão dos slots -->
            <div>
              <p class="mb-1 text-xs font-medium text-gray-600">Duração padrão das consultas</p>
              <div class="flex gap-4">
                <label class="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="defaultDuration"
                    value="60"
                    checked
                    class="accent-blue-600"
                  />
                  1 hora
                </label>
                <label class="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="defaultDuration"
                    value="30"
                    class="accent-blue-600"
                  />
                  30 minutos
                </label>
              </div>
            </div>

            <div>
              <button
                type="submit"
                class="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Adicionar
              </button>
            </div>
          </form>
        </div>
      {/if}

      <!-- Lista de agendamentos cadastrados -->
      <div class="space-y-2">
        {#each data.schedules as schedule (schedule.id)}
          <div
            class="flex items-center justify-between rounded-lg border bg-white px-4 py-3 {isPast(schedule.scheduledDate) ? 'border-gray-100 opacity-60' : 'border-gray-200'}"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-x-2">
                <span class="text-sm font-medium text-gray-800">
                  {formatDate(schedule.scheduledDate)}
                </span>
                <span class="text-gray-300">·</span>
                <span class="text-sm text-gray-600">{schedule.healthUnitLabel}</span>
                <span class="text-gray-300">·</span>
                <span class="text-xs text-gray-500">
                  {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}
                </span>
                <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {schedule.defaultDuration}min/slot
                </span>
              </div>
              {#if schedule.lunchStart && schedule.lunchEnd}
                <p class="mt-0.5 text-xs text-gray-400">
                  Almoço: {formatTime(schedule.lunchStart)}–{formatTime(schedule.lunchEnd)}
                </p>
              {/if}
            </div>
            <form method="POST" action="?/removeSchedule" use:enhance class="shrink-0 ml-4">
              <input type="hidden" name="id" value={schedule.id} />
              <button
                type="submit"
                title="Remover agendamento"
                class="text-xs text-gray-300 transition-colors hover:text-red-500"
              >
                ×
              </button>
            </form>
          </div>
        {:else}
          <p class="text-sm text-gray-400">Nenhum dia de atendimento configurado.</p>
        {/each}
      </div>
    </section>

    <!-- Seção: Unidades Responsáveis -->
    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Unidades Responsáveis
      </h2>
      <p class="mb-4 text-xs text-gray-400">
        Cada unidade responsável visualiza pacientes de si mesma e de suas unidades designadas.
      </p>

      {#if form && 'unitLinkError' in form && form.unitLinkError}
        <p class="mb-3 text-sm text-red-600">{form.unitLinkError}</p>
      {/if}

      <div class="space-y-4">
        {#each data.unitGroups as group (group.responsibleUnitId)}
          {@const alreadyLinked = group.designatedUnits.map((d) => d.designatedUnitId)}
          {@const available = data.allUnits.filter((u) => !alreadyLinked.includes(u.id))}
          <div class="rounded-lg border border-gray-200 bg-white px-4 py-4">
            <p class="mb-3 text-sm font-medium text-gray-800">{group.responsibleLabel}</p>

            <div class="flex flex-wrap items-center gap-2">
              <!-- Tags das unidades designadas — própria não é removível -->
              {#each group.designatedUnits as link (link.designatedUnitId)}
                {#if link.designatedUnitId === group.responsibleUnitId}
                  <span class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700">
                    {link.designatedLabel}
                  </span>
                {:else}
                  <form method="POST" action="?/removeUnitLink" use:enhance>
                    <input type="hidden" name="responsibleUnitId" value={group.responsibleUnitId} />
                    <input type="hidden" name="designatedUnitId" value={link.designatedUnitId} />
                    <button
                      type="submit"
                      title="Remover vínculo"
                      class="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600 transition-colors hover:bg-red-100 hover:text-red-600"
                    >
                      {link.designatedLabel}
                      <span aria-hidden="true">×</span>
                    </button>
                  </form>
                {/if}
              {/each}

              <!-- Botão/select para adicionar nova unidade designada -->
              {#if addingForUnit === group.responsibleUnitId}
                <form
                  method="POST"
                  action="?/addUnitLink"
                  use:enhance={({ formElement }) =>
                    async ({ update }) => {
                      addingForUnit = null
                      await update()
                      formElement.reset()
                    }}
                  class="flex items-center gap-1"
                >
                  <input type="hidden" name="responsibleUnitId" value={group.responsibleUnitId} />
                  <select
                    name="designatedUnitId"
                    class="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {#each available as unit (unit.id)}
                      <option value={unit.id}>{unit.label}</option>
                    {/each}
                  </select>
                  <button
                    type="submit"
                    class="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onclick={() => (addingForUnit = null)}
                    class="text-xs text-gray-400 transition-colors hover:text-gray-600"
                  >
                    Cancelar
                  </button>
                </form>
              {:else if available.length > 0}
                <button
                  type="button"
                  onclick={() => (addingForUnit = group.responsibleUnitId)}
                  class="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs text-gray-400 transition-colors hover:border-blue-400 hover:text-blue-500"
                >
                  + Adicionar unidade
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </section>

  </div>
</div>
