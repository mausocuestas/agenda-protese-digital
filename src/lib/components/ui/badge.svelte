<script lang="ts">
  import type { Snippet } from 'svelte'

  type Variant = 'success' | 'danger' | 'warning' | 'neutral'

  let {
    variant = 'neutral',
    children,
  }: {
    variant?: Variant
    children: Snippet
  } = $props()

  const variantClass: Record<Variant, string> = {
    success: 'bg-success-100 text-success-700',
    danger:  'bg-danger-100  text-danger-700',
    warning: 'bg-warning-100 text-warning-700',
    neutral: 'bg-neutral-100 text-neutral-500',
  }
</script>

<span class="rounded px-1.5 py-0.5 text-xs font-medium {variantClass[variant]}">
  {@render children()}
</span>
