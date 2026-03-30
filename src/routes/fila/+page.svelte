<script lang="ts">
  import type { PageData } from './$types'
  import { formatQueueTime } from '$lib/utils'
  import { goto } from '$app/navigation'

  let { data }: { data: PageData } = $props()

  // Filtro de status — "all" mostra active + pending_reassessment
  let statusFilter = $state<'all' | 'active' | 'pending_reassessment'>('all')

  let filtered = $derived(
    statusFilter === 'all'
      ? data.items
      : data.items.filter((i) => i.status === statusFilter)
  )

  const statusLabel: Record<string, string> = {
    active: 'Ativo',
    pending_reassessment: 'Reavaliação',
  }

  const statusClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending_reassessment: 'bg-yellow-100 text-yellow-800',
  }

  // Navega com query param ao selecionar unidade (apenas coordenador)
  function handleUnitChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    goto(value ? `/fila?unit=${value}` : '/fila')
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho da página -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">{data.activeUnitName}</h1>
        <p class="text-sm text-gray-500">{filtered.length} paciente{filtered.length !== 1 ? 's' : ''} na fila</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Botão de novo encaminhamento — dentista e coordenador -->
        {#if data.canCreateReferral}
          <a
            href="/fila/novo"
            class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Novo encaminhamento
          </a>
        {/if}

        <!-- Seletor de unidade — apenas para coordenador -->
        {#if data.isCoordinator}
          <select
            class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-gray-400 focus:outline-none"
            onchange={handleUnitChange}
          >
            <option value="" selected={data.activeUnitId === null}>Todas as unidades</option>
            {#each data.units as unit (unit.id)}
              <option value={unit.id} selected={unit.id === data.activeUnitId}>{unit.name}</option>
            {/each}
          </select>
        {/if}

        <!-- Filtro de status -->
        <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
          {#each (['all', 'active', 'pending_reassessment'] as const) as opt}
            <button
              class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {statusFilter === opt
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}"
              onclick={() => (statusFilter = opt)}
            >
              {opt === 'all' ? 'Todos' : statusLabel[opt]}
            </button>
          {/each}
        </div>
      </div>
    </div>
  </header>

  <!-- Legenda de prioridades -->
  <div class="flex gap-4 border-b border-gray-100 bg-white px-6 py-2 text-xs text-gray-500">
    <span class="flex items-center gap-1"><span class="font-bold text-red-600">OUV</span> Ouvidoria</span>
    <span class="flex items-center gap-1"><span class="font-bold text-orange-600">ACI</span> Acidente</span>
    <span class="flex items-center gap-1"><span class="font-bold text-blue-600">IDS</span> Idoso (60+)</span>
    <span class="flex items-center gap-1"><span class="font-bold text-purple-600">ATR</span> Atrasado (+180 dias)</span>
  </div>

  <!-- Tabela -->
  <div class="overflow-x-auto">
    <table class="w-full border-collapse bg-white text-sm">
      <thead>
        <tr class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          <th class="px-4 py-3">Prioridade</th>
          <th class="px-4 py-3">Paciente</th>
          <th class="px-4 py-3">Idade</th>
          <th class="px-4 py-3">Unidade</th>
          <th class="px-4 py-3">Tipo(s) de Prótese</th>
          <th class="px-4 py-3">Na fila há</th>
          <th class="px-4 py-3">Status</th>
          <th class="px-4 py-3">OS</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as item (item.id)}
          <tr class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onclick={() => location.href = `/fila/${item.id}`}>
            <!-- Flags de prioridade -->
            <td class="px-4 py-3">
              <div class="flex gap-1">
                {#if item.hasOmbudsmanFlag}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-red-600 bg-red-50">OUV</span>
                {/if}
                {#if item.hasAccidentFlag}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-orange-600 bg-orange-50">ACI</span>
                {/if}
                {#if item.isElderly}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-blue-600 bg-blue-50">IDS</span>
                {/if}
                {#if item.isDelayed}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-purple-600 bg-purple-50">ATR</span>
                {/if}
                {#if !item.hasOmbudsmanFlag && !item.hasAccidentFlag && !item.isElderly && !item.isDelayed}
                  <span class="text-gray-300">—</span>
                {/if}
              </div>
            </td>

            <td class="px-4 py-3 font-medium text-gray-900">{item.patientName}</td>
            <td class="px-4 py-3 text-gray-600">{item.age} anos</td>
            <td class="px-4 py-3 text-gray-600">{item.unitName}</td>

            <!-- Tipos de prótese -->
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                {#each item.prosthesisTypes as type}
                  <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{type}</span>
                {/each}
              </div>
            </td>

            <!-- Tempo na fila -->
            <td class="px-4 py-3">
              <span class="text-gray-700 {item.daysInQueue >= 180 ? 'font-semibold text-purple-700' : ''}">
                {formatQueueTime(item.daysInQueue)}
              </span>
            </td>

            <!-- Badge de status -->
            <td class="px-4 py-3">
              <span class="rounded-full px-2.5 py-1 text-xs font-medium {statusClass[item.status]}">
                {statusLabel[item.status]}
              </span>
            </td>

            <!-- Número de OS -->
            <td class="px-4 py-3 font-mono text-xs text-gray-500">
              {item.serviceOrderNumber ?? '—'}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="8" class="px-4 py-12 text-center text-sm text-gray-400">
              Nenhum encaminhamento encontrado para o filtro selecionado.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
