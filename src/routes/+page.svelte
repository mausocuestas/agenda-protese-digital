<script lang="ts">
  import type { PageData } from './$types'
  import EChart from '$lib/components/echart.svelte'
  import type { EChartsOption } from 'echarts'

  let { data }: { data: PageData } = $props()

  // Formata YYYY-MM para exibição abreviada (ex: "Mar/26")
  function formatMonth(ym: string): string {
    const [year, month] = ym.split('-')
    const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${names[Number(month) - 1]}/${String(year).slice(2)}`
  }

  const volumeChartOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    legend: { data: ['Encaminhamentos', 'Entregas'], bottom: 0 },
    grid: { left: 32, right: 16, top: 16, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.chartMonths.map(formatMonth),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    series: [
      {
        name: 'Encaminhamentos',
        type: 'bar',
        data: data.referralsByMonth,
        itemStyle: { color: '#3b82f6', borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'Entregas',
        type: 'bar',
        data: data.deliveriesByMonth,
        itemStyle: { color: '#22c55e', borderRadius: [3, 3, 0, 0] },
      },
    ],
  })

  // Grupos de métricas organizados por etapa do fluxo
  const filaCards = $derived([
    {
      label: 'Na fila',
      count: data.filaCount,
      href: '/fila',
      description: 'Encaminhamentos aguardando agendamento',
      visible: data.canSeeFila,
      urgent: data.filaCount > 20,
    },
  ])

  const custodiaCards = $derived([
    {
      label: 'Aguardando confecção',
      count: data.awaitingReadyCount,
      href: '/custodia',
      description: 'Próteses em produção no terceirizado',
      visible: data.canSeeAwaitingReady,
      urgent: false,
    },
    {
      label: 'Prontas para receber',
      count: data.awaitingReceivalCount,
      href: '/custodia',
      description: 'Próteses prontas, aguardando entrada na unidade',
      visible: data.canSeeAwaitingReceival,
      urgent: data.awaitingReceivalCount > 0,
    },
  ])

  const qualidadeCards = $derived([
    {
      label: 'Avaliação pendente',
      count: data.awaitingConformityCount,
      href: '/qualidade',
      description: 'Entregas aguardando parecer do dentista',
      visible: data.canAssessConformity,
      urgent: data.awaitingConformityCount > 0,
    },
    {
      label: 'Aprovação da coordenação',
      count: data.awaitingApprovalCount,
      href: '/qualidade',
      description: 'Avaliações aguardando NF e aprovação',
      visible: data.canApprove,
      urgent: data.awaitingApprovalCount > 0,
    },
    {
      label: 'Ligação de satisfação',
      count: data.awaitingSatisfactionCount,
      href: '/qualidade',
      description: 'Pacientes aguardando ligação de retorno',
      visible: data.canCallSatisfaction,
      urgent: false,
    },
    {
      label: 'Consulta na unidade',
      count: data.pendingUnitAppointmentsCount,
      href: '/qualidade',
      description: 'Pacientes com consulta pendente de agendamento',
      visible: data.canCallSatisfaction,
      urgent: data.pendingUnitAppointmentsCount > 0,
    },
  ])
</script>

<div class="p-6">
  <div class="mb-6">
    <h1 class="text-lg font-semibold text-gray-900">Visão geral</h1>
    <p class="text-sm text-gray-500">Pendências do fluxo de próteses</p>
  </div>

  <!-- Fila -->
  {#if filaCards.some((c) => c.visible)}
    <section class="mb-8">
      <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Fila</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each filaCards.filter((c) => c.visible) as card}
          <a
            href={card.href}
            class="group flex flex-col rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md {card.urgent
              ? 'border-amber-200'
              : 'border-gray-200'}"
          >
            <span class="text-3xl font-bold {card.urgent ? 'text-amber-600' : 'text-gray-900'}">
              {card.count}
            </span>
            <span class="mt-1 text-sm font-medium text-gray-700">{card.label}</span>
            <span class="mt-1 text-xs text-gray-400">{card.description}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Custódia -->
  {#if custodiaCards.some((c) => c.visible)}
    <section class="mb-8">
      <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Custódia</h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each custodiaCards.filter((c) => c.visible) as card}
          <a
            href={card.href}
            class="group flex flex-col rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md {card.urgent
              ? 'border-blue-200'
              : 'border-gray-200'}"
          >
            <span class="text-3xl font-bold {card.urgent ? 'text-blue-600' : 'text-gray-900'}">
              {card.count}
            </span>
            <span class="mt-1 text-sm font-medium text-gray-700">{card.label}</span>
            <span class="mt-1 text-xs text-gray-400">{card.description}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Qualidade pós-entrega -->
  {#if qualidadeCards.some((c) => c.visible)}
    <section class="mb-8">
      <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Qualidade pós-entrega
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {#each qualidadeCards.filter((c) => c.visible) as card}
          <a
            href={card.href}
            class="group flex flex-col rounded-lg border bg-white p-5 shadow-sm transition-shadow hover:shadow-md {card.urgent
              ? 'border-green-200'
              : 'border-gray-200'}"
          >
            <span class="text-3xl font-bold {card.urgent ? 'text-green-700' : 'text-gray-900'}">
              {card.count}
            </span>
            <span class="mt-1 text-sm font-medium text-gray-700">{card.label}</span>
            <span class="mt-1 text-xs text-gray-400">{card.description}</span>
          </a>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Gráficos históricos — últimos 6 meses -->
  <section>
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
      Histórico — últimos 6 meses
    </h2>
    <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p class="mb-4 text-sm font-medium text-gray-700">Encaminhamentos abertos vs. entregas</p>
      <div class="h-56">
        <EChart option={volumeChartOption} />
      </div>
    </div>
  </section>
</div>
