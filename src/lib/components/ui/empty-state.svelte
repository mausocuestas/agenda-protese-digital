<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    message,
    hint,
    action,
  }: {
    message: string
    hint?: string
    action?: Snippet
  } = $props()
</script>

<!-- Estado vazio com mensagem útil e call-to-action opcional -->
<div class="flex flex-col items-center gap-2 py-10 text-center">
  <p class="text-sm text-neutral-500">{message}</p>
  {#if hint}
    <p class="text-xs text-neutral-400">{hint}</p>
  {/if}
  {#if action}
    <div class="mt-2">{@render action()}</div>
  {/if}
</div>
