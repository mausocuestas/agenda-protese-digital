<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    title,
    subtitle,
    action,
  }: {
    title: string
    subtitle?: string
    action?: Snippet
  } = $props()
</script>

<!-- Header padronizado de página — substitui o padrão repetido em todas as rotas -->
<header class="border-b border-neutral-200 bg-white px-6 py-4">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-lg font-semibold text-neutral-900">{title}</h1>
      {#if subtitle}
        <p class="text-sm text-neutral-500">{subtitle}</p>
      {/if}
    </div>
    {#if action}
      <div>{@render action()}</div>
    {/if}
  </div>
</header>
