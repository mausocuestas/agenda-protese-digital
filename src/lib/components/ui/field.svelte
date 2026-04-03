<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    label,
    error,
    for: htmlFor,
    children,
  }: {
    label: string
    error?: string
    for?: string
    children: Snippet
  } = $props()
</script>

<!-- Wrapper canônico label + input/select + erro -->
<div class="flex flex-col gap-1">
  <label for={htmlFor} class="text-xs font-medium text-neutral-600">{label}</label>
  {@render children()}
  {#if error}
    <p class="flex items-center gap-1 text-xs text-danger-600">
      <span aria-hidden="true">⚠</span>{error}
    </p>
  {/if}
</div>
