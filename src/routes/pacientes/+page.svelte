<script lang="ts">
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  // Filtro por status do encaminhamento
  let filterStatus = $state<string>('all')
  // Busca por nome
  let search = $state('')

  // "12345678901" → "123.456.789-01"
  function formatCpf(cpf: string) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  // "2026-04-15" → "15/04/2026"
  function formatDate(d: string) {
    const [y, m, day] = d.split('-')
    return `${day}/${m}/${y}`
  }

  // Rótulo legível do status do encaminhamento
  const statusLabel: Record<string, string> = {
    active: 'Ativo',
    pending_reassessment: 'Aguardando reavaliação',
    suspended: 'Suspenso',
    inactive: 'Inativo',
  }

  const statusBadge: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending_reassessment: 'bg-yellow-100 text-yellow-700',
    suspended: 'bg-orange-100 text-orange-700',
    inactive: 'bg-gray-100 text-gray-500',
  }

  const inactivationLabel: Record<string, string> = {
    dropout: 'Desistência',
    death: 'Óbito',
    cancellation: 'Cancelamento',
  }

  // Determina descrição do estágio no fluxo
  function stageLabel(p: (typeof data.patients)[0]): string {
    if (!p.status) return 'Sem encaminhamento'
    if (p.status === 'inactive') return inactivationLabel[p.inactivationReason ?? ''] ?? 'Inativo'
    if (p.status === 'suspended') return 'Suspenso'
    if (p.status === 'pending_reassessment') return 'Aguardando reavaliação'
    // active
    if (p.appointmentCount === 0) return 'Na fila'
    return `${p.appointmentCount} consulta${p.appointmentCount > 1 ? 's' : ''} registrada${p.appointmentCount > 1 ? 's' : ''}`
  }

  // Remove acentos para busca insensível a acentuação
  function normalize(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  // Lista filtrada por status e nome/CPF (case-insensitive, accent-insensitive, parcial)
  let filtered = $derived(
    data.patients.filter((p) => {
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'none' && !p.status) ||
        p.status === filterStatus
      const term = search.trim()
      const matchSearch =
        term === '' ||
        normalize(p.fullName).includes(normalize(term)) ||
        p.cpf.includes(term.replace(/\D/g, ''))
      return matchStatus && matchSearch
    })
  )

  // Contadores por status para os botões de filtro
  let counts = $derived({
    all: data.patients.length,
    active: data.patients.filter((p) => p.status === 'active').length,
    pending_reassessment: data.patients.filter((p) => p.status === 'pending_reassessment').length,
    suspended: data.patients.filter((p) => p.status === 'suspended').length,
    inactive: data.patients.filter((p) => p.status === 'inactive').length,
    none: data.patients.filter((p) => !p.status).length,
  })
</script>

<div class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white px-6 py-4">
    <h1 class="text-lg font-semibold text-gray-900">Pacientes</h1>
    <p class="text-sm text-gray-500">Visão geral de todos os pacientes cadastrados no sistema</p>
  </header>

  <!-- Barra de filtros -->
  <div class="border-b border-gray-200 bg-white px-6 py-3">
    <div class="flex flex-wrap items-center gap-3">
      <!-- Busca por nome ou CPF -->
      <input
        type="text"
        bind:value={search}
        placeholder="Buscar por nome ou CPF..."
        class="w-64 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
      />

      <!-- Filtros por status -->
      <div class="flex flex-wrap gap-1">
        {#each [
          { key: 'all', label: 'Todos' },
          { key: 'active', label: 'Ativos' },
          { key: 'pending_reassessment', label: 'Reavaliação' },
          { key: 'suspended', label: 'Suspensos' },
          { key: 'inactive', label: 'Inativos' },
          { key: 'none', label: 'Sem encaminhamento' },
        ] as filter}
          <button
            onclick={() => (filterStatus = filter.key)}
            class="rounded-full px-3 py-1 text-xs font-medium transition-colors {filterStatus === filter.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          >
            {filter.label}
            <span class="ml-1 opacity-70">
              ({counts[filter.key as keyof typeof counts]})
            </span>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Tabela de pacientes -->
  <div class="overflow-x-auto">
    <table class="w-full border-collapse bg-white text-sm">
      <thead>
        <tr
          class="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
        >
          <th class="px-4 py-3">Paciente</th>
          <th class="px-4 py-3">CPF</th>
          <th class="px-4 py-3">Telefone</th>
          <th class="px-4 py-3">Unidade</th>
          <th class="px-4 py-3">Situação</th>
          <th class="px-4 py-3">Estágio</th>
          <th class="px-4 py-3">Próx. consulta</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as p (p.id)}
          <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="px-4 py-3 font-medium text-gray-900">{p.fullName}</td>
            <td class="px-4 py-3 font-mono text-xs text-gray-600">{formatCpf(p.cpf)}</td>
            <td class="px-4 py-3 text-gray-600">{p.phone}</td>
            <td class="px-4 py-3 text-gray-600">{p.unitName}</td>
            <td class="px-4 py-3">
              {#if p.status}
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium {statusBadge[p.status] ?? 'bg-gray-100 text-gray-500'}"
                >
                  {statusLabel[p.status] ?? p.status}
                </span>
              {:else}
                <span class="text-xs text-gray-400">—</span>
              {/if}
            </td>
            <td class="px-4 py-3 text-xs text-gray-600">{stageLabel(p)}</td>
            <td class="px-4 py-3 text-xs text-gray-600">
              {p.nextAppointmentDate ? formatDate(p.nextAppointmentDate) : '—'}
            </td>
            <td class="px-4 py-3 text-right">
              {#if p.referralId}
                <a
                  href="/fila/{p.referralId}"
                  class="text-xs text-blue-500 transition-colors hover:text-blue-700"
                >
                  Ver encaminhamento
                </a>
              {:else}
                <span class="text-xs text-gray-300">Sem encaminhamento</span>
              {/if}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="8" class="px-4 py-12 text-center text-sm text-gray-400">
              {search || filterStatus !== 'all'
                ? 'Nenhum paciente encontrado para os filtros aplicados.'
                : 'Nenhum paciente cadastrado.'}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if filtered.length > 0}
      <div class="border-t border-gray-100 bg-white px-4 py-2 text-xs text-gray-400">
        {filtered.length} paciente{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
        {filterStatus !== 'all' || search ? `(${data.patients.length} no total)` : ''}
      </div>
    {/if}
  </div>
</div>
