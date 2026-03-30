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

  </div>
</div>
