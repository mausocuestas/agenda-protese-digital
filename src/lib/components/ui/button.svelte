<script lang="ts">
  import type { Snippet } from 'svelte'

  type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost'
  type Size = 'sm' | 'md'
  type ButtonType = 'button' | 'submit' | 'reset'

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    onclick,
    children,
  }: {
    variant?: Variant
    size?: Size
    type?: ButtonType
    disabled?: boolean
    onclick?: (e: MouseEvent) => void
    children: Snippet
  } = $props()

  const variantClass: Record<Variant, string> = {
    primary:     'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300',
    secondary:   'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50',
    destructive: 'text-danger-600 hover:text-danger-700 disabled:opacity-40',
    ghost:       'text-neutral-400 hover:text-neutral-700 disabled:opacity-40',
  }

  const sizeClass: Record<Size, string> = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-1.5 text-sm',
  }
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="inline-flex items-center gap-1.5 rounded-md font-medium transition-colors {variantClass[variant]} {sizeClass[size]}"
>
  {@render children()}
</button>
