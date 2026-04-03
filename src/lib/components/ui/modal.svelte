<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open,
    title,
    onclose,
    children,
    footer,
  }: {
    open: boolean
    title?: string
    onclose: () => void
    children: Snippet
    footer?: Snippet
  } = $props()

  // Fecha com Esc
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- Overlay — fecha ao clicar fora -->
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/40 p-4"
    onclick={(e) => { if (e.target === e.currentTarget) onclose() }}
  >
    <!-- Container do modal -->
    <div
      class="z-50 w-full max-w-lg rounded-lg bg-white shadow-md"
      role="dialog"
      aria-modal="true"
    >
      {#if title}
        <div class="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 class="text-base font-semibold text-neutral-900">{title}</h2>
          <button
            onclick={onclose}
            class="text-neutral-400 transition-colors hover:text-neutral-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      {/if}

      <div class="px-5 py-4">
        {@render children()}
      </div>

      {#if footer}
        <div class="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
