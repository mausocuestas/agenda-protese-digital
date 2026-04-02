<script lang="ts">
  import type { PageData } from './$types'
  import { formatQueueTime } from '$lib/utils'
  import { goto } from '$app/navigation'
  import { enhance } from '$app/forms'

  let { data }: { data: PageData } = $props()

  // Filtro de status — "all" mostra active + pending_reassessment + suspended
  let statusFilter = $state<'all' | 'active' | 'pending_reassessment' | 'suspended'>('all')

  // Filtro de flags — conjunto de flags ativas; vazio = sem filtro
  let flagFilters = $state(new Set<'ouv' | 'aci' | 'ids' | 'atr' | 'sus' | 'cnt'>())

  function toggleFlagFilter(flag: 'ouv' | 'aci' | 'ids' | 'atr' | 'sus' | 'cnt') {
    const next = new Set(flagFilters)
    if (next.has(flag)) next.delete(flag)
    else next.add(flag)
    flagFilters = next
  }

  let filtered = $derived(() => {
    let result = statusFilter === 'all'
      ? data.items
      : data.items.filter((i) => i.status === statusFilter)

    if (flagFilters.size > 0) {
      result = result.filter((i) =>
        (flagFilters.has('ouv') && i.hasOmbudsmanFlag) ||
        (flagFilters.has('aci') && i.hasAccidentFlag) ||
        (flagFilters.has('ids') && i.isElderly) ||
        (flagFilters.has('atr') && i.isDelayed) ||
        (flagFilters.has('sus') && i.isSuspended) ||
        (flagFilters.has('cnt') && i.noAnswerCount >= 3)
      )
    }

    return result
  })

  const statusLabel: Record<string, string> = {
    active: 'Ativo',
    pending_reassessment: 'Reavaliação',
    suspended: 'Suspenso',
  }

  const statusClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    pending_reassessment: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-gray-100 text-gray-500',
  }

  // Navega com query param ao selecionar unidade (apenas coordenador)
  function handleUnitChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value
    goto(value ? `/fila?unit=${value}` : '/fila')
  }

  const scopeOptions = [
    { value: 'mine', label: 'Minha unidade' },
    { value: 'responsible', label: 'Sob responsabilidade' },
    { value: 'all', label: 'Todas' },
  ] as const
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Cabeçalho da página -->
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-gray-900">{data.activeUnitName}</h1>
        <p class="text-sm text-gray-500">{filtered().length} paciente{filtered().length !== 1 ? 's' : ''} na fila</p>
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

        <!-- Filtro de escopo de unidades — apenas para atendente -->
        {#if data.isAttendant}
          <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
            {#each scopeOptions as opt}
              <button
                class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {data.scope === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => goto(opt.value === 'mine' ? '/fila' : `/fila?scope=${opt.value}`)}
              >
                {opt.label}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Filtro de status -->
        <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
          {#each (['all', 'active', 'pending_reassessment', 'suspended'] as const) as opt}
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

    <!-- Filtros de prioridade -->
    <div class="mt-3 flex items-center gap-2">
      <span class="text-xs text-gray-400">Filtrar por:</span>
      <button
        onclick={() => toggleFlagFilter('ouv')}
        class="rounded px-2 py-1 text-xs font-bold transition-colors {flagFilters.has('ouv')
          ? 'bg-red-600 text-white'
          : 'bg-red-50 text-red-600 hover:bg-red-100'}"
      >
        OUV Ouvidoria
      </button>
      <button
        onclick={() => toggleFlagFilter('aci')}
        class="rounded px-2 py-1 text-xs font-bold transition-colors {flagFilters.has('aci')
          ? 'bg-orange-600 text-white'
          : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}"
      >
        ACI Acidente
      </button>
      <button
        onclick={() => toggleFlagFilter('ids')}
        class="rounded px-2 py-1 text-xs font-bold transition-colors {flagFilters.has('ids')
          ? 'bg-blue-600 text-white'
          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}"
      >
        IDS Idoso (60+)
      </button>
      <button
        onclick={() => toggleFlagFilter('atr')}
        class="rounded px-2 py-1 text-xs font-bold transition-colors {flagFilters.has('atr')
          ? 'bg-purple-600 text-white'
          : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}"
      >
        ATR Atrasado (+{data.delayDays}d)
      </button>
      <button
        onclick={() => toggleFlagFilter('sus')}
        class="rounded px-2 py-1 text-xs font-bold transition-colors {flagFilters.has('sus')
          ? 'bg-gray-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
      >
        SUS Suspenso
      </button>
      <button
        onclick={() => toggleFlagFilter('cnt')}
        class="rounded px-2 py-1 text-xs font-bold transition-colors {flagFilters.has('cnt')
          ? 'bg-amber-600 text-white'
          : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}"
      >
        CON Sem resposta (3+)
      </button>
      {#if flagFilters.size > 0}
        <button
          onclick={() => (flagFilters = new Set())}
          class="ml-1 text-xs text-gray-400 hover:text-gray-600"
        >
          Limpar filtros
        </button>
      {/if}
    </div>
  </header>

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
        {#each filtered() as item (item.id)}
          <tr
            class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer {item.isSuspended ? 'opacity-60' : ''}"
            onclick={() => (location.href = `/fila/${item.id}`)}
          >
            <!-- Flags de prioridade -->
            <td class="px-4 py-3">
              <div class="flex gap-1">
                <!-- OUV: toggle apenas para coordenador; demais veem badge somente quando ativo -->
                {#if data.isCoordinator}
                  <form method="POST" action="?/toggle_flag" use:enhance class="inline">
                    <input type="hidden" name="referralId" value={item.id} />
                    <input type="hidden" name="flag" value="ombudsman" />
                    <button
                      type="submit"
                      title={item.hasOmbudsmanFlag ? 'Remover flag Ouvidoria' : 'Marcar como Ouvidoria'}
                      onclick={(e) => e.stopPropagation()}
                      class="rounded px-1.5 py-0.5 text-xs font-bold transition-colors {item.hasOmbudsmanFlag
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-gray-50 text-gray-300 hover:bg-red-50 hover:text-red-400'}"
                    >
                      OUV
                    </button>
                  </form>
                {:else if item.hasOmbudsmanFlag}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-red-600 bg-red-50">OUV</span>
                {/if}

                <!-- ACI: toggle para todos os perfis -->
                <form method="POST" action="?/toggle_flag" use:enhance class="inline">
                  <input type="hidden" name="referralId" value={item.id} />
                  <input type="hidden" name="flag" value="accident" />
                  <button
                    type="submit"
                    title={item.hasAccidentFlag ? 'Remover flag Acidente' : 'Marcar como Acidente de trabalho'}
                    onclick={(e) => e.stopPropagation()}
                    class="rounded px-1.5 py-0.5 text-xs font-bold transition-colors {item.hasAccidentFlag
                      ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                      : 'bg-gray-50 text-gray-300 hover:bg-orange-50 hover:text-orange-400'}"
                  >
                    ACI
                  </button>
                </form>

                <!-- IDS e ATR: sempre somente leitura -->
                {#if item.isElderly}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-blue-600 bg-blue-50">IDS</span>
                {/if}
                {#if item.isDelayed}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-purple-600 bg-purple-50">ATR</span>
                {/if}

                <!-- SUS: toggle para coordenador; demais veem badge somente quando suspenso -->
                {#if data.isCoordinator}
                  <form method="POST" action="?/toggle_suspend" use:enhance class="inline">
                    <input type="hidden" name="referralId" value={item.id} />
                    <button
                      type="submit"
                      title={item.isSuspended ? 'Remover suspensão' : 'Suspender encaminhamento'}
                      onclick={(e) => e.stopPropagation()}
                      class="rounded px-1.5 py-0.5 text-xs font-bold transition-colors {item.isSuspended
                        ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        : 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500'}"
                    >
                      SUS
                    </button>
                  </form>
                {:else if item.isSuspended}
                  <span class="rounded px-1.5 py-0.5 text-xs font-bold text-gray-500 bg-gray-200">SUS</span>
                {/if}

                <!-- CON: badge de tentativas sem resposta — alerta a partir da 3ª -->
                {#if item.noAnswerCount >= 3}
                  <span
                    title="{item.noAnswerCount} tentativa{item.noAnswerCount !== 1 ? 's' : ''} sem resposta"
                    class="rounded px-1.5 py-0.5 text-xs font-bold {item.noAnswerCount >= 5
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-50 text-amber-600'}"
                  >
                    CON {item.noAnswerCount}
                  </span>
                {/if}

                <!-- Liberar vaga: disponível para coordenador e atendente após 5 tentativas -->
                {#if item.noAnswerCount >= 5 && (data.isCoordinator || data.isAttendant)}
                  <form method="POST" action="?/release_slot" use:enhance class="inline">
                    <input type="hidden" name="referralId" value={item.id} />
                    <button
                      type="submit"
                      title="5 tentativas sem resposta — inativar encaminhamento e liberar vaga"
                      onclick={(e) => e.stopPropagation()}
                      class="rounded px-1.5 py-0.5 text-xs font-bold bg-red-600 text-white hover:bg-red-700"
                    >
                      Liberar
                    </button>
                  </form>
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
              <span class="text-gray-700 {item.isDelayed ? 'font-semibold text-purple-700' : ''}">
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
