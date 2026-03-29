<script lang="ts">
  import type { PageData, ActionData } from './$types'
  import { enhance } from '$app/forms'

  let { data, form }: { data: PageData; form: ActionData } = $props()

  let saved = $state(false)

  // Exibe mensagem de sucesso por 3 segundos após salvar
  $effect(() => {
    if (form && 'success' in form && form.success) {
      saved = true
      const timer = setTimeout(() => (saved = false), 3000)
      return () => clearTimeout(timer)
    }
  })
</script>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-lg font-semibold text-gray-900">Configurações do Sistema</h1>
    <p class="text-sm text-gray-500">Parâmetros operacionais do fluxo de próteses</p>
  </header>

  <div class="mx-auto max-w-2xl px-6 py-6">
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
  </div>
</div>
