<script lang="ts">
  import type { PageData } from './$types'
  import EChart from '$lib/components/echart.svelte'
  import type { EChartsOption } from 'echarts'

  let { data }: { data: PageData } = $props()

  // Rótulo da fase pelo número da consulta
  function phaseLabel(n: number | null): string {
    if (n === null) return '?'
    const labels: Record<number, string> = {
      1: 'Escaneamento',
      2: '1º Ajuste',
      3: '2º Ajuste',
      4: 'Entrega',
    }
    return labels[n] ?? `Consulta ${n}`
  }

  // ── Opções dos gráficos ──────────────────────────────────────────────────────

  // 1. Atendimentos por unidade — barras horizontais
  const unidadesOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    yAxis: {
      type: 'category',
      data: [...data.atendimentosPorUnidade].reverse().map((r) => r.name),
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: [...data.atendimentosPorUnidade].reverse().map((r) => r.count),
        itemStyle: { color: '#3b82f6', borderRadius: [0, 3, 3, 0] },
        label: { show: true, position: 'right', fontSize: 11, color: '#374151' },
      },
    ],
  })

  // 2. Próteses por tipo — barras verticais
  const tiposOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    grid: { left: 32, right: 16, top: 16, bottom: 60 },
    xAxis: {
      type: 'category',
      data: data.protesesPorTipo.map((r) => r.name),
      axisLabel: {
        color: '#6b7280',
        fontSize: 10,
        rotate: 30,
        interval: 0,
        overflow: 'truncate',
        width: 80,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: data.protesesPorTipo.map((r) => r.count),
        itemStyle: { color: '#8b5cf6', borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 11, color: '#374151' },
      },
    ],
  })

  // 3. Próteses por faixa etária — barras verticais
  const idadeOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    grid: { left: 32, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.protesesPorIdade.map((r) => r.ageGroup),
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: data.protesesPorIdade.map((r) => r.count),
        itemStyle: { color: '#06b6d4', borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 11, color: '#374151' },
      },
    ],
  })

  // 4. Satisfação pós-entrega — donut
  const totalSatisfacao = $derived(
    data.satisfacao.great + data.satisfacao.reasonable + data.satisfacao.difficulties
  )
  const satisfacaoOption = $derived<EChartsOption>({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, data: ['Ótimo', 'Razoável', 'Com dificuldades'], textStyle: { fontSize: 11, color: '#6b7280' } },
    series: [
      {
        type: 'pie',
        radius: ['38%', '65%'],
        center: ['50%', '42%'],
        label: { show: false },
        emphasis: { label: { show: false } },
        data: [
          { value: data.satisfacao.great, name: 'Ótimo', itemStyle: { color: '#22c55e' } },
          { value: data.satisfacao.reasonable, name: 'Razoável', itemStyle: { color: '#f59e0b' } },
          {
            value: data.satisfacao.difficulties,
            name: 'Com dificuldades',
            itemStyle: { color: '#ef4444' },
          },
        ],
      },
    ],
  })

  // 5. Não conformidades por critério — barras horizontais
  const naoConformOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#6b7280', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    yAxis: {
      type: 'category',
      data: ['Material', 'Oclusão', 'Adaptação'],
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: data.naoConformidades.material, itemStyle: { color: '#3b82f6', borderRadius: [0, 3, 3, 0] } },
          { value: data.naoConformidades.occlusion, itemStyle: { color: '#f59e0b', borderRadius: [0, 3, 3, 0] } },
          { value: data.naoConformidades.adaptation, itemStyle: { color: '#ef4444', borderRadius: [0, 3, 3, 0] } },
        ],
        label: { show: true, position: 'right', fontSize: 11, color: '#374151' },
      },
    ],
  })

  // 6. Recusas por fase — barras verticais
  const recusasOption = $derived<EChartsOption>({
    tooltip: { trigger: 'axis' },
    grid: { left: 32, right: 16, top: 16, bottom: 32 },
    xAxis: {
      type: 'category',
      data: data.recusasPorFase.map((r) => phaseLabel(r.phase)),
      axisLabel: { color: '#6b7280', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { color: '#6b7280', fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: data.recusasPorFase.map((r) => r.count),
        itemStyle: { color: '#f97316', borderRadius: [3, 3, 0, 0] },
        label: { show: true, position: 'top', fontSize: 11, color: '#374151' },
      },
    ],
  })

  // Períodos disponíveis para o seletor
  const periodos = [
    { value: '3m', label: '3 meses' },
    { value: '6m', label: '6 meses' },
    { value: '12m', label: '12 meses' },
    { value: 'ano', label: 'Este ano' },
    { value: 'tudo', label: 'Tudo' },
  ]

  // Indicador de dados ausentes — seções com zero total não exibem gráfico vazio,
  // mas uma mensagem amigável para não confundir com erro
  const semDados = (arr: { count: number }[]) => arr.every((r) => r.count === 0)
</script>

<div class="p-6">
  <!-- Cabeçalho + seletor de período -->
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-lg font-semibold text-gray-900">Métricas</h1>
      <p class="text-sm text-gray-500">Análise detalhada do fluxo de próteses</p>
    </div>

    <!-- Seletor de período -->
    <div class="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
      {#each periodos as p}
        <a
          href="/metricas?periodo={p.value}"
          class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {data.period === p.value
            ? 'bg-blue-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'}"
        >
          {p.label}
        </a>
      {/each}
    </div>
  </div>

  <!-- Cards de tempo médio -->
  <section class="mb-8">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Tempo médio</h2>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <span class="text-3xl font-bold text-gray-900">
          {data.avgWaitDays != null ? data.avgWaitDays : '—'}
        </span>
        <span class="mt-1 text-sm font-medium text-gray-700">Dias até 1ª consulta</span>
        <span class="mt-1 text-xs text-gray-400">
          Da data de encaminhamento ao primeiro atendimento
        </span>
      </div>
      <div class="flex flex-col rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <span class="text-3xl font-bold text-gray-900">
          {data.avgCompletionDays != null ? data.avgCompletionDays : '—'}
        </span>
        <span class="mt-1 text-sm font-medium text-gray-700">Dias até conclusão</span>
        <span class="mt-1 text-xs text-gray-400">
          Da data de encaminhamento ao recebimento da prótese
        </span>
      </div>
    </div>
  </section>

  <!-- 1. Atendimentos por unidade -->
  <section class="mb-8">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
      Atendimentos por unidade
    </h2>
    <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {#if semDados(data.atendimentosPorUnidade)}
        <p class="py-8 text-center text-sm text-gray-400">Nenhum atendimento no período</p>
      {:else}
        <!-- Altura dinâmica: 48px por linha + margens -->
        <div style="height: {Math.max(160, data.atendimentosPorUnidade.length * 48 + 24)}px">
          <EChart option={unidadesOption} />
        </div>
      {/if}
    </div>
  </section>

  <!-- 2 e 3. Próteses por tipo e por faixa etária -->
  <section class="mb-8">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
      Próteses entregues
    </h2>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Por tipo -->
      <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p class="mb-3 text-sm font-medium text-gray-700">Por tipo</p>
        {#if semDados(data.protesesPorTipo)}
          <p class="py-8 text-center text-sm text-gray-400">Nenhuma entrega no período</p>
        {:else}
          <div class="h-56">
            <EChart option={tiposOption} />
          </div>
        {/if}
      </div>

      <!-- Por faixa etária -->
      <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p class="mb-3 text-sm font-medium text-gray-700">Por faixa etária</p>
        {#if semDados(data.protesesPorIdade)}
          <p class="py-8 text-center text-sm text-gray-400">Nenhuma entrega no período</p>
        {:else}
          <div class="h-56">
            <EChart option={idadeOption} />
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- 4 e 5. Satisfação e não conformidades -->
  <section class="mb-8">
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
      Qualidade pós-entrega
    </h2>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- Satisfação -->
      <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p class="mb-3 text-sm font-medium text-gray-700">Satisfação pós-entrega</p>
        {#if totalSatisfacao === 0}
          <p class="py-8 text-center text-sm text-gray-400">Nenhuma ligação registrada no período</p>
        {:else}
          <p class="mb-3 text-xs text-gray-400">{totalSatisfacao} ligações registradas</p>
          <div class="h-52">
            <EChart option={satisfacaoOption} />
          </div>
        {/if}
      </div>

      <!-- Não conformidades -->
      <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <p class="mb-3 text-sm font-medium text-gray-700">Não conformidades por critério</p>
        {#if data.naoConformidades.adaptation === 0 && data.naoConformidades.occlusion === 0 && data.naoConformidades.material === 0}
          <p class="py-8 text-center text-sm text-gray-400">
            Nenhuma não conformidade registrada no período
          </p>
        {:else}
          <p class="mb-3 text-xs text-gray-400">
            Critérios marcados como não ok nas avaliações
          </p>
          <div class="h-40">
            <EChart option={naoConformOption} />
          </div>
        {/if}
      </div>
    </div>
  </section>

  <!-- 6. Recusas por fase -->
  <section>
    <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
      Recusas por fase
    </h2>
    <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      {#if semDados(data.recusasPorFase)}
        <p class="py-8 text-center text-sm text-gray-400">
          Nenhuma recusa registrada no período
        </p>
      {:else}
        <div class="h-48">
          <EChart option={recusasOption} />
        </div>
      {/if}
    </div>
  </section>
</div>
