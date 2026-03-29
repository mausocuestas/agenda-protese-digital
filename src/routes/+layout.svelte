<script lang="ts">
  import '../app.css'

  let { data, children } = $props()
</script>

{#if data.user}
  <!-- Barra superior mínima — será expandida quando a UI evoluir -->
  <header class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
    <span class="text-sm font-medium text-slate-700">Agenda Prótese Digital</span>
    <div class="flex items-center gap-4">
      <span class="text-sm text-slate-500">{data.user.name ?? data.user.email}</span>
      <a
        href="/auth/sign-out"
        class="text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        Sair
      </a>
    </div>
  </header>
{/if}

{@render children()}
